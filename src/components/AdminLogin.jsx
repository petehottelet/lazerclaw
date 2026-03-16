import React, { useState, useEffect, useRef } from 'react'

// Admin credentials loaded from environment variables
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''

// ─── REALISTIC LIGHTNING BOLT GENERATION ───────────────────────────────────
function generateBolt(x1, y1, x2, y2, detail = 5) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  let offset = len * 0.28

  for (let iter = 0; iter < detail; iter++) {
    const np = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5
      const sdx = b.x - a.x, sdy = b.y - a.y
      const nl = Math.sqrt(sdx * sdx + sdy * sdy)
      const nx = nl > 0 ? -sdy / nl : 0
      const ny = nl > 0 ? sdx / nl : 0
      np.push({ x: mx + nx * (Math.random() - 0.5) * offset, y: my + ny * (Math.random() - 0.5) * offset })
      np.push(b)
    }
    pts = np
    offset *= 0.52
  }
  return pts
}

function strokeBolt(ctx, pts, intensity = 1.0) {
  ctx.shadowColor = `rgba(100,160,255,${intensity * 0.8})`
  ctx.shadowBlur = 40
  ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.18})`
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowColor = `rgba(130,190,255,${intensity * 0.9})`
  ctx.shadowBlur = 20
  ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.45})`
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowColor = `rgba(200,225,255,${intensity})`
  ctx.shadowBlur = 6
  ctx.strokeStyle = `rgba(230,240,255,${intensity * 0.95})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function strokeBranch(ctx, pts, intensity = 1.0) {
  ctx.shadowColor = `rgba(100,150,255,${intensity * 0.5})`
  ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(90,140,240,${intensity * 0.3})`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.6})`
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

export default function AdminLogin({ onAuth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)

  // Background lightning effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      if (Math.random() < 0.04) {
        const startX = Math.random() * canvas.width
        const endX = startX + (Math.random() - 0.5) * 400
        const bolt = generateBolt(startX, 0, endX, canvas.height * 0.4, 5)

        const intensity = 0.5 + Math.random() * 0.4
        strokeBolt(ctx, bolt, intensity)

        const mainAng = Math.atan2(canvas.height * 0.4, endX - startX)
        const numBranches = 1 + Math.floor(Math.random() * 2)
        for (let bi = 0; bi < numBranches; bi++) {
          const brIdx = 1 + Math.floor(Math.random() * (bolt.length - 2))
          const brLen = 20 + Math.random() * 60
          const brAng = mainAng + (Math.random() - 0.5) * 2.0
          const brEnd = {
            x: bolt[brIdx].x + Math.cos(brAng) * brLen,
            y: bolt[brIdx].y + Math.sin(brAng) * brLen
          }
          const branch = generateBolt(bolt[brIdx].x, bolt[brIdx].y, brEnd.x, brEnd.y, 3)
          strokeBranch(ctx, branch, intensity * 0.7)
        }
      }

      ctx.restore()
      rafId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    setError('')

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      onAuth()
    } else {
      setError('Invalid credentials')
    }
  }

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      }}
    >
      {/* Background lightning canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Animated background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.3) 0%, transparent 50%)',
        }}
      />

      {/* Logo */}
      <img
        src="/lazerclaw_logo.png"
        alt="LazerClaw"
        className="mb-8"
        style={{
          height: 150,
          filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.5)) drop-shadow(0 0 40px rgba(6, 182, 212, 0.3))',
        }}
      />

      {/* Admin Badge */}
      <div
        className="mb-6 px-4 py-1 rounded-full text-xs font-bold"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
          color: '#fff',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
        }}
      >
        ADMIN ACCESS
      </div>

      {/* Login Form */}
      <form
        onSubmit={submit}
        className="relative rounded-2xl p-8 w-96 flex flex-col gap-4"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 25px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Admin Email"
          className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(30, 30, 50, 0.8)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            color: '#e0e0e0',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'
            e.target.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.2)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(139, 92, 246, 0.2)'
            e.target.style.boxShadow = 'none'
          }}
        />
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg px-4 py-3 pr-10 text-sm outline-none transition-all duration-200"
            style={{
              background: 'rgba(30, 30, 50, 0.8)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              color: '#e0e0e0',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'rgba(139, 92, 246, 0.6)'
              e.target.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.2)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'rgba(139, 92, 246, 0.2)'
              e.target.style.boxShadow = 'none'
            }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors hover:bg-white/10"
            style={{ color: 'rgba(139, 92, 246, 0.5)' }}
            tabIndex={-1}
          >
            {showPw ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>

        {error && (
          <div
            className="text-xs rounded-lg px-4 py-3"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg py-3.5 text-sm font-bold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #06b6d4 100%)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.5)'
          }}
        >
          Login
        </button>

        <a
          href="/"
          className="text-center text-xs transition-colors"
          style={{ color: '#6b7280' }}
          onMouseEnter={e => e.currentTarget.style.color = '#8b5cf6'}
          onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
        >
          Back to LazerClaw
        </a>
      </form>
    </div>
  )
}
