import { SignJWT } from 'jose'
import { verifyPassword, checkIP, sanitize, getRequestIP } from './_db.js'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dtool-dev-secret-change-me')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const ip = getRequestIP(req)

  const user = await verifyPassword(email, password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password', ip })
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
}
