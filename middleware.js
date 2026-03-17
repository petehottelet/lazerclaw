import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dtool-dev-secret-change-me')

const PUBLIC_AUTH_ROUTES = ['/api/auth/login', '/api/auth/ip', '/api/auth/logout', '/api/agent', '/api/ai-image']

export default async function middleware(request) {
  const { pathname } = new URL(request.url)

  if (PUBLIC_AUTH_ROUTES.some(r => pathname === r)) {
    return                          // allow through
  }
  // Allow AI image endpoint (exact or with trailing slash / base path)
  if (pathname === '/api/ai-image' || pathname.startsWith('/api/ai-image')) {
    return
  }

  if (!pathname.startsWith('/api/')) {
    return                          // only protect API routes
  }

  const token = parseCookie(request.headers.get('cookie') || '').dtool_token

  if (!token) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '0.0.0.0'

    if (payload.ip && payload.ip !== ip) {
      return new Response(JSON.stringify({ error: 'Session invalid: IP address changed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return                          // valid — continue to handler
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  matcher: ['/api/:path*'],
}

function parseCookie(cookieStr) {
  const out = {}
  for (const pair of cookieStr.split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) out[k] = decodeURIComponent(v.join('='))
  }
  return out
}
