/**
 * ⚡⚡⚡ LAZERCLAW ⚡⚡⚡
 *
 * The ultimate browser-based design tool that hits different.
 * Built with React, powered by creativity, fueled by lightning.
 *
 * "The World's First & Only Heavy Metal Design Tool Made for Lobsters™" - LazerClaw 2024
 *
 * PRIVACY: No user data is collected or saved. All content is session-only.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AdminLogin from './components/AdminLogin'
import AdminPanel from './components/AdminPanel'
import AiToolsPage from './components/AiToolsPage'
import LightningIntro from './components/LightningIntro'
import AboutPage from './components/AboutPage'
import './index.css'

const THEMES = [
  { id: 'default',  name: 'Default',  accent: '#4f46e5', light: '#f3f4f6', dark: '#111827' },
  { id: 'ocean',    name: 'Ocean',    accent: '#0369a1', light: '#dde8f4', dark: '#0d1b2e' },
  { id: 'ember',    name: 'Ember',    accent: '#c2410c', light: '#f0e4d0', dark: '#1c1510' },
  { id: 'forest',   name: 'Forest',   accent: '#15803d', light: '#d8ecde', dark: '#0e1a12' },
  { id: 'midnight', name: 'Midnight', accent: '#7c3aed', light: '#ddd4f0', dark: '#130e20' },
]

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  try { localStorage.setItem('dtool-theme', id) } catch {}
}

// ─── WELCOME PAGE LIGHTNING BOLT ENGINE ──────────────────────────────────────
// Anchor points across the LAZERCLAW letters (x%, y%) for lightning to jump between
const LETTER_ANCHORS = [
  // L
  { x: 0.08, y: 0.62 }, { x: 0.08, y: 0.88 }, { x: 0.14, y: 0.88 },
  // A
  { x: 0.17, y: 0.88 }, { x: 0.21, y: 0.62 }, { x: 0.25, y: 0.88 },
  // Z
  { x: 0.27, y: 0.62 }, { x: 0.34, y: 0.62 }, { x: 0.27, y: 0.88 }, { x: 0.34, y: 0.88 },
  // E
  { x: 0.36, y: 0.62 }, { x: 0.42, y: 0.62 }, { x: 0.36, y: 0.75 }, { x: 0.36, y: 0.88 }, { x: 0.42, y: 0.88 },
  // R
  { x: 0.44, y: 0.62 }, { x: 0.50, y: 0.62 }, { x: 0.44, y: 0.88 }, { x: 0.50, y: 0.88 },
  // C
  { x: 0.56, y: 0.62 }, { x: 0.52, y: 0.75 }, { x: 0.56, y: 0.88 },
  // L
  { x: 0.58, y: 0.62 }, { x: 0.58, y: 0.88 }, { x: 0.64, y: 0.88 },
  // A
  { x: 0.66, y: 0.88 }, { x: 0.70, y: 0.62 }, { x: 0.74, y: 0.88 },
  // W
  { x: 0.76, y: 0.62 }, { x: 0.79, y: 0.88 }, { x: 0.82, y: 0.72 }, { x: 0.85, y: 0.88 }, { x: 0.88, y: 0.62 },
  // Creature laser tip area
  { x: 0.62, y: 0.38 }, { x: 0.72, y: 0.28 }, { x: 0.82, y: 0.22 },
]

// Anchor points along the laser beam (from dragon's mouth to the right)
const LASER_ANCHORS = [
  { x: 0.18, y: 0.40 }, { x: 0.24, y: 0.39 }, { x: 0.30, y: 0.38 },
  { x: 0.36, y: 0.37 }, { x: 0.42, y: 0.36 }, { x: 0.48, y: 0.36 },
  { x: 0.54, y: 0.35 }, { x: 0.60, y: 0.35 }, { x: 0.66, y: 0.34 },
  { x: 0.72, y: 0.33 }, { x: 0.78, y: 0.32 }, { x: 0.84, y: 0.31 },
]

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

function strokeBolt(ctx, pts, intensity) {
  ctx.shadowColor = `rgba(100,160,255,${intensity * 0.8})`
  ctx.shadowBlur = 40
  ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.18})`
  ctx.lineWidth = 14
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowColor = `rgba(130,190,255,${intensity * 0.9})`
  ctx.shadowBlur = 20
  ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.45})`
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowColor = `rgba(200,225,255,${intensity})`
  ctx.shadowBlur = 6
  ctx.strokeStyle = `rgba(230,240,255,${intensity * 0.95})`
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

function strokeBranch(ctx, pts, intensity) {
  ctx.shadowColor = `rgba(100,150,255,${intensity * 0.5})`
  ctx.shadowBlur = 14
  ctx.strokeStyle = `rgba(90,140,240,${intensity * 0.3})`
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.6})`
  ctx.lineWidth = 0.7
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

// ─── WELCOME PAGE ────────────────────────────────────────────────────────────
function WelcomePage({ onEnter, onShowAbout, introActive }) {
  const [animated, setAnimated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const logoRef = useRef(null)
  const logoWrapRef = useRef(null)
  const contentRef = useRef(null)
  const formRef = useRef(null)
  const canvasRef = useRef(null)
  const canvas2Ref = useRef(null)
  const laserCanvasRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const shimmerRef = useRef(null)
  const shimmer2Ref = useRef(null)
  const rafRef = useRef(null)
  const laserRafRef = useRef(null)
  const bgRafRef = useRef(null)
  const cameFromIntro = useRef(introActive)
  const wasIntroActive = useRef(introActive)

  // Handle intro-to-welcome transition and animation start
  useEffect(() => {
    if (introActive) return

    if (wasIntroActive.current) {
      setAnimated(true)
      wasIntroActive.current = false
      return
    }

    // Returning visitor — standard delayed entrance
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [introActive])

  // Random "thunk" — heavy impact micro-animation
  useEffect(() => {
    if (!animated) return
    let timer
    function scheduleThunk() {
      const delay = 4000 + Math.random() * 8000
      timer = setTimeout(() => {
        const el = logoWrapRef.current
        if (el) {
          el.style.animation = 'none'
          void el.offsetHeight
          el.style.animation = 'logoThunk 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards'
        }
        scheduleThunk()
      }, delay)
    }
    scheduleThunk()
    return () => clearTimeout(timer)
  }, [animated])

  // Canvas-based lightning arcing across logo letters
  useEffect(() => {
    if (!animated || !logoRef.current || !canvasRef.current || !canvas2Ref.current) return
    const img = logoRef.current
    const c1 = canvasRef.current, ctx1 = c1.getContext('2d')
    const c2 = canvas2Ref.current, ctx2 = c2.getContext('2d')

    let activeBolts = []
    let nextSpawn = 200 + Math.random() * 600

    function resize() {
      const rect = img.getBoundingClientRect()
      const w = Math.round(rect.width), h = Math.round(rect.height)
      c1.width = w; c1.height = h
      c2.width = w; c2.height = h
    }

    function pickPair() {
      const a = Math.floor(Math.random() * LETTER_ANCHORS.length)
      let b = a
      const maxDist = 0.25
      for (let tries = 0; tries < 20; tries++) {
        b = Math.floor(Math.random() * LETTER_ANCHORS.length)
        if (b === a) continue
        const dx = LETTER_ANCHORS[a].x - LETTER_ANCHORS[b].x
        const dy = LETTER_ANCHORS[a].y - LETTER_ANCHORS[b].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0.04 && dist < maxDist) break
      }
      return [LETTER_ANCHORS[a], LETTER_ANCHORS[b]]
    }

    function spawnBolt(W, H) {
      const [from, to] = pickPair()
      const pts = generateBolt(from.x * W, from.y * H, to.x * W, to.y * H, 4)
      const flashDur = 0.04 + Math.random() * 0.06
      activeBolts.push({ pts, life: 1.0, phase: 'flash', flashTimer: flashDur, fadeRate: 0.03 + Math.random() * 0.02, from, to, W, H })
    }

    let lastTime = performance.now()
    let elapsed = 0

    function drawBolts(ctx, W, H) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const b of activeBolts) {
        let alpha
        if (b.phase === 'flash') {
          alpha = 0.5 + Math.random() * 0.5
        } else {
          alpha = b.life * 0.4
        }

        ctx.shadowColor = `rgba(130,180,255,${alpha * 0.6})`
        ctx.shadowBlur = 18
        ctx.strokeStyle = `rgba(80,130,240,${alpha * 0.15})`
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y)
        ctx.stroke()

        ctx.shadowColor = `rgba(160,200,255,${alpha * 0.8})`
        ctx.shadowBlur = 8
        ctx.strokeStyle = `rgba(140,190,255,${alpha * 0.4})`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y)
        ctx.stroke()

        ctx.shadowBlur = 3
        ctx.strokeStyle = `rgba(230,240,255,${alpha * 0.9})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y)
        ctx.stroke()
        ctx.shadowBlur = 0

        if (b.phase === 'flash') {
          const gx = b.pts[0].x, gy = b.pts[0].y
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 12)
          g.addColorStop(0, `rgba(200,225,255,${alpha * 0.5})`)
          g.addColorStop(1, 'transparent')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(gx, gy, 12, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    }

    function draw(now) {
      const dt = (now - lastTime) / 1000
      lastTime = now
      elapsed += dt * 1000

      const W = c1.width, H = c1.height
      ctx1.clearRect(0, 0, W, H)
      ctx2.clearRect(0, 0, W, H)

      if (elapsed >= nextSpawn) {
        spawnBolt(W, H)
        elapsed = 0
        nextSpawn = 300 + Math.random() * 800
        if (Math.random() < 0.35) {
          setTimeout(() => spawnBolt(W, H), 30 + Math.random() * 60)
        }
      }

      for (let i = activeBolts.length - 1; i >= 0; i--) {
        const b = activeBolts[i]
        if (b.phase === 'flash') {
          b.flashTimer -= dt
          if (b.flashTimer <= 0) {
            b.phase = 'fade'
            b.pts = generateBolt(b.from.x * W, b.from.y * H, b.to.x * W, b.to.y * H, 4)
          }
        } else {
          b.life -= b.fadeRate
          if (b.life <= 0) { activeBolts.splice(i, 1); continue }
        }
      }

      drawBolts(ctx1, W, H)
      drawBolts(ctx2, W, H)
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
  }, [animated])

  // Laser beam electrical arc effect
  useEffect(() => {
    if (!animated || !logoRef.current || !laserCanvasRef.current) return
    const img = logoRef.current
    const lc = laserCanvasRef.current, lctx = lc.getContext('2d')

    let laserBolts = []
    let nextLaser = 80 + Math.random() * 200

    function resize() {
      const rect = img.getBoundingClientRect()
      lc.width = Math.round(rect.width)
      lc.height = Math.round(rect.height)
    }

    function pickLaserPair() {
      const a = Math.floor(Math.random() * LASER_ANCHORS.length)
      let b = a
      for (let tries = 0; tries < 20; tries++) {
        b = Math.floor(Math.random() * LASER_ANCHORS.length)
        if (b === a) continue
        const gap = Math.abs(a - b)
        if (gap >= 1 && gap <= 4) break
      }
      return [LASER_ANCHORS[Math.min(a, b)], LASER_ANCHORS[Math.max(a, b)]]
    }

    function spawnLaserBolt(W, H) {
      const [from, to] = pickLaserPair()
      const pts = generateBolt(from.x * W, from.y * H, to.x * W, to.y * H, 5)
      laserBolts.push({
        pts, life: 1.0, phase: 'flash',
        flashTimer: 0.03 + Math.random() * 0.05,
        fadeRate: 0.04 + Math.random() * 0.03,
        from, to, W, H,
      })
    }

    let lastTime = performance.now()
    let elapsed = 0

    function draw(now) {
      const dt = (now - lastTime) / 1000
      lastTime = now
      elapsed += dt * 1000

      const W = lc.width, H = lc.height
      lctx.clearRect(0, 0, W, H)

      if (elapsed >= nextLaser) {
        spawnLaserBolt(W, H)
        elapsed = 0
        nextLaser = 60 + Math.random() * 180
        if (Math.random() < 0.5) {
          setTimeout(() => spawnLaserBolt(W, H), 20 + Math.random() * 40)
        }
      }

      for (let i = laserBolts.length - 1; i >= 0; i--) {
        const b = laserBolts[i]
        if (b.phase === 'flash') {
          b.flashTimer -= dt
          if (b.flashTimer <= 0) {
            b.phase = 'fade'
            b.pts = generateBolt(b.from.x * W, b.from.y * H, b.to.x * W, b.to.y * H, 5)
          }
        } else {
          b.life -= b.fadeRate
          if (b.life <= 0) { laserBolts.splice(i, 1); continue }
        }
      }

      lctx.save()
      lctx.globalCompositeOperation = 'lighter'
      for (const b of laserBolts) {
        const alpha = b.phase === 'flash'
          ? 0.6 + Math.random() * 0.4
          : b.life * 0.5

        lctx.shadowColor = `rgba(80,200,255,${alpha * 0.9})`
        lctx.shadowBlur = 25
        lctx.strokeStyle = `rgba(40,160,255,${alpha * 0.2})`
        lctx.lineWidth = 8
        lctx.beginPath()
        lctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) lctx.lineTo(b.pts[i].x, b.pts[i].y)
        lctx.stroke()

        lctx.shadowColor = `rgba(120,220,255,${alpha * 0.95})`
        lctx.shadowBlur = 12
        lctx.strokeStyle = `rgba(100,200,255,${alpha * 0.55})`
        lctx.lineWidth = 3
        lctx.beginPath()
        lctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) lctx.lineTo(b.pts[i].x, b.pts[i].y)
        lctx.stroke()

        lctx.shadowBlur = 4
        lctx.strokeStyle = `rgba(220,245,255,${alpha})`
        lctx.lineWidth = 1.2
        lctx.beginPath()
        lctx.moveTo(b.pts[0].x, b.pts[0].y)
        for (let i = 1; i < b.pts.length; i++) lctx.lineTo(b.pts[i].x, b.pts[i].y)
        lctx.stroke()
        lctx.shadowBlur = 0

        if (b.phase === 'flash') {
          const gx = (b.pts[0].x + b.pts[b.pts.length - 1].x) * 0.5
          const gy = (b.pts[0].y + b.pts[b.pts.length - 1].y) * 0.5
          const g = lctx.createRadialGradient(gx, gy, 0, gx, gy, 18)
          g.addColorStop(0, `rgba(180,240,255,${alpha * 0.4})`)
          g.addColorStop(1, 'transparent')
          lctx.fillStyle = g
          lctx.beginPath()
          lctx.arc(gx, gy, 18, 0, Math.PI * 2)
          lctx.fill()
        }
      }
      lctx.restore()

      laserRafRef.current = requestAnimationFrame(draw)
    }

    resize()
    laserRafRef.current = requestAnimationFrame(draw)
    const handleResize = () => resize()
    window.addEventListener('resize', handleResize)
    return () => {
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [animated])

  // Heavy metal thunderstorm — rain, cloud flashes, lightning bolts
  useEffect(() => {
    if (!animated || !bgCanvasRef.current) return
    const canvas = bgCanvasRef.current
    const ctx = canvas.getContext('2d')

    let bolts = []
    let cloudFlashes = []
    let rainDrops = []
    let nextStrike = 1500 + Math.random() * 3000
    let nextCloudFlash = 500 + Math.random() * 2000

    const RAIN_COUNT = 350
    const RAIN_ANGLE = 0.18
    const RAIN_SPEED_MIN = 600
    const RAIN_SPEED_MAX = 1200
    const RAIN_LEN_MIN = 15
    const RAIN_LEN_MAX = 40

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initRain()
    }

    function initRain() {
      rainDrops = []
      const W = canvas.width, H = canvas.height
      for (let i = 0; i < RAIN_COUNT; i++) {
        rainDrops.push({
          x: Math.random() * (W + 200) - 100,
          y: Math.random() * H,
          speed: RAIN_SPEED_MIN + Math.random() * (RAIN_SPEED_MAX - RAIN_SPEED_MIN),
          len: RAIN_LEN_MIN + Math.random() * (RAIN_LEN_MAX - RAIN_LEN_MIN),
          opacity: 0.08 + Math.random() * 0.18,
          width: 0.5 + Math.random() * 1.0,
        })
      }
    }

    function spawnBranches(pts, depth, maxDepth) {
      if (depth >= maxDepth) return []
      const branches = []
      const count = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(pts.length * (0.15 + Math.random() * 0.7))
        if (idx >= pts.length) continue
        const origin = pts[idx]
        const mainDx = pts[pts.length - 1].x - pts[0].x
        const mainDy = pts[pts.length - 1].y - pts[0].y
        const mainAng = Math.atan2(mainDy, mainDx)
        const brAng = mainAng + (Math.random() < 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.8)
        const brLen = 50 + Math.random() * 180
        const brPts = generateBolt(origin.x, origin.y, origin.x + Math.cos(brAng) * brLen, origin.y + Math.sin(brAng) * brLen, 4)
        branches.push({ pts: brPts, width: 0.6 })
        for (const sb of spawnBranches(brPts, depth + 1, maxDepth)) {
          sb.width *= 0.5
          branches.push(sb)
        }
      }
      return branches
    }

    function spawnBolt() {
      const W = canvas.width, H = canvas.height
      const x1 = W * (0.05 + Math.random() * 0.9)
      const x2 = x1 + (Math.random() - 0.5) * 300
      const y2 = H * (0.4 + Math.random() * 0.55)
      const pts = generateBolt(x1, -30, x2, y2, 6)
      const branches = spawnBranches(pts, 0, 3)
      bolts.push({
        pts, branches, life: 1.0, phase: 'flash',
        flashTimer: 0.12 + Math.random() * 0.12,
        fadeRate: 0.006 + Math.random() * 0.008,
        cloudX: x1 / W,
        cloudY: 0.05 + Math.random() * 0.15,
      })
      cloudFlashes.push({
        x: x1 / W, y: 0.05 + Math.random() * 0.15,
        radius: 0.15 + Math.random() * 0.2,
        life: 1.0, decay: 0.03 + Math.random() * 0.02,
      })
    }

    function spawnCloudFlash() {
      cloudFlashes.push({
        x: 0.1 + Math.random() * 0.8,
        y: 0.02 + Math.random() * 0.18,
        radius: 0.1 + Math.random() * 0.25,
        life: 1.0, decay: 0.04 + Math.random() * 0.03,
      })
    }

    function drawBoltPath(pts, alpha, widthScale) {
      ctx.shadowColor = `rgba(180,160,255,${alpha * 0.35})`
      ctx.shadowBlur = 30 * widthScale
      ctx.strokeStyle = `rgba(140,120,220,${alpha * 0.1})`
      ctx.lineWidth = 12 * widthScale
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y)
      ctx.stroke()

      ctx.shadowColor = `rgba(200,190,255,${alpha * 0.6})`
      ctx.shadowBlur = 14 * widthScale
      ctx.strokeStyle = `rgba(210,200,255,${alpha * 0.35})`
      ctx.lineWidth = 3.5 * widthScale
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y)
      ctx.stroke()

      ctx.shadowBlur = 4 * widthScale
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`
      ctx.lineWidth = 1.2 * widthScale
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    let lastTime = performance.now()
    let elapsed = 0
    let cloudElapsed = 0

    function draw(now) {
      const dt = (now - lastTime) / 1000
      lastTime = now
      elapsed += dt * 1000
      cloudElapsed += dt * 1000
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // --- Cloud illumination flashes ---
      for (let i = cloudFlashes.length - 1; i >= 0; i--) {
        const cf = cloudFlashes[i]
        cf.life -= cf.decay
        if (cf.life <= 0) { cloudFlashes.splice(i, 1); continue }

        const cx = cf.x * W, cy = cf.y * H
        const r = cf.radius * W
        const flicker = 0.7 + Math.random() * 0.3
        const a = cf.life * flicker * 0.12

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0, `rgba(160,140,220,${a})`)
        grad.addColorStop(0.3, `rgba(100,80,180,${a * 0.6})`)
        grad.addColorStop(0.6, `rgba(60,50,120,${a * 0.25})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      }

      // --- Diagonal rain ---
      ctx.save()
      const rainFlashBoost = cloudFlashes.length > 0 ? 1.5 : 1.0
      for (let i = 0; i < rainDrops.length; i++) {
        const d = rainDrops[i]
        d.y += d.speed * dt
        d.x -= d.speed * RAIN_ANGLE * dt

        if (d.y > H + 50) {
          d.y = -d.len - Math.random() * 100
          d.x = Math.random() * (W + 200) - 100
        }
        if (d.x < -100) {
          d.x = W + Math.random() * 50
        }

        const ex = d.x - Math.sin(RAIN_ANGLE) * d.len
        const ey = d.y + Math.cos(RAIN_ANGLE) * d.len
        const o = d.opacity * rainFlashBoost

        ctx.strokeStyle = `rgba(160,180,220,${o})`
        ctx.lineWidth = d.width
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      ctx.restore()

      // --- Spawn new lightning bolts ---
      if (elapsed >= nextStrike) {
        spawnBolt()
        elapsed = 0
        nextStrike = 2500 + Math.random() * 4500
      }

      // --- Spawn independent cloud flashes ---
      if (cloudElapsed >= nextCloudFlash) {
        spawnCloudFlash()
        cloudElapsed = 0
        nextCloudFlash = 800 + Math.random() * 3000
      }

      // --- Draw lightning bolts ---
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]
        let alpha
        if (b.phase === 'flash') {
          b.flashTimer -= dt
          alpha = 0.5 + Math.random() * 0.5
          if (b.flashTimer <= 0) b.phase = 'fade'
        } else {
          b.life -= b.fadeRate
          if (b.life <= 0) { bolts.splice(i, 1); continue }
          alpha = b.life * 0.45
        }

        drawBoltPath(b.pts, alpha, 1)
        for (const br of b.branches) {
          drawBoltPath(br.pts, alpha * 0.5, br.width)
        }
      }
      ctx.restore()

      bgRafRef.current = requestAnimationFrame(draw)
    }

    resize()
    bgRafRef.current = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      if (bgRafRef.current) cancelAnimationFrame(bgRafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [animated])

  // Random anime shimmer across logo — occasionally fires a double-sweep
  useEffect(() => {
    if (!animated) return
    let timer
    function sweepEl(el, width, duration) {
      el.style.width = width + '%'
      el.style.transition = 'none'
      el.style.left = '-120%'
      el.style.opacity = '1'
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `left ${duration}s ease-in-out, opacity ${duration}s ease-in-out`
          el.style.left = '120%'
          setTimeout(() => { el.style.opacity = '0' }, duration * 750)
        })
      })
    }
    function triggerShimmer() {
      const el = shimmerRef.current
      const el2 = shimmer2Ref.current
      if (el) {
        const w1 = 40 + Math.random() * 40
        sweepEl(el, w1, 0.35 + Math.random() * 0.15)
        if (el2 && Math.random() < 0.35) {
          const w2 = 20 + Math.random() * 30
          const gap = 60 + Math.random() * 120
          setTimeout(() => sweepEl(el2, w2, 0.3 + Math.random() * 0.15), gap)
        }
      }
      timer = setTimeout(triggerShimmer, 3000 + Math.random() * 6000)
    }
    timer = setTimeout(triggerShimmer, 1500 + Math.random() * 2000)
    return () => clearTimeout(timer)
  }, [animated])

  const enterAsGuest = () => {
    try { localStorage.setItem('dtool-dark-mode', 'true') } catch {}
    onEnter()
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        try { localStorage.setItem('dtool-dark-mode', 'true') } catch {}
        onEnter()
      } else {
        setError(data.error || 'Login failed')
        setLoginLoading(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoginLoading(false)
    }
  }

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)' }}
    >
      {/* Dark roiling cloud layers */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 20% 10%, rgba(30,20,50,0.9) 0%, transparent 60%), radial-gradient(ellipse at 80% 15%, rgba(25,15,45,0.85) 0%, transparent 55%), radial-gradient(ellipse at 50% 5%, rgba(35,25,55,0.8) 0%, transparent 50%)',
          animation: 'cloudDrift 12s ease-in-out infinite',
        }} />
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 65% 8%, rgba(20,15,40,0.7) 0%, transparent 45%), radial-gradient(ellipse at 35% 12%, rgba(28,18,48,0.6) 0%, transparent 50%)',
          animation: 'cloudDrift 18s ease-in-out 3s infinite reverse',
        }} />
      </div>

      {/* Animated background energy */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.3) 0%, transparent 50%)',
          animation: 'energySwirl 8s ease-in-out infinite',
          zIndex: 1,
        }}
      />

      {/* Thunderstorm canvas — rain, cloud flashes, lightning */}
      {animated && (
        <canvas ref={bgCanvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} />
      )}

      {/* Content wrapper */}
      <div
        ref={contentRef}
        className="flex flex-col items-center relative"
        style={{ zIndex: 10 }}
      >

      {/* Logo with lightning overlay */}
      <div className="relative mb-8">

        <div ref={logoWrapRef} className="relative" style={{ display: 'inline-block' }}>
          <img
            ref={logoRef}
            src="/lazerclaw_logo.png"
            alt="LazerClaw"
            className={animated ? 'welcome-logo-glow' : ''}
            style={{
              display: 'block', height: 350, maxWidth: '90vw', objectFit: 'contain',
              animation: cameFromIntro.current
                ? (animated ? 'logoGlitchIn 0.7s ease-out forwards, welcomeLogoGlow 6s ease-in-out 0.7s infinite' : 'none')
                : (animated ? 'logoFadeIn 0.6s ease-out forwards, welcomeLogoGlow 6s ease-in-out 0.6s infinite' : 'none'),
              opacity: cameFromIntro.current ? (animated ? 1 : 0) : (animated ? 1 : 0),
            }}
          />
          {animated && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                WebkitMaskImage: 'url(/lazerclaw_logo.png)',
                maskImage: 'url(/lazerclaw_logo.png)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                overflow: 'hidden',
              }}
            >
              <div
                ref={shimmerRef}
                className="absolute pointer-events-none"
                style={{
                  top: '-20%',
                  left: '-120%',
                  width: '60%',
                  height: '140%',
                  background: 'linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,255,255,0.15) 38%, rgba(255,255,255,0.35) 44%, rgba(255,255,255,0.8) 48%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.8) 52%, rgba(255,255,255,0.35) 56%, rgba(255,255,255,0.15) 62%, transparent 70%, transparent 100%)',
                  transform: 'skewX(-15deg)',
                  opacity: 0,
                  filter: 'blur(2px)',
                }}
              />
              <div
                ref={shimmer2Ref}
                className="absolute pointer-events-none"
                style={{
                  top: '-20%',
                  left: '-120%',
                  width: '35%',
                  height: '140%',
                  background: 'linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0.28) 44%, rgba(255,255,255,0.65) 48%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.65) 52%, rgba(255,255,255,0.28) 56%, rgba(255,255,255,0.12) 62%, transparent 70%, transparent 100%)',
                  transform: 'skewX(-15deg)',
                  opacity: 0,
                  filter: 'blur(2px)',
                }}
              />
            </div>
          )}
          {animated && (
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateY(20px) scale(1.05)', transformOrigin: 'center center' }} />
          )}
          {animated && (
            <canvas ref={canvas2Ref} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateY(-5px) scale(0.63)', transformOrigin: 'center center' }} />
          )}
          {animated && (
            <canvas ref={laserCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          )}
        
        </div>

      </div>

      {/* Login Form */}
      <form
        ref={formRef}
        onSubmit={handleLogin}
        className="relative rounded-2xl p-8 w-[480px] max-w-[90vw] flex flex-col gap-4"
        style={{
          background: 'rgba(15, 15, 25, 0.9)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 0 80px rgba(6, 182, 212, 0.1), 0 25px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          ...(cameFromIntro.current ? {
            animation: animated ? 'fadeSlideUp 0.9s ease-out 0.3s both' : 'none',
          } : {
            animation: animated ? 'fadeSlideUp 0.6s ease-out 0.4s both' : 'none',
          }),
        }}
      >
        {/* Tagline */}
        <div className="text-center mb-1">
          <div className="text-[15px] tracking-wider"
            style={{ fontFamily: "'Metal Mania', cursive", background: 'linear-gradient(180deg, #e8e8e8 0%, #ffffff 20%, #b8b8b8 40%, #8a8a8a 50%, #b8b8b8 60%, #ffffff 80%, #d0d0d0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            The World's First &amp; Only Heavy Metal
          </div>
          <div className="text-[15px] tracking-wider"
            style={{ fontFamily: "'Metal Mania', cursive", background: 'linear-gradient(180deg, #e8e8e8 0%, #ffffff 20%, #b8b8b8 40%, #8a8a8a 50%, #b8b8b8 60%, #ffffff 80%, #d0d0d0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Design Tool Made for Lobsters™
          </div>
        </div>

        {/* Primary CTA - Use as Guest */}
        <button
          type="button"
          onClick={enterAsGuest}
          className="w-full rounded py-3.5 text-[21px] font-black uppercase transition-all duration-200 hover:scale-105 active:scale-[0.98] relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
            color: '#fff',
            border: '2px solid #c0c0d0',
            boxShadow: '0 0 15px rgba(120,80,210,0.7), inset 0 2px 2px rgba(255,255,255,0.8), inset 0 -2px 5px rgba(0,0,0,0.5)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            letterSpacing: '2px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.filter = 'brightness(1.2)'
            e.currentTarget.style.boxShadow = '0 0 25px rgba(120,80,210,0.9)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.filter = ''
            e.currentTarget.style.boxShadow = '0 0 15px rgba(120,80,210,0.7), inset 0 2px 2px rgba(255,255,255,0.8), inset 0 -2px 5px rgba(0,0,0,0.5)'
          }}
        >
          Use as Guest
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%',
              background: 'linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.4) 48%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.4) 52%, rgba(255,255,255,0.1) 60%, transparent 70%, transparent 100%)',
              animation: 'guestChromeShimmer 5s ease-in-out infinite',
              filter: 'blur(1px)',
            }} />
          </div>
        </button>
        <style>{`
          @keyframes guestChromeShimmer {
            0% { left: -100%; opacity: 0; }
            70% { left: -100%; opacity: 0; }
            73% { opacity: 1; }
            85% { left: 200%; opacity: 1; }
            88% { left: 200%; opacity: 0; }
            100% { left: 200%; opacity: 0; }
          }
        `}</style>

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

        {/* Secondary CTA - Login */}
        <button
          type="submit"
          disabled={loginLoading}
          className="w-full rounded-lg py-3 text-[21px] font-semibold transition-all duration-200"
          style={{
            background: 'transparent',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            color: '#a78bfa',
            opacity: loginLoading ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (!loginLoading) {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.8)'
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'
              e.currentTarget.style.color = '#c4b5fd'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#a78bfa'
          }}
        >
          {loginLoading ? 'Signing in...' : 'Login'}
        </button>
      </form>

      </div>{/* end content wrapper */}

      {/* About link footer */}
      <div
        className="absolute bottom-6 text-center"
        style={cameFromIntro.current ? {
          animation: animated ? 'fadeSlideUp 0.8s ease-out 0.6s both' : 'none',
        } : {}}
      >
        <button
          onClick={onShowAbout}
          className="transition-all duration-200"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11, letterSpacing: '0.08em' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.textShadow = '0 0 10px rgba(139, 92, 246, 0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.textShadow = 'none' }}
        >
          About LazerClaw
        </button>
      </div>
    </div>
  )
}

