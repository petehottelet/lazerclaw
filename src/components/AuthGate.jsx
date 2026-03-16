import React, { useState, useEffect, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// LIGHTNING BOLT ANIMATION ENGINE
// Procedural lightning bolts from the dragon's mouth to laser tip
// Based on Circuit Mantle algorithm, adapted for LazerClaw purple/cyan palette
// ═══════════════════════════════════════════════════════════════════════════

// Anchor points (as fractions of the logo's rendered size)
// Measured from lazerclaw_logo.png (natural size ~1500 × 920px)
const ORIGIN_X = 0.625   // Dragon's mouth
const ORIGIN_Y = 0.390
const TARGET_X = 0.895   // Laser beam tip
const TARGET_Y = 0.210

// Generate a jagged lightning bolt polyline using midpoint displacement
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

// 3-pass stroke: outer glow → mid core → bright core
// Realistic blue-toned electric effect based on lightning_overlay_fix.html
function strokeBolt(ctx, pts, intensity) {
  // Pass 1 – outer glow (blue)
  ctx.shadowColor = `rgba(100,160,255,${intensity * 0.8})`
  ctx.shadowBlur = 40
  ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.18})`
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 2 – mid core (lighter blue)
  ctx.shadowColor = `rgba(130,190,255,${intensity * 0.9})`
  ctx.shadowBlur = 20
  ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.45})`
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 3 – bright core (near-white)
  ctx.shadowColor = `rgba(200,225,255,${intensity})`
  ctx.shadowBlur = 6
  ctx.strokeStyle = `rgba(230,240,255,${intensity * 0.95})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

// Draw branches off the main bolt
function strokeBranch(ctx, pts, intensity) {
  ctx.shadowColor = `rgba(100,150,255,${intensity * 0.5})`
  ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(90,140,240,${intensity * 0.3})`
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.6})`
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

export default function AuthGate({ onAuth, onShowAbout }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(true)
  const [logoAnimated, setLogoAnimated] = useState(false)
  const logoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    // Always show login page - don't auto-login even if session exists
    // User must explicitly click "Use as Guest" or "Login"
    setLoading(false)
    setTimeout(() => setLogoAnimated(true), 100)

    // Just fetch IP for display
    fetch('/api/auth/ip')
      .then(r => r.json())
      .then(data => { if (data.ip) setIp(data.ip) })
      .catch(() => {})
  }, [])

  // Canvas-based lightning animation
  useEffect(() => {
    if (!logoAnimated || !logoRef.current || !canvasRef.current) return

    const img = logoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    function resize() {
      const rect = img.getBoundingClientRect()
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }

    function draw() {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Convert anchor fractions → pixel coords
      const ox = ORIGIN_X * W
      const oy = ORIGIN_Y * H
      const tx = TARGET_X * W
      const ty = TARGET_Y * H

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      const intensity = 1.0

      // Main bolt (regenerated every frame for live electricity look)
      const bolt = generateBolt(ox, oy, tx, ty, 5)
      strokeBolt(ctx, bolt, intensity)

      // Branches off the main bolt
      const mainAng = Math.atan2(ty - oy, tx - ox)
      const numBranches = 2 + Math.floor(Math.random() * 3)
      for (let bi = 0; bi < numBranches; bi++) {
        const brIdx = 1 + Math.floor(Math.random() * (bolt.length - 2))
        const brLen = 8 + Math.random() * 40
        const brAng = mainAng + (Math.random() - 0.5) * 2.0
        const brEnd = {
          x: bolt[brIdx].x + Math.cos(brAng) * brLen,
          y: bolt[brIdx].y + Math.sin(brAng) * brLen
        }
        const branch = generateBolt(bolt[brIdx].x, bolt[brIdx].y, brEnd.x, brEnd.y, 3)
        strokeBranch(ctx, branch, intensity)

        // Optional: sub-branch
        if (Math.random() < 0.4) {
          const si = 1 + Math.floor(Math.random() * (branch.length - 1))
          const sLen = 6 + Math.random() * 16
          const sAng = brAng + (Math.random() - 0.5) * 2
          const sb = generateBolt(
            branch[si].x, branch[si].y,
            branch[si].x + Math.cos(sAng) * sLen,
            branch[si].y + Math.sin(sAng) * sLen,
            2
          )
          ctx.strokeStyle = `rgba(196,181,253,${intensity * 0.25})`
          ctx.lineWidth = 0.4
          ctx.beginPath()
          ctx.moveTo(sb[0].x, sb[0].y)
          for (let sp = 1; sp < sb.length; sp++) ctx.lineTo(sb[sp].x, sb[sp].y)
          ctx.stroke()
        }
      }

      // Add glow at origin (dragon mouth)
      const glowGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 30)
      glowGrad.addColorStop(0, 'rgba(6,182,212,0.6)')
      glowGrad.addColorStop(0.5, 'rgba(139,92,246,0.3)')
      glowGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(ox, oy, 30, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    rafRef.current = requestAnimationFrame(draw)

    const handleResize = () => resize()
    window.addEventListener('resize', handleResize)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [logoAnimated])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        onAuth(data.user)
      } else {
        setError(data.error || 'Login failed')
        if (data.ip) setIp(data.ip)
        setLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const enterAsGuest = () => {
    // Set dark mode for guests
    try {
      localStorage.setItem('dtool-dark-mode', 'true')
    } catch {}
    onAuth({
      email: 'guest@lazerclaw.com',
      name: 'Guest',
      isGuest: true,
    })
  }

  if (loading) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
        }}
      >
        {/* Pulsing logo while loading */}
        <img
          src="/lazerclaw_logo.png"
          alt="LazerClaw"
          className="mb-6"
          style={{
            height: 120,
            filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.5)) drop-shadow(0 0 40px rgba(6, 182, 212, 0.3))',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
        <div
          className="text-sm font-medium"
          style={{
            color: '#8b5cf6',
            textShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
          }}
        >
          Powering up...
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      }}
    >
      {/* Animated background energy */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.3) 0%, transparent 50%)',
          animation: 'energySwirl 8s ease-in-out infinite',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Giant Logo with Lightning Animation - ABOVE the form */}
      <div className="relative mb-4">
        {/* The Logo with Canvas Lightning Overlay */}
        <div className="relative" style={{ display: 'inline-block' }}>
          <img
            ref={logoRef}
            src="/lazerclaw_logo.png"
            alt="LazerClaw"
            style={{
              display: 'block',
              height: 350,
              maxWidth: '90vw',
              objectFit: 'contain',
              filter: logoAnimated
                ? 'drop-shadow(0 0 30px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 60px rgba(6, 182, 212, 0.4)) drop-shadow(0 0 100px rgba(139, 92, 246, 0.3))'
                : 'none',
              animation: logoAnimated
                ? 'logoMaterialize 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                : 'none',
              opacity: logoAnimated ? 1 : 0,
            }}
          />

          {/* Canvas overlay for procedural lightning bolts */}
          {logoAnimated && (
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Laser tip flare */}
          {logoAnimated && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: '15%',
                right: '2%',
                width: 24,
                height: 24,
                background: 'radial-gradient(circle, #fff 0%, #06b6d4 40%, transparent 70%)',
                filter: 'blur(4px)',
                animation: 'laserTipFlare 0.15s ease-in-out infinite alternate',
                borderRadius: '50%',
              }}
            />
          )}
        </div>

        {/* Energy rings on logo appear */}
        {logoAnimated && (
          <>
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: 200,
                height: 200,
                border: '3px solid rgba(139, 92, 246, 0.6)',
                animation: 'energyPulse 1.2s ease-out 0.3s forwards',
                opacity: 0,
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: 200,
                height: 200,
                border: '2px solid rgba(6, 182, 212, 0.5)',
                animation: 'energyPulse 1.2s ease-out 0.5s forwards',
                opacity: 0,
              }}
            />
          </>
        )}
      </div>

      {/* Tagline - Heavy Metal Chrome Effect */}
      <div
        className="text-center mb-6"
        style={{
          animation: logoAnimated ? 'fadeSlideUp 0.5s ease-out 0.6s both' : 'none',
        }}
      >
        <div
          className="text-sm font-bold tracking-wider"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #ffffff 20%, #b8b8b8 40%, #8a8a8a 50%, #b8b8b8 60%, #ffffff 80%, #d0d0d0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            textShadow: '0 0 20px rgba(255,255,255,0.2)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          The World's First & Only Heavy Metal
        </div>
        <div
          className="text-sm font-bold tracking-wider"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #ffffff 20%, #b8b8b8 40%, #8a8a8a 50%, #b8b8b8 60%, #ffffff 80%, #d0d0d0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            textShadow: '0 0 20px rgba(255,255,255,0.2)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Design Tool Made for Lobsters™
        </div>
      </div>

      {/* Login Form */}
      <form
        onSubmit={submit}
        className="relative rounded-2xl p-8 w-96 flex flex-col gap-4"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 0 80px rgba(6, 182, 212, 0.1), 0 25px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          animation: logoAnimated ? 'fadeSlideUp 0.6s ease-out 0.4s both' : 'none',
        }}
      >
        {/* Primary CTA - Use as Guest */}
        <button
          type="button"
          onClick={enterAsGuest}
          className="w-full rounded-lg py-3.5 text-sm font-bold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #06b6d4 100%)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            letterSpacing: '0.02em',
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
          Use as Guest
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px" style={{ background: 'rgba(139, 92, 246, 0.2)' }} />
          <span className="text-xs" style={{ color: '#6b7280' }}>or sign in</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(139, 92, 246, 0.2)' }} />
        </div>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
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

        {/* Secondary CTA - Login (outlined style) */}
        <button
          type="submit"
          className="w-full rounded-lg py-3 text-sm font-semibold transition-all duration-200"
          style={{
            background: 'transparent',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            color: '#a78bfa',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.8)'
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'
            e.currentTarget.style.color = '#c4b5fd'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#a78bfa'
          }}
        >
          Login
        </button>

        {ip && (
          <p
            className="text-[10px] text-center mt-1"
            style={{ color: '#4b5563' }}
          >
            Your IP: {ip}
          </p>
        )}
      </form>

      {/* Bottom About link */}
      <div className="absolute bottom-6 text-center">
        <button
          onClick={onShowAbout}
          className="transition-all duration-200"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: 11,
            letterSpacing: '0.08em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#8b5cf6'
            e.currentTarget.style.textShadow = '0 0 10px rgba(139, 92, 246, 0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#6b7280'
            e.currentTarget.style.textShadow = 'none'
          }}
        >
          About LazerClaw
        </button>
      </div>
    </div>
  )
}
