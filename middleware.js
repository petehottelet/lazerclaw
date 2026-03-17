import { jwtVerify } from 'jose'

const SECRET_RAW = process.env.JWT_SECRET
const SECRET = SECRET_RAW
  ? new TextEncoder().encode(SECRET_RAW)
  : null

const PUBLIC_AUTH_ROUTES = ['/api/auth/login', '/api/auth/ip', '/api/auth/logout']

const RATE_LIMITED_PUBLIC_ROUTES = ['/api/agent', '/api/ai-image']

const rateBuckets = new Map()
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 20

function isRateLimited(ip) {
  const now = Date.now()
  let bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 }
    rateBuckets.set(ip, bucket)
  }
  bucket.count++
  if (rateBuckets.size > 10000) {
    for (const [key, b] of rateBuckets) {
      if (now - b.windowStart > RATE_WINDOW_MS) rateBuckets.delete(key)
    }
  }
  return bucket.count > RATE_LIMIT
}

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '0.0.0.0'
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url)

  if (!pathname.startsWith('/api/')) {
    return
  }

  if (PUBLIC_AUTH_ROUTES.some(r => pathname === r)) {
    return
  }

  if (RATE_LIMITED_PUBLIC_ROUTES.some(r => pathname === r)) {
    const ip = getClientIp(request)
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
    return
  }

  if (!SECRET) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
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
    const ip = getClientIp(request)

    if (payload.ip && payload.ip !== ip) {
      return new Response(JSON.stringify({ error: 'Session invalid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return
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
