import { SignJWT } from 'jose'
import { verifyPassword, checkIP, sanitize, getRequestIP } from './_db.js'

const SECRET = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null

const loginBuckets = new Map()
const LOGIN_WINDOW_MS = 900_000
const LOGIN_LIMIT = 10

function isLoginRateLimited(ip) {
  const now = Date.now()
  let bucket = loginBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > LOGIN_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 }
    loginBuckets.set(ip, bucket)
  }
  bucket.count++
  if (loginBuckets.size > 5000) {
    for (const [key, b] of loginBuckets) {
      if (now - b.windowStart > LOGIN_WINDOW_MS) loginBuckets.delete(key)
    }
  }
  return bucket.count > LOGIN_LIMIT
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SECRET) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const ip = getRequestIP(req)

  if (isLoginRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' })
  }

  try {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await verifyPassword(email, password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  if (!checkIP(user, ip)) {
    return res.status(403).json({
      error: 'Access denied: your IP address is not authorized for this account',
      ip,
    })
  }

  const token = await new SignJWT({
    email: user.email,
    isAdmin: user.isAdmin,
    ip,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET)

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', [
    `dtool_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${secure}`,
    `dtool_auth=1; Path=/; Max-Age=86400; SameSite=Lax${secure}`,
  ])

  return res.status(200).json({ user: sanitize(user), ip })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
