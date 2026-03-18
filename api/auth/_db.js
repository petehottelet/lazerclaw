import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

// Seed users are created from environment variables on first run.
// Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file.
const SEED_USERS = [
  {
    email: process.env.ADMIN_EMAIL || 'admin@lazerclaw.local',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    allowedIPs: ['*'],
    isAdmin: true,
    name: process.env.ADMIN_NAME || 'Admin',
    createdAt: new Date().toISOString(),
  },
]

function dbPath() {
  const tmp = path.join('/tmp', 'dtool-users.json')
  if (fs.existsSync(tmp)) return tmp
  return tmp
}

function readUsers() {
  const p = dbPath()
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { /* corrupt file, re-seed */ }
  }
  const seed = [...SEED_USERS]
  writeUsers(seed)
  return seed
}

function writeUsers(users) {
  fs.writeFileSync(dbPath(), JSON.stringify(users, null, 2), 'utf-8')
}

export function getUsers() {
  return readUsers()
}

export function getUserByEmail(email) {
  return readUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export async function createUser({ email, password, allowedIPs, name, isAdmin = false }) {
  const users = readUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('User already exists')
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = {
    email: email.toLowerCase(),
    passwordHash,
    allowedIPs: allowedIPs || [],
    isAdmin,
    name: name || email.split('@')[0],
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  return sanitize(user)
}

export function updateUser(email, updates) {
  const users = readUsers()
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
  if (idx === -1) throw new Error('User not found')
  if (updates.allowedIPs !== undefined) users[idx].allowedIPs = updates.allowedIPs
  if (updates.name !== undefined) users[idx].name = updates.name
  writeUsers(users)
  return sanitize(users[idx])
}

export async function resetPassword(email, newPassword) {
  const users = readUsers()
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
  if (idx === -1) throw new Error('User not found')
  users[idx].passwordHash = await bcrypt.hash(newPassword, 10)
  writeUsers(users)
  return sanitize(users[idx])
}

export function deleteUser(email) {
  const users = readUsers()
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
  if (idx === -1) throw new Error('User not found')
  if (users[idx].isAdmin) throw new Error('Cannot delete admin user')
  users.splice(idx, 1)
  writeUsers(users)
}

export async function verifyPassword(email, password) {
  const user = getUserByEmail(email)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}

export function checkIP(user, requestIP) {
  if (!user.allowedIPs || user.allowedIPs.length === 0) return false
  if (user.allowedIPs.includes('*')) return true
  return user.allowedIPs.includes(requestIP)
}

export function sanitize(user) {
  const { passwordHash, ...rest } = user
  return rest
}

export function getRequestIP(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return xff.split(',')[0].trim()
  const xri = req.headers['x-real-ip']
  if (xri) return xri
  return req.socket?.remoteAddress || '0.0.0.0'
}