function Root() {
  const isAdminRoute = window.location.pathname === '/admin'
  const isAiToolsRoute = window.location.pathname === '/aitools'
  const introSeen = !isAdminRoute && !isAiToolsRoute && !sessionStorage.getItem('lazerclaw-intro-seen')

  const [showIntro, setShowIntro] = useState(introSeen)
  const [introComplete, setIntroComplete] = useState(!introSeen)
  const [enteredApp, setEnteredApp] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [adminAuth, setAdminAuth] = useState(false)
  const [theme] = useState(() => {
    try { return localStorage.getItem('dtool-theme') || 'default' } catch { return 'default' }
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const handleIntroComplete = () => {
    sessionStorage.setItem('lazerclaw-intro-seen', '1')
    setShowIntro(false)
    setIntroComplete(true)
  }

  // Admin route - requires login
  if (isAdminRoute) {
    if (!adminAuth) {
      return <AdminLogin onAuth={() => setAdminAuth(true)} />
    }
    return <AdminPanel onClose={() => { setAdminAuth(false); window.location.href = '/' }} />
  }

  if (isAiToolsRoute) return <AiToolsPage />

  // About page
  if (showAbout) {
    return <AboutPage onBack={() => setShowAbout(false)} />
  }

  // Welcome page + intro layered together for seamless transition
  if (showIntro || (!enteredApp && !showAbout)) {
    return (
      <>
        {!enteredApp && (
          <WelcomePage
            onEnter={() => setEnteredApp(true)}
            onShowAbout={() => setShowAbout(true)}
            introActive={showIntro}
          />
        )}
        {showIntro && <LightningIntro onComplete={handleIntroComplete} />}
      </>
    )
  }

  // Main app - no auth required, no data collection
  return <App />
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<Root />)
