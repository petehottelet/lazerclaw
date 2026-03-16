import React, { useState, useEffect } from 'react'

const inputStyle = {
  background: 'var(--th-input-bg, #fff)',
  border: '1px solid var(--th-input-border, #d1d5db)',
  color: 'var(--th-text, #111827)',
}

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const [form, setForm] = useState({ email: '', name: '', password: '', allowedIPs: '' })

  useEffect(() => {
    loadUsers()
    fetch('/api/auth/ip').then(r => r.json()).then(d => setIp(d.ip || '')).catch(() => {})
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch {
      setError('Failed to load users')
    }
    setLoading(false)
  }

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    try {
      const ips = form.allowedIPs.split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          password: form.password,
          allowedIPs: ips,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setForm({ email: '', name: '', password: '', allowedIPs: '' })
      setShowAdd(false)
      flash('User created')
      loadUsers()
    } catch { setError('Failed to create user') }
  }

  async function handleEdit(e) {
    e.preventDefault()
    setError('')
    try {
      const ips = form.allowedIPs.split(',').map(s => s.trim()).filter(Boolean)
      const body = { email: editUser.email, allowedIPs: ips, name: form.name }
      if (form.password) body.newPassword = form.password
      const res = await fetch('/api/auth/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setEditUser(null)
      flash('User updated')
      loadUsers()
    } catch { setError('Failed to update user') }
  }

  async function handleDelete(email) {
    if (!confirm(`Delete user ${email}?`)) return
    setError('')
    try {
      const res = await fetch('/api/auth/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      flash('User deleted')
      loadUsers()
    } catch { setError('Failed to delete user') }
  }

  function openEdit(user) {
    setShowAdd(false)
    setEditUser(user)
    setForm({
      email: user.email,
      name: user.name || '',
      password: '',
      allowedIPs: (user.allowedIPs || []).join(', '),
    })
  }

  function openAdd() {
    setEditUser(null)
    setShowAdd(true)
    setForm({ email: '', name: '', password: '', allowedIPs: '' })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-auto" style={{ background: 'var(--th-bg, #f3f4f6)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shadow-sm"
        style={{ background: 'var(--th-surface, #fff)', borderBottom: '1px solid var(--th-border, #e5e7eb)' }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--th-text, #111827)' }}>User Management</h1>
          {ip && <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>Your IP: {ip}</p>}
        </div>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-lg transition-colors"
          style={{
            background: 'var(--th-surface-hover, #f3f4f6)',
            color: 'var(--th-text-secondary, #6b7280)',
            border: '1px solid var(--th-border, #e5e7eb)',
          }}
        >Back to App</button>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 text-sm rounded-lg px-4 py-2" style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}>
            {error}
            <button className="ml-2 underline text-xs" onClick={() => setError('')}>dismiss</button>
          </div>
        )}
        {success && (
          <div className="mb-4 text-sm rounded-lg px-4 py-2" style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: '#22c55e',
          }}>
            {success}
          </div>
        )}

        {/* Add / Edit Form */}
        {(showAdd || editUser) && (
          <div className="mb-6 rounded-xl p-5 shadow-sm" style={{
            background: 'var(--th-surface, #fff)',
            border: '1px solid var(--th-border, #e5e7eb)',
          }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--th-text-secondary, #6b7280)' }}>
              {editUser ? `Edit: ${editUser.email}` : 'Add New User'}
            </h2>
            <form onSubmit={editUser ? handleEdit : handleAdd} className="grid grid-cols-2 gap-3">
              {!editUser && (
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="col-span-2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  style={inputStyle}
                />
              )}
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                style={inputStyle}
              />
              <input
                type={editUser ? 'text' : 'password'}
                placeholder={editUser ? 'New password (leave blank to keep)' : 'Password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required={!editUser}
                className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                style={inputStyle}
              />
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Allowed IPs (comma-separated, or * for any)"
                  value={form.allowedIPs}
                  onChange={e => setForm(f => ({ ...f, allowedIPs: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  style={inputStyle}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>
                  Enter specific IPs or use * to allow any. Your current IP: {ip}
                </p>
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setEditUser(null) }}
                  className="px-4 py-1.5 text-sm rounded-lg transition-colors"
                  style={{
                    background: 'var(--th-surface-hover, #f3f4f6)',
                    color: 'var(--th-text-secondary, #6b7280)',
                    border: '1px solid var(--th-border, #e5e7eb)',
                  }}
                >Cancel</button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-sm text-white rounded-lg transition-colors"
                  style={{ background: 'var(--th-accent, #4f46e5)' }}
                >{editUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Toolbar */}
        {!showAdd && !editUser && (
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm" style={{ color: 'var(--th-text-secondary, #6b7280)' }}>
              {users.length} user{users.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={openAdd}
              className="px-4 py-1.5 text-sm text-white rounded-lg transition-colors"
              style={{ background: 'var(--th-accent, #4f46e5)' }}
            >+ Add User</button>
          </div>
        )}

        {/* User Table */}
        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>Loading...</p>
        ) : (
          <div className="rounded-xl shadow-sm overflow-hidden" style={{
            background: 'var(--th-surface, #fff)',
            border: '1px solid var(--th-border, #e5e7eb)',
          }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--th-surface-hover, #f9fafb)' }}>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>User</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>Allowed IPs</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>Role</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ borderTop: '1px solid var(--th-border, #e5e7eb)' }}>
                {users.map(u => (
                  <tr key={u.email} style={{ borderBottom: '1px solid var(--th-border, #e5e7eb)' }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'var(--th-text, #111827)' }}>{u.name || u.email.split('@')[0]}</div>
                      <div className="text-xs" style={{ color: 'var(--th-text-muted, #9ca3af)' }}>{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.allowedIPs || []).map((ip, i) => (
                          <span key={i} className="inline-block text-xs px-2 py-0.5 rounded-full" style={{
                            background: 'var(--th-surface-hover, #f3f4f6)',
                            color: 'var(--th-text-secondary, #6b7280)',
                            border: '1px solid var(--th-border, #e5e7eb)',
                          }}>
                            {ip}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: u.isAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.1)',
                        color: u.isAdmin ? '#f59e0b' : 'var(--th-accent, #4f46e5)',
                        border: u.isAdmin ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(59,130,246,0.2)',
                      }}>
                        {u.isAdmin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs mr-3"
                        style={{ color: 'var(--th-accent, #4f46e5)' }}
                      >Edit</button>
                      {!u.isAdmin && (
                        <button
                          onClick={() => handleDelete(u.email)}
                          className="text-xs"
                          style={{ color: '#ef4444' }}
                        >Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
