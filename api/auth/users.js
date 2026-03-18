import { jwtVerify } from 'jose'
import {
  getUsers, createUser, updateUser, resetPassword, deleteUser, sanitize, getRequestIP,
} from './_db.js'

const SECRET = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null

const STUDIO_BASE = process.env.STUDIO_BASE_URL || ''
const STUDIO_ADMIN_KEY = process.env.STUDIO_ADMIN_KEY || ''

async function syncToStudio(method, body) {
  if (!STUDIO_ADMIN_KEY) return
  try {
    await fetch(`${STUDIO_BASE}/api/admin/users`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': STUDIO_ADMIN_KEY,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.warn('Studio sync failed (non-fatal):', err.message)
  }
}

async function requireAdmin(req, res) {
  if (!SECRET) { res.status(500).json({ error: 'Server configuration error' }); return null }

  const cookies = parseCookies(req.headers.cookie || '')
  const token = cookies.dtool_token
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return null }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (!payload.isAdmin) { res.status(403).json({ error: 'Admin access required' }); return null }

    const ip = getRequestIP(req)
    if (payload.ip && payload.ip !== ip) {
      res.status(401).json({ error: 'Session invalid: IP changed' })
      return null
    }

    return payload
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' })
    return null
  }
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const users = getUsers().map(sanitize)
    return res.status(200).json({ users })
  }

  if (req.method === 'POST') {
    const { email, password, allowedIPs, name } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    try {
      const user = await createUser({ email, password, allowedIPs, name })
      await syncToStudio('POST', { email, password, name })
      return res.status(201).json({ user })
    } catch (e) {
      return res.status(409).json({ error: e.message })
    }
  }

  if (req.method === 'PUT') {
    const { email, allowedIPs, name, newPassword } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required' })
    try {
      let user
      if (allowedIPs !== undefined || name !== undefined) {
        user = updateUser(email, { allowedIPs, name })
      }
      if (newPassword) {
        user = await resetPassword(email, newPassword)
      }
      const studioUpdate = {}
      if (name !== undefined) studioUpdate.name = name
      if (newPassword) studioUpdate.newPassword = newPassword
      if (Object.keys(studioUpdate).length > 0) {
        await syncToStudio('PUT', { email, ...studioUpdate })
      }
      return res.status(200).json({ user })
    } catch (e) {
      return res.status(404).json({ error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required' })
    try {
      deleteUser(email)
      await syncToStudio('DELETE', { email })
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

function parseCookies(cookieStr) {
  const out = {}
  for (const pair of cookieStr.split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) out[k] = decodeURIComponent(v.join('='))
  }
  return out
}
