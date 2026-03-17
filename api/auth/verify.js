import { jwtVerify } from 'jose'
import { getUserByEmail, checkIP, sanitize, getRequestIP } from './_db.js'

const SECRET = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SECRET) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const cookies = parseCookies(req.headers.cookie || '')
  const token = cookies.dtool_token
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const ip = getRequestIP(req)

    if (payload.ip && payload.ip !== ip) {
      clearCookies(res)
      return res.status(401).json({ error: 'Session invalid: IP address changed', ip })
    }

    const user = getUserByEmail(payload.email)
    if (!user) {
      clearCookies(res)
      return res.status(401).json({ error: 'User no longer exists' })
    }

    if (!checkIP(user, ip)) {
      clearCookies(res)
      return res.status(403).json({ error: 'IP address no longer authorized', ip })
    }

    return res.status(200).json({ user: sanitize(user), ip })
  } catch {
    clearCookies(res)
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

function clearCookies(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', [
    `dtool_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`,
    `dtool_auth=; Path=/; Max-Age=0; SameSite=Lax${secure}`,
  ])
}

function parseCookies(cookieStr) {
  const out = {}
  for (const pair of cookieStr.split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) out[k] = decodeURIComponent(v.join('='))
  }
  return out
}
