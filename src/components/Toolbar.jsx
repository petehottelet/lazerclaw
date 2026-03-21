import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Textbox, Group, FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import DownloadButton from './DownloadButton'

import { ActiveSelection } from 'fabric'
import { applyTiling, removeTiling, removeOrphanedTileClones } from '../utils/tiling'
import { PEN_SUB_TOOLS } from '../utils/penTool'
import BloodFill from './BloodFill'
import LaserSmokeMachine from './LaserSmokeMachine'

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)] }

const LOGOUT_TEXTS = [
  { title: 'Heads up, shredder!', body: 'Your current session will be cleared and any unsaved designs will vanish into the void.', warning: 'Download anything you wanna keep before you bail.', cancel: 'Cancel', confirm: 'Peace Out' },
  { title: 'Whoa there, roadie!', body: 'Leaving now means your entire masterpiece gets fed to the abyss. No encores.', warning: 'Save your work or lose it forever, dude.', cancel: 'Stay', confirm: 'Rage Quit' },
  { title: 'Abandon ship, Captain?', body: "The Claw's gonna miss you. Everything on this canvas will be swallowed by the deep.", warning: "Seriously, download first unless you're cool with total destruction.", cancel: 'Nah', confirm: 'Later, Claw' },
  { title: "You're really leaving?", body: "All your sick designs, gone like a guitar solo in the wind. The lobsters will weep.", warning: "Hit download if you don't want your art to become ocean floor debris.", cancel: 'Wait', confirm: 'Catch Ya' },
  { title: 'End of the line, metalhead!', body: "This session's about to get nuked harder than a drum solo finale. Everything goes.", warning: 'Last chance to save your creations, bro.', cancel: 'Hold Up', confirm: 'Shred Out' },
  { title: 'Dropping the mic?', body: "Once you leave, this canvas gets wiped cleaner than a freshly polished Gibson.", warning: "Don't forget to download your bangers first.", cancel: 'Not Yet', confirm: 'Drop It' },
  { title: 'Fleeing the stage?', body: "Your unsaved designs will dissolve like smoke from a fog machine. Poof. Gone.", warning: 'Export your work before the curtain falls.', cancel: 'Encore', confirm: 'Exit Stage Left' },
  { title: 'Logging out, legend?', body: "Everything you've built here lives only in this session. Walk away and it all fades to black.", warning: 'Download your designs before you vanish into the night.', cancel: 'Stay Metal', confirm: 'Peace Out' },
  { title: 'Pulling the plug?', body: "Like unplugging the amp mid-solo — your session, your designs, all gone in a flash.", warning: "Save now or forever hold your peace, shredder.", cancel: 'Keep Rocking', confirm: 'Unplug' },
  { title: "Surf's up... and out?", body: "The Claw respects your decision, but your canvas art is about to become fish food.", warning: "Download what you love before riding this wave outta here.", cancel: 'Paddle Back', confirm: 'Ride Out' },
]

// ─── LOGO LIGHTNING EFFECT ──────────────────────────────────────────────────
function generateLogoBolt(x1, y1, x2, y2, detail = 4) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  let offset = len * 0.3

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
    offset *= 0.55
  }
  return pts
}

function LogoLightning({ width, height, darkMode }) {
  const canvasRef = useRef(null)
  const edgePointsRef = useRef([])
  const logoLoadedRef = useRef(false)

  // Load logo and extract edge points
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      try {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.round(width * 2)
        tempCanvas.height = Math.round(height * 2)
        const tempCtx = tempCanvas.getContext('2d')
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height)

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
        const data = imageData.data
        const w = tempCanvas.width
        const h = tempCanvas.height

        const edges = []
        const alphaThreshold = 50

        for (let y = 1; y < h - 1; y += 2) {
          for (let x = 1; x < w - 1; x += 2) {
            const idx = (y * w + x) * 4
            const alpha = data[idx + 3]

            if (alpha > alphaThreshold) {
              const neighbors = [
                data[((y - 1) * w + x) * 4 + 3],
                data[((y + 1) * w + x) * 4 + 3],
                data[(y * w + x - 1) * 4 + 3],
                data[(y * w + x + 1) * 4 + 3],
              ]
              const hasTransparentNeighbor = neighbors.some(a => a < alphaThreshold)
              if (hasTransparentNeighbor) {
                edges.push({ x: x / 2, y: y / 2 })
              }
            }
          }
        }

        const sampledEdges = []
        for (let i = 0; i < edges.length; i += 3) {
          sampledEdges.push(edges[i])
        }
        edgePointsRef.current = sampledEdges
        logoLoadedRef.current = true
      } catch (e) {
        console.warn('Logo edge detection failed:', e)
      }
    }
    img.onerror = () => console.warn('Failed to load logo for edge detection')
    img.src = '/lazerclaw_logo.png'
  }, [width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    let frameCount = 0
    let perimeterBolts = []
    let lastBoltTime = 0

    // Set canvas size with higher resolution
    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    function draw() {
      frameCount++
      const now = Date.now()
      ctx.clearRect(0, 0, width, height)

      if (!darkMode) {
        rafId = requestAnimationFrame(draw)
        return
      }

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Dragon mouth position (approx 62.5% from left, 39% from top)
      const mouthX = width * 0.625
      const mouthY = height * 0.39
      // Laser tip (approx 89.5% from left, 21% from top)
      const tipX = width * 0.895
      const tipY = height * 0.21

      // Main laser bolt - always visible, regenerates for electric effect
      if (frameCount % 2 === 0) {
        const bolt = generateLogoBolt(mouthX, mouthY, tipX, tipY, 5)
        const intensity = 0.1

        // Pass 1 – outer glow
        ctx.shadowColor = `rgba(100,160,255,${intensity})`
        ctx.shadowBlur = 3.5
        ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.35})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(bolt[0].x, bolt[0].y)
        for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i].x, bolt[i].y)
        ctx.stroke()

        // Pass 2 – mid core
        ctx.shadowColor = `rgba(130,190,255,${intensity})`
        ctx.shadowBlur = 2
        ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.7})`
        ctx.lineWidth = 0.4
        ctx.beginPath()
        ctx.moveTo(bolt[0].x, bolt[0].y)
        for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i].x, bolt[i].y)
        ctx.stroke()

        // Pass 3 – bright core
        ctx.shadowColor = `rgba(200,225,255,${intensity})`
        ctx.shadowBlur = 0.8
        ctx.strokeStyle = `rgba(230,240,255,${intensity})`
        ctx.lineWidth = 0.15
        ctx.beginPath()
        ctx.moveTo(bolt[0].x, bolt[0].y)
        for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i].x, bolt[i].y)
        ctx.stroke()

        ctx.shadowBlur = 0
      }

      // Perimeter lightning bolts around logo edges
      if (logoLoadedRef.current && edgePointsRef.current.length > 10) {
        const edges = edgePointsRef.current

        // Spawn new perimeter bolts periodically
        if (now - lastBoltTime > 80 && perimeterBolts.length < 6) {
          const startIdx = Math.floor(Math.random() * edges.length)
          const segLen = 8 + Math.floor(Math.random() * 15)
          const direction = Math.random() > 0.5 ? 1 : -1

          perimeterBolts.push({
            startIdx,
            segLen,
            direction,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.02
          })
          lastBoltTime = now
        }

        // Draw and update perimeter bolts
        perimeterBolts = perimeterBolts.filter(bolt => {
          bolt.life -= bolt.decay
          if (bolt.life <= 0) return false

          const alpha = bolt.life * 0.1
          ctx.shadowColor = `rgba(100,180,255,${alpha})`
          ctx.shadowBlur = 1.2
          ctx.strokeStyle = `rgba(150,200,255,${alpha * 0.6})`
          ctx.lineWidth = 0.2
          ctx.beginPath()

          let first = true
          for (let i = 0; i < bolt.segLen; i++) {
            let idx = bolt.startIdx + i * bolt.direction
            // Wrap around
            while (idx < 0) idx += edges.length
            idx = idx % edges.length

            const pt = edges[idx]
            // Add small jitter for electric effect
            const jitterX = (Math.random() - 0.5) * 2
            const jitterY = (Math.random() - 0.5) * 2

            if (first) {
              ctx.moveTo(pt.x + jitterX, pt.y + jitterY)
              first = false
            } else {
              ctx.lineTo(pt.x + jitterX, pt.y + jitterY)
            }
          }
          ctx.stroke()

          // Bright core
          ctx.shadowBlur = 0.4
          ctx.strokeStyle = `rgba(220,240,255,${alpha * 0.8})`
          ctx.lineWidth = 0.08
          ctx.stroke()

          return true
        })
      }

      // Glow at mouth
      const glowGrad = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, 4)
      glowGrad.addColorStop(0, 'rgba(100,160,255,0.04)')
      glowGrad.addColorStop(0.5, 'rgba(130,190,255,0.02)')
      glowGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(mouthX, mouthY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Glow at tip
      const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 3)
      tipGrad.addColorStop(0, 'rgba(200,225,255,0.06)')
      tipGrad.addColorStop(0.5, 'rgba(100,160,255,0.03)')
      tipGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = tipGrad
      ctx.beginPath()
      ctx.arc(tipX, tipY, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(rafId)
  }, [width, height, darkMode])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
        pointerEvents: 'none',
      }}
    />
  )
}

const ToggleRow = ({ label, checked, onChange, color, disabled, dm }) => (
  <label className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors ${
    disabled ? 'opacity-40 cursor-not-allowed' : (dm ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
  }`}>
    <span className={`flex items-center gap-2 text-xs ${dm ? 'text-gray-200' : 'text-gray-700'}`}>
      {color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </span>
    <div className="relative inline-flex items-center">
      <input type="checkbox" checked={checked} onChange={disabled ? undefined : onChange} disabled={disabled} className="sr-only" />
      <div className={`w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-blue-500' : dm ? 'bg-gray-600' : 'bg-gray-300'
      }`}>
        <div className={`absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full shadow transition-transform ${
          checked ? 'translate-x-4 bg-white' : (dm ? 'translate-x-0 bg-gray-300' : 'translate-x-0 bg-white')
        }`} />
      </div>
    </div>
  </label>
)

const OffsetInput = ({ label, value, onChange, dm, step }) => {
  const [local, setLocal] = React.useState(value)
  const [editing, setEditing] = React.useState(false)
  React.useEffect(() => { if (!editing) setLocal(value) }, [value, editing])
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[9px] font-medium ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
      <input
        type="number" min={0} step={step || 0.01}
        value={editing ? local : value}
        onFocus={() => setEditing(true)}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { setEditing(false); onChange(local) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onChange(local) } }}
        className={`w-14 text-center text-[11px] tabular-nums py-1 rounded-md border outline-none transition-colors ${
          dm ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-400'
             : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-400'
        }`}
      />
    </div>
  )
}

function BloodRainOverlay() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    let rafId

    const resize = () => {
      cvs.width = window.innerWidth
      cvs.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const drops = []
    const splashes = []
    const MAX_DROPS = 300

    function spawnDrop() {
      drops.push({
        x: Math.random() * cvs.width,
        y: -10 - Math.random() * 80,
        len: 18 + Math.random() * 35,
        w: 1 + Math.random() * 2.5,
        speed: 600 + Math.random() * 800,
        drift: (Math.random() - 0.5) * 30,
        alpha: 0.4 + Math.random() * 0.5,
        hue: Math.random() < 0.3 ? 0 : (355 + Math.random() * 10) % 360,
      })
    }

    function spawnSplash(x, y) {
      const count = 2 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        splashes.push({
          x, y,
          vx: (Math.random() - 0.5) * 120,
          vy: -40 - Math.random() * 80,
          r: 1 + Math.random() * 2.5,
          life: 1.0,
          decay: 2.5 + Math.random() * 2,
        })
      }
    }

    let lastTime = performance.now()
    let spawnAcc = 0

    function draw(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      ctx.clearRect(0, 0, cvs.width, cvs.height)

      spawnAcc += dt
      const spawnRate = 500
      while (spawnAcc > 0 && drops.length < MAX_DROPS) {
        spawnDrop()
        spawnAcc -= 1 / spawnRate
      }
      if (spawnAcc > 0) spawnAcc = 0

      ctx.lineCap = 'round'
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.y += d.speed * dt
        d.x += d.drift * dt

        const grad = ctx.createLinearGradient(d.x, d.y - d.len, d.x, d.y)
        grad.addColorStop(0, `hsla(${d.hue},90%,25%,0)`)
        grad.addColorStop(0.3, `hsla(${d.hue},85%,30%,${d.alpha * 0.6})`)
        grad.addColorStop(1, `hsla(${d.hue},80%,35%,${d.alpha})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = d.w
        ctx.beginPath()
        ctx.moveTo(d.x, d.y - d.len)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()

        ctx.shadowColor = `hsla(${d.hue},100%,40%,${d.alpha * 0.4})`
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.w * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${d.hue},90%,45%,${d.alpha * 0.8})`
        ctx.fill()
        ctx.shadowBlur = 0

        if (d.y > cvs.height) {
          spawnSplash(d.x, cvs.height - 2)
          drops.splice(i, 1)
        }
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]
        s.x += s.vx * dt
        s.vy += 300 * dt
        s.y += s.vy * dt
        s.life -= s.decay * dt
        if (s.life <= 0 || s.y > cvs.height + 10) { splashes.splice(i, 1); continue }

        ctx.globalAlpha = s.life * 0.7
        ctx.fillStyle = `hsla(0,85%,32%,1)`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}

function SizeMenuBlood() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const cvs = canvasRef.current
    if (!cvs || !container) return
    const ctx = cvs.getContext('2d')
    let rafId

    const resize = () => {
      const r = container.getBoundingClientRect()
      cvs.width = r.width
      cvs.height = r.height
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const drops = []
    const splashes = []

    function spawnDrop() {
      drops.push({
        x: Math.random() * cvs.width,
        y: -5 - Math.random() * 30,
        len: 10 + Math.random() * 22,
        w: 0.6 + Math.random() * 1.5,
        speed: 200 + Math.random() * 350,
        drift: (Math.random() - 0.5) * 12,
        alpha: 0.35 + Math.random() * 0.45,
      })
    }

    function spawnSplash(x, y) {
      const n = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) {
        splashes.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, r: 0.5 + Math.random() * 1.5, life: 1, decay: 3 + Math.random() * 2 })
      }
    }

    const WAVE_N = 80
    const waveH = new Float32Array(WAVE_N)
    const waveV = new Float32Array(WAVE_N)
    let poolLevel = 0
    const poolTarget = 0.35
    let lastTime = performance.now()
    let spawnAcc = 0
    const bubbles = []

    function spawnBubble(x, baseY, H) {
      bubbles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: H - Math.random() * (H - baseY) * 0.6,
        r: 1 + Math.random() * 2.5,
        speed: 8 + Math.random() * 18,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 2 + Math.random() * 3,
        alpha: 0.15 + Math.random() * 0.25,
        baseY,
      })
    }

    function draw(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.04)
      lastTime = now
      const W = cvs.width, H = cvs.height
      ctx.clearRect(0, 0, W, H)

      if (poolLevel < poolTarget) poolLevel = Math.min(poolTarget, poolLevel + dt * 0.02)

      spawnAcc += dt
      const rate = 120
      while (spawnAcc > 0 && drops.length < 80) { spawnDrop(); spawnAcc -= 1 / rate }
      if (spawnAcc > 0) spawnAcc = 0

      const poolY = H - H * poolLevel

      ctx.lineCap = 'round'
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.y += d.speed * dt
        d.x += d.drift * dt
        if (d.y > poolY) {
          const wi = Math.floor((d.x / W) * WAVE_N)
          if (wi >= 0 && wi < WAVE_N) waveV[wi] -= 3 + Math.random() * 4
          spawnSplash(d.x, poolY)
          if (Math.random() < 0.3) spawnBubble(d.x, poolY, H)
          drops.splice(i, 1)
          continue
        }
        const grad = ctx.createLinearGradient(d.x, d.y - d.len, d.x, d.y)
        grad.addColorStop(0, `rgba(140,0,0,0)`)
        grad.addColorStop(0.3, `rgba(170,0,0,${d.alpha * 0.5})`)
        grad.addColorStop(1, `rgba(200,10,10,${d.alpha})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = d.w
        ctx.beginPath()
        ctx.moveTo(d.x, d.y - d.len)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]
        s.x += s.vx * dt; s.vy += 150 * dt; s.y += s.vy * dt
        s.life -= s.decay * dt
        if (s.life <= 0 || s.y > H) { splashes.splice(i, 1); continue }
        ctx.globalAlpha = s.life * 0.6
        ctx.fillStyle = 'rgba(180,10,10,1)'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      const tension = 140, damping = 2.8, spread = 160
      for (let i = 0; i < WAVE_N; i++) {
        const left = i > 0 ? waveH[i - 1] : waveH[i]
        const right = i < WAVE_N - 1 ? waveH[i + 1] : waveH[i]
        waveV[i] += (-tension * waveH[i] + spread * (left + right - 2 * waveH[i]) - damping * waveV[i]) * dt
      }
      for (let i = 0; i < WAVE_N; i++) waveH[i] += waveV[i] * dt

      const sway = Math.sin(now * 0.0008) * 2.5 + Math.sin(now * 0.002) * 1.5 + Math.sin(now * 0.0035) * 0.8
      for (let i = 0; i < WAVE_N; i++) {
        const phase = (i / WAVE_N) * Math.PI * 2
        waveV[i] += (Math.sin(phase + now * 0.0025) * 0.6 + Math.sin(phase * 2.3 + now * 0.0014) * 0.35 + Math.sin(phase * 3.7 + now * 0.004) * 0.15) * dt * 60
      }

      if (poolLevel > 0) {
        const segW = W / WAVE_N

        function getWaveY(i) {
          const h = i < WAVE_N ? waveH[Math.max(0, i)] : waveH[WAVE_N - 1]
          return poolY + h + sway
        }

        // Meniscus height at walls (liquid climbs edges via surface tension)
        const meniscusH = 6
        const meniscusW = W * 0.08

        // Main blood body
        ctx.beginPath()
        const leftWY = getWaveY(0) - meniscusH
        ctx.moveTo(0, H)
        ctx.lineTo(0, leftWY)
        ctx.quadraticCurveTo(meniscusW * 0.3, getWaveY(0) - meniscusH * 0.3, meniscusW, getWaveY(Math.floor(WAVE_N * 0.08)))
        for (let i = Math.floor(WAVE_N * 0.08); i <= WAVE_N - Math.floor(WAVE_N * 0.08); i++) {
          ctx.lineTo(i * segW, getWaveY(i))
        }
        const rightEdge = WAVE_N - Math.floor(WAVE_N * 0.08)
        const rightWY = getWaveY(WAVE_N - 1) - meniscusH
        ctx.quadraticCurveTo(W - meniscusW * 0.3, getWaveY(WAVE_N - 1) - meniscusH * 0.3, W, rightWY)
        ctx.lineTo(W, H)
        ctx.closePath()
        const poolGrad = ctx.createLinearGradient(0, poolY - 4, 0, H)
        poolGrad.addColorStop(0, 'rgba(180,10,10,0.8)')
        poolGrad.addColorStop(0.15, 'rgba(150,5,5,0.88)')
        poolGrad.addColorStop(0.4, 'rgba(120,0,0,0.92)')
        poolGrad.addColorStop(0.7, 'rgba(80,0,0,0.96)')
        poolGrad.addColorStop(1, 'rgba(40,0,0,1)')
        ctx.fillStyle = poolGrad
        ctx.fill()

        // Sub-surface caustic pattern
        ctx.save()
        ctx.clip()
        for (let ci = 0; ci < 5; ci++) {
          const cx = W * 0.15 + (ci / 5) * W * 0.7 + Math.sin(now * 0.001 + ci * 1.3) * 15
          const cy = poolY + (H - poolY) * 0.4 + Math.sin(now * 0.0015 + ci * 0.9) * 8
          const cr = 8 + Math.sin(now * 0.002 + ci * 2) * 4
          const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
          cg.addColorStop(0, 'rgba(200,30,30,0.12)')
          cg.addColorStop(1, 'rgba(200,30,30,0)')
          ctx.fillStyle = cg
          ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2)
        }
        ctx.restore()

        // Specular highlight on surface (follows wave contour)
        ctx.beginPath()
        ctx.moveTo(0, leftWY)
        ctx.quadraticCurveTo(meniscusW * 0.3, getWaveY(0) - meniscusH * 0.3, meniscusW, getWaveY(Math.floor(WAVE_N * 0.08)))
        for (let i = Math.floor(WAVE_N * 0.08); i <= rightEdge; i++) {
          ctx.lineTo(i * segW, getWaveY(i))
        }
        ctx.quadraticCurveTo(W - meniscusW * 0.3, getWaveY(WAVE_N - 1) - meniscusH * 0.3, W, rightWY)
        ctx.lineTo(W, rightWY + 5)
        ctx.lineTo(0, leftWY + 5)
        ctx.closePath()
        const surfGrad = ctx.createLinearGradient(0, 0, W, 0)
        surfGrad.addColorStop(0, 'rgba(255,120,120,0.2)')
        surfGrad.addColorStop(0.2, 'rgba(255,160,160,0.08)')
        surfGrad.addColorStop(0.4, 'rgba(255,200,200,0.25)')
        surfGrad.addColorStop(0.6, 'rgba(255,180,180,0.15)')
        surfGrad.addColorStop(0.8, 'rgba(255,140,140,0.08)')
        surfGrad.addColorStop(1, 'rgba(255,120,120,0.2)')
        ctx.fillStyle = surfGrad
        ctx.fill()

        // Thick surface line for viscosity
        ctx.beginPath()
        ctx.moveTo(0, leftWY)
        ctx.quadraticCurveTo(meniscusW * 0.3, getWaveY(0) - meniscusH * 0.3, meniscusW, getWaveY(Math.floor(WAVE_N * 0.08)))
        for (let i = Math.floor(WAVE_N * 0.08); i <= rightEdge; i++) {
          ctx.lineTo(i * segW, getWaveY(i))
        }
        ctx.quadraticCurveTo(W - meniscusW * 0.3, getWaveY(WAVE_N - 1) - meniscusH * 0.3, W, rightWY)
        ctx.strokeStyle = 'rgba(220,40,40,0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Bubbles
        if (Math.random() < dt * 2) spawnBubble(Math.random() * W, poolY, H)
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i]
          b.y -= b.speed * dt
          b.wobble += b.wobbleSpeed * dt
          b.x += Math.sin(b.wobble) * 0.4
          b.alpha -= dt * 0.15
          if (b.y < b.baseY + sway || b.alpha <= 0) { bubbles.splice(i, 1); continue }
          ctx.beginPath()
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,120,120,${b.alpha})`
          ctx.lineWidth = 0.6
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,180,180,${b.alpha * 0.6})`
          ctx.fill()
        }
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden', borderRadius: 'inherit' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}

function NukeExplosion({ onComplete, onFlashPeak }) {
  const containerRef = useRef(null)
  const flashRef = useRef(null)
  const meltRef = useRef(null)
  const heatRef = useRef(null)
  const sparkRef = useRef(null)
  const peakFlashRef = useRef(null)
  const onCompleteRef = useRef(onComplete)
  const onFlashPeakRef = useRef(onFlashPeak)
  onCompleteRef.current = onComplete
  onFlashPeakRef.current = onFlashPeak

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    const run = async () => {
      const THREE = await import('three')
      const W = window.innerWidth, H = window.innerHeight
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      container.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 1000)
      camera.position.set(0, 5, 30)
      camera.lookAt(0, 5, 0)

      const ambLight = new THREE.AmbientLight(0xff8844, 4)
      scene.add(ambLight)
      const ptLight = new THREE.PointLight(0xffaa44, 0, 120)
      scene.add(ptLight)
      const capLight = new THREE.PointLight(0xff6600, 0, 100)
      scene.add(capLight)
      const groundLight = new THREE.PointLight(0xff4400, 0, 60)
      groundLight.position.set(0, 0.5, 0)
      scene.add(groundLight)
      const fillLight = new THREE.DirectionalLight(0xff8844, 2)
      fillLight.position.set(5, 10, 8)
      scene.add(fillLight)
      const rimLight = new THREE.DirectionalLight(0xff6622, 1.5)
      rimLight.position.set(-8, 12, -5)
      scene.add(rimLight)

      const RAMP = [
        { t: 0.00, c: new THREE.Color(0xffffff) },
        { t: 0.05, c: new THREE.Color(0xfffff0) },
        { t: 0.12, c: new THREE.Color(0xffffaa) },
        { t: 0.22, c: new THREE.Color(0xffee44) },
        { t: 0.35, c: new THREE.Color(0xffaa00) },
        { t: 0.45, c: new THREE.Color(0xff6600) },
        { t: 0.55, c: new THREE.Color(0xee3300) },
        { t: 0.65, c: new THREE.Color(0xcc2200) },
        { t: 0.75, c: new THREE.Color(0xaa1100) },
        { t: 0.85, c: new THREE.Color(0x882200) },
        { t: 0.93, c: new THREE.Color(0x553311) },
        { t: 1.00, c: new THREE.Color(0x331111) },
      ]
      function sampleRamp(t) {
        t = Math.max(0, Math.min(1, t))
        for (let i = 0; i < RAMP.length - 1; i++) {
          if (t <= RAMP[i+1].t) {
            const f = (t - RAMP[i].t) / (RAMP[i+1].t - RAMP[i].t)
            return new THREE.Color().lerpColors(RAMP[i].c, RAMP[i+1].c, f)
          }
        }
        return RAMP[RAMP.length-1].c.clone()
      }

      function noise3(x, y, z) {
        return Math.sin(x * 1.7 + y * 2.3) * Math.cos(y * 1.1 + z * 3.1) * Math.sin(z * 2.7 + x * 1.3)
      }
      function fbm(x, y, z) {
        return noise3(x, y, z) * 0.5 + noise3(x*2.1, y*2.1, z*2.1) * 0.3 + noise3(x*4.3, y*4.3, z*4.3) * 0.2
      }

      const objs = []
      function add(o) { scene.add(o); objs.push(o) }

      // ─── Phase 1: Flash sphere + shrapnel ───
      const flashGeo = new THREE.IcosahedronGeometry(1, 5)
      const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      const flashMesh = new THREE.Mesh(flashGeo, flashMat)
      flashMesh.scale.setScalar(0.01)
      add(flashMesh)

      const blastDiscGeo = new THREE.RingGeometry(0.5, 1.5, 72)
      const blastDiscMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0, side: THREE.DoubleSide })
      const blastDisc = new THREE.Mesh(blastDiscGeo, blastDiscMat)
      blastDisc.rotation.x = -Math.PI / 2
      add(blastDisc)

      const SHRAPNEL_N = 3000
      const shrapnel = []
      const shrapGeo = new THREE.TetrahedronGeometry(1, 2)
      for (let i = 0; i < SHRAPNEL_N; i++) {
        const s = 0.04 + Math.random() * 0.22
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true })
        const m = new THREE.Mesh(shrapGeo, mat)
        m.scale.setScalar(s)
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const speed = 20 + Math.random() * 55
        m.userData.vel = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed * 0.7 + 8,
          Math.cos(phi) * speed
        )
        m.userData.lifetime = 0.5 + Math.random() * 1.8
        m.userData.age = 0
        m.userData.trail = []
        m.visible = false
        add(m)
        shrapnel.push(m)
      }

      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0.06,0, -0.03,0,0, 0.03,0,0]), 3))
      const fireTrails = []
      for (let i = 0; i < 800; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0, side: THREE.DoubleSide })
        const m = new THREE.Mesh(trailGeo, mat)
        m.visible = false
        m.userData.age = 0
        m.userData.lifetime = 0.3 + Math.random() * 0.5
        const s = 0.15 + Math.random() * 0.3
        m.scale.setScalar(s)
        add(m)
        fireTrails.push(m)
      }
      let trailIdx = 0

      // ─── Phase 2: Fireball + bubbles ───
      const fbGeo = new THREE.SphereGeometry(1, 38, 28)
      const fbBase = fbGeo.attributes.position.array.slice()
      for (let i = 0; i < fbBase.length; i++) fbBase[i] *= 1 + (Math.random() - 0.5) * 0.3
      fbGeo.attributes.position.array.set(fbBase)
      fbGeo.computeVertexNormals()
      const fbMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true })
      const fireball = new THREE.Mesh(fbGeo, fbMat)
      fireball.scale.setScalar(0.01)
      fireball.visible = false
      add(fireball)

      const coreGeo = new THREE.SphereGeometry(1, 26, 20)
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      const core = new THREE.Mesh(coreGeo, coreMat)
      core.scale.setScalar(0.01)
      core.visible = false
      add(core)

      const bubbles = []
      for (let i = 0; i < 32; i++) {
        const bGeo = new THREE.SphereGeometry(1, 20, 14)
        const bBase = bGeo.attributes.position.array.slice()
        for (let j = 0; j < bBase.length; j++) bBase[j] *= 1 + (Math.random() - 0.5) * 0.35
        bGeo.attributes.position.array.set(bBase)
        bGeo.computeVertexNormals()
        const bMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true })
        const bm = new THREE.Mesh(bGeo, bMat)
        bm.scale.setScalar(0.01)
        bm.visible = false
        bm.userData.angle = Math.random() * Math.PI * 2
        bm.userData.dist = 0.8 + Math.random() * 2.5
        bm.userData.lag = 0.05 + Math.random() * 0.5
        bm.userData.yOff = (Math.random() - 0.5) * 2
        bm.userData.origPos = bBase
        add(bm)
        bubbles.push(bm)
      }

      // ─── Phase 3: Stem (hourglass profile) ───
      const STEM_RAD_SEGS = 38, STEM_H_SEGS = 64
      const stemGeo = new THREE.CylinderGeometry(1, 1, 1, STEM_RAD_SEGS, STEM_H_SEGS, true)
      const stemBase = stemGeo.attributes.position.array.slice()
      for (let i = 0; i < stemBase.length; i += 3) {
        const y01 = stemBase[i + 1] + 0.5
        const waist = 0.7 + 0.6 * Math.pow(Math.abs(y01 - 0.5) * 2, 0.7)
        const flare = y01 < 0.15 ? 1.8 - y01 * 5.3 : (y01 > 0.85 ? 1.0 + (y01 - 0.85) * 6 : 1.0)
        const r = waist * flare * (1.4 + y01 * 0.6)
        stemBase[i]     *= r
        stemBase[i + 2] *= r
      }
      stemGeo.attributes.position.array.set(stemBase)
      stemGeo.computeVertexNormals()
      const stemMat = new THREE.MeshBasicMaterial({ color: 0xcc5500, transparent: true, side: THREE.DoubleSide })
      const stem = new THREE.Mesh(stemGeo, stemMat)
      stem.visible = false
      add(stem)

      const stemRingGeo = new THREE.TorusGeometry(2.0, 1.8, 26, 52)
      const stemRingMat = new THREE.MeshBasicMaterial({ color: 0xdd6622, transparent: true })
      const stemRing = new THREE.Mesh(stemRingGeo, stemRingMat)
      stemRing.rotation.x = Math.PI / 2
      stemRing.visible = false
      add(stemRing)

      const stemRing2Geo = new THREE.TorusGeometry(1.5, 1.2, 20, 40)
      const stemRing2Mat = new THREE.MeshBasicMaterial({ color: 0xff7744, transparent: true })
      const stemRing2 = new THREE.Mesh(stemRing2Geo, stemRing2Mat)
      stemRing2.rotation.x = Math.PI / 2
      stemRing2.visible = false
      add(stemRing2)

      const stemRing3Geo = new THREE.TorusGeometry(1.0, 0.8, 16, 32)
      const stemRing3Mat = new THREE.MeshBasicMaterial({ color: 0xee8855, transparent: true })
      const stemRing3 = new THREE.Mesh(stemRing3Geo, stemRing3Mat)
      stemRing3.rotation.x = Math.PI / 2
      stemRing3.visible = false
      add(stemRing3)

      // ─── Ground fire ring ───
      const GROUND_FIRES = 80
      const groundFires = []
      const gfGeo = new THREE.ConeGeometry(0.3, 1.2, 8)
      for (let i = 0; i < GROUND_FIRES; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0 })
        const m = new THREE.Mesh(gfGeo, mat)
        const angle = (i / GROUND_FIRES) * Math.PI * 2
        const dist = 7 + Math.random() * 8
        m.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
        m.userData.baseY = 0
        m.userData.phase = Math.random() * Math.PI * 2
        m.userData.speed = 3 + Math.random() * 4
        m.userData.baseScale = 0.5 + Math.random() * 1.5
        m.visible = false
        add(m)
        groundFires.push(m)
      }

      // ─── Phase 4: Mushroom cap (layered cloud) ───
      const capGeo = new THREE.TorusGeometry(7, 4.5, 38, 58)
      const capOrigPos = capGeo.attributes.position.array.slice()
      const capMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true })
      const capMesh = new THREE.Mesh(capGeo, capMat)
      capMesh.scale.setScalar(0.01)
      capMesh.visible = false
      add(capMesh)

      const domeGeo = new THREE.SphereGeometry(7, 38, 28, 0, Math.PI * 2, 0, Math.PI * 0.55)
      const domeOrigPos = domeGeo.attributes.position.array.slice()
      const domeMat = new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true })
      const dome = new THREE.Mesh(domeGeo, domeMat)
      dome.scale.setScalar(0.01)
      dome.visible = false
      add(dome)

      const innerCapGeo = new THREE.SphereGeometry(5, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.6)
      const innerCapBase = innerCapGeo.attributes.position.array.slice()
      for (let i = 0; i < innerCapBase.length; i++) innerCapBase[i] *= 1 + (Math.random() - 0.5) * 0.2
      innerCapGeo.attributes.position.array.set(innerCapBase)
      innerCapGeo.computeVertexNormals()
      const innerCapMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true })
      const innerCap = new THREE.Mesh(innerCapGeo, innerCapMat)
      innerCap.scale.setScalar(0.01)
      innerCap.visible = false
      add(innerCap)

      const underCapGeo = new THREE.SphereGeometry(6.5, 32, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.35)
      const underCapBase = underCapGeo.attributes.position.array.slice()
      const underCapMat = new THREE.MeshBasicMaterial({ color: 0xcc4400, transparent: true })
      const underCap = new THREE.Mesh(underCapGeo, underCapMat)
      underCap.scale.setScalar(0.01)
      underCap.visible = false
      add(underCap)

      const CAP_BLOBS = 14
      const capBlobs = []
      for (let i = 0; i < CAP_BLOBS; i++) {
        const blobGeo = new THREE.SphereGeometry(1, 16, 12)
        const blobBase = blobGeo.attributes.position.array.slice()
        for (let j = 0; j < blobBase.length; j++) blobBase[j] *= 1 + (Math.random() - 0.5) * 0.4
        blobGeo.attributes.position.array.set(blobBase)
        blobGeo.computeVertexNormals()
        const blobMat = new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true })
        const blob = new THREE.Mesh(blobGeo, blobMat)
        blob.visible = false
        const angle = (i / CAP_BLOBS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
        blob.userData.angle = angle
        blob.userData.dist = 5 + Math.random() * 3
        blob.userData.yOff = (Math.random() - 0.5) * 2
        blob.userData.baseScale = 1.5 + Math.random() * 2.5
        blob.userData.origPos = blobBase
        add(blob)
        capBlobs.push(blob)
      }

      // ─── Smoke puffs ───
      const SMOKE_N = 72
      const smokePuffs = []
      const smokeGeo = new THREE.SphereGeometry(1, 12, 10)
      for (let i = 0; i < SMOKE_N; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0, depthWrite: false })
        const m = new THREE.Mesh(smokeGeo, mat)
        m.visible = false
        const s = 1.5 + Math.random() * 4.5
        m.scale.setScalar(s)
        m.userData.vy = 0.5 + Math.random() * 1.5
        m.userData.vx = (Math.random() - 0.5) * 2
        m.userData.vz = (Math.random() - 0.5) * 2
        m.userData.rotSpeed = (Math.random() - 0.5) * 0.5
        m.userData.maxOpacity = 0.2 + Math.random() * 0.3
        m.userData.lifetime = 3 + Math.random() * 5
        m.userData.age = 0
        m.userData.spawned = false
        add(m)
        smokePuffs.push(m)
      }
      let smokeIdx = 0

      // ─── Ember particles ───
      const EMBER_N = 8000
      const embers = []
      const emberGeo = new THREE.BufferGeometry()
      emberGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0.12,0, -0.07,0,0, 0.07,0,0]), 3))
      for (let i = 0; i < EMBER_N; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0, side: THREE.DoubleSide })
        const m = new THREE.Mesh(emberGeo, mat)
        m.userData.vy = 0.3 + Math.random() * 1.2
        m.userData.vx = (Math.random() - 0.5) * 2.0
        m.userData.vz = (Math.random() - 0.5) * 2.0
        m.userData.lifetime = 1.2 + Math.random() * 3.5
        m.userData.age = 0
        m.userData.spawned = false
        const s = 0.15 + Math.random() * 0.45
        m.scale.setScalar(s)
        m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
        m.visible = false
        add(m)
        embers.push(m)
      }

      // ─── Shockwaves (triple) ───
      const shockwaves = []
      for (let si = 0; si < 3; si++) {
        const swGeo = new THREE.RingGeometry(0.1, 1.2, 96)
        const swMat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0, side: THREE.DoubleSide })
        const sw = new THREE.Mesh(swGeo, swMat)
        sw.rotation.x = -Math.PI / 2
        sw.position.y = 0.05 + si * 0.1
        sw.userData.delay = si * 0.4
        sw.userData.speed = 50 + si * 15
        add(sw)
        shockwaves.push(sw)
      }

      // ─── Secondary explosions ───
      const SEC_EXPLODE_N = 11
      const secExplosions = []
      for (let i = 0; i < SEC_EXPLODE_N; i++) {
        const geo = new THREE.SphereGeometry(1, 12, 10)
        const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
        const m = new THREE.Mesh(geo, mat)
        m.visible = false
        const angle = Math.random() * Math.PI * 2
        const dist = 4 + Math.random() * 6
        m.userData.spawnTime = 0.8 + Math.random() * 2.5
        m.userData.targetPos = new THREE.Vector3(Math.cos(angle) * dist, 2 + Math.random() * 6, Math.sin(angle) * dist)
        m.userData.maxScale = 1.0 + Math.random() * 2.0
        m.userData.lifetime = 0.6 + Math.random() * 0.8
        m.userData.age = -1
        add(m)
        secExplosions.push(m)
      }

      // ─── Spark particles for UI overlay ───
      const sparks = []
      const sparkCanvas = sparkRef.current
      let sparkCtx = null
      const dpr = window.devicePixelRatio || 1
      const sW = window.innerWidth, sH = window.innerHeight
      if (sparkCanvas) {
        sparkCanvas.width = sW * dpr
        sparkCanvas.height = sH * dpr
        sparkCanvas.style.width = sW + 'px'
        sparkCanvas.style.height = sH + 'px'
        sparkCtx = sparkCanvas.getContext('2d')
        sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      let uiRects = []
      let bgRects = []
      function refreshUIRects() {
        uiRects = []
        bgRects = []
        document.querySelectorAll('.tb-btn, button, [class*="rounded-lg"], [class*="shadow"], [class*="border-r"], [class*="border-l"], [class*="border-b"], nav, aside, select, input').forEach(el => {
          const r = el.getBoundingClientRect()
          if (r.width > 4 && r.height > 4) {
            if (r.width < sW * 0.6) uiRects.push(r)
            else bgRects.push(r)
          }
        })
      }
      refreshUIRects()

      function spawnSparks(count) {
        const total = Math.round(count * 1.8)
        for (let i = 0; i < total; i++) {
          let x, y
          const roll = Math.random()
          if (uiRects.length > 0 && roll < 0.5) {
            const rect = uiRects[Math.floor(Math.random() * uiRects.length)]
            const edge = Math.floor(Math.random() * 4)
            if (edge === 0)      { x = rect.left + Math.random() * rect.width; y = rect.top }
            else if (edge === 1) { x = rect.left + Math.random() * rect.width; y = rect.bottom }
            else if (edge === 2) { x = rect.left;  y = rect.top + Math.random() * rect.height }
            else                 { x = rect.right; y = rect.top + Math.random() * rect.height }
          } else if (roll < 0.8) {
            x = Math.random() * sW
            y = Math.random() * sH
          } else {
            const side = Math.floor(Math.random() * 4)
            if (side === 0)      { x = Math.random() * sW; y = 0 }
            else if (side === 1) { x = Math.random() * sW; y = sH }
            else if (side === 2) { x = 0; y = Math.random() * sH }
            else                 { x = sW; y = Math.random() * sH }
          }
          const angle = -Math.PI * 0.25 - Math.random() * Math.PI * 0.5
          const speed = 80 + Math.random() * 400
          const type = Math.random()
          sparks.push({
            x, y,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 160,
            vy: Math.sin(angle) * speed - 80 - Math.random() * 250,
            life: type < 0.3 ? 0.2 + Math.random() * 0.5 : 0.5 + Math.random() * 2.2,
            age: 0,
            size: type < 0.3 ? 0.5 + Math.random() * 2 : 1.5 + Math.random() * 4.5,
            bright: 0.7 + Math.random() * 0.3,
            trail: type > 0.3,
            px: x, py: y, ppx: x, ppy: y,
          })
        }
      }

      function updateSparks(dt, intensity) {
        if (!sparkCtx) return
        sparkCtx.clearRect(0, 0, sW, sH)
        if (intensity <= 0) return

        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i]
          s.age += dt
          if (s.age > s.life) { sparks.splice(i, 1); continue }
          s.ppx = s.px; s.ppy = s.py
          s.px = s.x; s.py = s.y
          s.x += s.vx * dt
          s.vy += 160 * dt
          s.y += s.vy * dt
          s.vx *= 0.97
          const lt = s.age / s.life
          const a = (1 - lt * lt) * intensity * s.bright

          const whiteHeat = Math.max(0, 1 - lt * 2)
          const r = 255
          const g = Math.round(255 * whiteHeat + (1 - whiteHeat) * (180 - lt * 100))
          const b = Math.round(255 * whiteHeat * whiteHeat + (1 - whiteHeat) * Math.max(0, 80 - lt * 80))
          const sz = s.size * (1 - lt * 0.4)

          if (s.trail && s.age > dt * 2) {
            sparkCtx.beginPath()
            sparkCtx.moveTo(s.ppx, s.ppy)
            sparkCtx.quadraticCurveTo(s.px, s.py, s.x, s.y)
            sparkCtx.strokeStyle = `rgba(${r},${g},${b},${a * 0.5})`
            sparkCtx.lineWidth = sz * 0.8
            sparkCtx.lineCap = 'round'
            sparkCtx.stroke()
          }

          sparkCtx.beginPath()
          sparkCtx.arc(s.x, s.y, sz, 0, Math.PI * 2)
          sparkCtx.fillStyle = `rgba(${r},${g},${b},${a})`
          sparkCtx.fill()

          sparkCtx.beginPath()
          sparkCtx.arc(s.x, s.y, sz * 4, 0, Math.PI * 2)
          sparkCtx.fillStyle = `rgba(${r},${g},${b},${a * 0.15})`
          sparkCtx.fill()

          if (whiteHeat > 0.3) {
            sparkCtx.beginPath()
            sparkCtx.arc(s.x, s.y, sz * 0.5, 0, Math.PI * 2)
            sparkCtx.fillStyle = `rgba(255,255,255,${a * whiteHeat * 0.9})`
            sparkCtx.fill()
          }
        }
      }

      // ─── Animation ───
      document.body.classList.add('nuke-whitehot')
      const TOTAL = 10.0
      const t0 = performance.now()
      let raf, emberIdx = 0, flashPeakFired = false
      const camTgt = new THREE.Vector3()
      const lookTgt = new THREE.Vector3(0, 5, 0)

      function easeOutExpo(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x) }
      function easeOutBack(x) { const c = 2.2; return 1 + (c+1) * Math.pow(x-1,3) + c * Math.pow(x-1,2) }

      function tick() {
        if (cancelled) return
        const elapsed = (performance.now() - t0) / 1000
        if (elapsed > TOTAL) { cleanup(); onCompleteRef.current(); return }
        const dt = 1/60

        // Screen shake — extreme violence
        const shakeAmt = elapsed < 0.3
          ? 50
          : Math.max(0, 1 - elapsed / 6) * 25
        const sx = (Math.random()-.5) * shakeAmt
        const sy = (Math.random()-.5) * shakeAmt
        const sr = (Math.random()-.5) * shakeAmt * 0.15
        container.style.transform = `translate(${sx}px,${sy}px) rotate(${sr}deg)`

        // ── White-hot UI skin (driven by elapsed time) ──
        {
          const bs = document.body.style
          let intensity = 0
          if (elapsed < 0.3) {
            intensity = 1.0
          } else if (elapsed < 1.5) {
            intensity = 1.0 - (elapsed - 0.3) / 1.2 * 0.15
          } else if (elapsed < 4.0) {
            intensity = 0.85 - (elapsed - 1.5) / 2.5 * 0.35
          } else if (elapsed < 7.0) {
            intensity = 0.5 - (elapsed - 4.0) / 3.0 * 0.3
          } else if (elapsed < TOTAL) {
            intensity = 0.2 * (1 - (elapsed - 7.0) / (TOTAL - 7.0))
          }
          intensity = Math.max(0, intensity)
          const bright = 1 + intensity * 3.0
          const sat = 1 - intensity * 0.9
          const sepia = intensity * 0.7
          bs.setProperty('--nuke-bright', bright.toFixed(3))
          bs.setProperty('--nuke-sat', sat.toFixed(3))
          bs.setProperty('--nuke-sepia', sepia.toFixed(3))
          bs.setProperty('--nuke-glow', intensity.toFixed(3))
          bs.setProperty('--nuke-edge', (intensity * 0.8).toFixed(3))

          if (elapsed < 8.0) {
            let spawnRate, spawnCount
            if (elapsed < 0.3)       { spawnRate = 1.0;  spawnCount = 90 }
            else if (elapsed < 0.8)  { spawnRate = 1.0;  spawnCount = 70 }
            else if (elapsed < 2.0)  { spawnRate = 0.9;  spawnCount = 50 }
            else if (elapsed < 4.0)  { spawnRate = 0.7;  spawnCount = 30 }
            else if (elapsed < 6.0)  { spawnRate = 0.5;  spawnCount = 18 }
            else                     { spawnRate = 0.4;  spawnCount = 10 }
            if (Math.random() < spawnRate) spawnSparks(spawnCount)
          }
          if (elapsed > 2 && Math.floor(elapsed) !== Math.floor(elapsed - dt)) refreshUIRects()
          updateSparks(dt, intensity)
        }

        // ── Heat distortion overlay ──
        if (heatRef.current) {
          const h = heatRef.current.style
          if (elapsed < 5) {
            const intensity = Math.max(0, 1 - elapsed / 5)
            h.opacity = (intensity * 0.4).toString()
            h.background = `repeating-linear-gradient(${elapsed * 200 % 360}deg, transparent, rgba(255,150,0,${intensity * 0.08}) 2px, transparent 4px)`
          } else {
            h.opacity = '0'
          }
        }

        // ── Nuclear melt overlay ──
        if (meltRef.current) {
          const s = meltRef.current.style
          if (elapsed < 0.1) {
            s.opacity = '1'
            s.background = 'radial-gradient(circle at 50% 80%, rgba(255,255,255,1), rgba(255,255,200,0.95) 20%, rgba(255,200,50,0.8) 40%, rgba(255,100,0,0.6) 60%, rgba(200,30,0,0.4) 80%, rgba(100,0,0,0.2) 100%)'
          } else if (elapsed < 4.0) {
            const p = (elapsed - 0.1) / 3.9
            const op = 1.0 * (1 - p * 0.5)
            s.opacity = op.toString()
            const r = 255, g = Math.round(220 - p * 180), b = Math.round(120 - p * 120)
            s.background = `radial-gradient(circle at 50% 80%, rgba(${r},${g},${b},0.8), rgba(255,${Math.round(100-p*80)},0,0.5) 35%, rgba(200,30,0,0.3) 60%, rgba(100,0,0,0.15) 80%, transparent 100%)`
          } else {
            const fade = 1 - Math.min(1, (elapsed - 4.0) / 4.5)
            s.opacity = (fade * 0.4).toString()
            s.background = 'radial-gradient(circle at 50% 80%, rgba(200,40,0,0.4), rgba(120,15,0,0.2) 50%, transparent 100%)'
          }
        }

        // ── Flash overlays (double flash) ──
        if (flashRef.current) {
          if (elapsed < 0.08) flashRef.current.style.opacity = '1'
          else if (elapsed < 0.25) flashRef.current.style.opacity = (0.9 * (1 - (elapsed - 0.08) / 0.17)).toString()
          else if (elapsed < 0.35) flashRef.current.style.opacity = (0.3 * ((elapsed - 0.25) / 0.1)).toString()
          else if (elapsed < 0.5) flashRef.current.style.opacity = (0.3 * (1 - (elapsed - 0.35) / 0.15)).toString()
          else flashRef.current.style.opacity = '0'
        }

        // ── Peak flashpoint: orange/yellow/white wipe + callback ──
        if (peakFlashRef.current) {
          const pf = peakFlashRef.current.style
          if (elapsed >= 0.2 && elapsed < 0.35) {
            const p = (elapsed - 0.2) / 0.15
            pf.opacity = Math.min(1, p * 2).toString()
            pf.background = `radial-gradient(ellipse at 50% 60%, rgba(255,255,255,${1 * Math.min(1, p * 2)}), rgba(255,255,200,${0.95 * Math.min(1, p * 1.5)}) 15%, rgba(255,220,80,${0.85 * Math.min(1, p * 1.3)}) 35%, rgba(255,160,20,${0.7 * p}) 55%, rgba(255,100,0,${0.5 * p}) 75%, rgba(200,50,0,${0.3 * p}) 100%)`
          } else if (elapsed >= 0.35 && elapsed < 1.0) {
            const fade = 1 - (elapsed - 0.35) / 0.65
            pf.opacity = fade.toString()
            pf.background = `radial-gradient(ellipse at 50% 60%, rgba(255,200,80,${0.6 * fade}), rgba(255,120,0,${0.4 * fade}) 40%, rgba(200,50,0,${0.2 * fade}) 70%, transparent 100%)`
          } else if (elapsed >= 1.0) {
            pf.opacity = '0'
          }
        }
        if (!flashPeakFired && elapsed >= 0.25) {
          flashPeakFired = true
          if (onFlashPeakRef.current) onFlashPeakRef.current()
        }

        // ── Phase 1: Flash (0–0.5s) ──
        if (elapsed < 0.5) {
          const p = easeOutExpo(elapsed / 0.5)
          flashMesh.scale.setScalar(p * 15)
          flashMat.opacity = 1 - p * 0.5
          flashMat.color.copy(sampleRamp(p * 0.1))
          ptLight.intensity = 25 * (1 - p)
          ptLight.color.set(0xffffdd)

          blastDisc.visible = true
          blastDisc.scale.setScalar(1 + p * 25)
          blastDiscMat.opacity = (1 - p) * 0.8
        } else {
          flashMesh.visible = false
          blastDisc.visible = false
        }

        // Shrapnel
        if (elapsed < 0.05) shrapnel.forEach(s => { s.visible = true; s.position.set(0,0,0) })
        shrapnel.forEach((s, si) => {
          if (!s.visible) return
          s.userData.age += dt
          const lt = s.userData.age / s.userData.lifetime
          if (lt > 1) { s.visible = false; return }
          s.userData.vel.y -= 9.8 * dt
          s.userData.vel.multiplyScalar(0.985)
          s.position.add(s.userData.vel.clone().multiplyScalar(dt))
          s.rotation.x += 6 * dt; s.rotation.y += 5 * dt
          s.material.color.copy(sampleRamp(lt * 0.4))
          s.material.opacity = 1 - lt * lt

          if (si % 4 === 0 && lt < 0.7 && trailIdx < fireTrails.length) {
            const t = fireTrails[trailIdx % fireTrails.length]
            t.position.copy(s.position)
            t.visible = true
            t.userData.age = 0
            t.material.opacity = 0.7
            t.material.color.copy(sampleRamp(lt * 0.3))
            trailIdx++
          }
        })

        // Fire trails update
        fireTrails.forEach(t => {
          if (!t.visible) return
          t.userData.age += dt
          const lt = t.userData.age / t.userData.lifetime
          if (lt > 1) { t.visible = false; return }
          t.material.opacity = (1 - lt) * 0.5
          t.scale.multiplyScalar(0.95)
          t.material.color.copy(sampleRamp(0.2 + lt * 0.4))
        })

        // ── Phase 2: Fireball (0.2–6s) ──
        if (elapsed >= 0.2 && elapsed < 6.5) {
          fireball.visible = true
          core.visible = true
          const p2 = Math.min(1, (elapsed - 0.2) / 1.2)
          const r = 2 + p2 * 6
          fireball.scale.setScalar(r)
          fireball.position.y = p2 * 8
          const rt = 0.1 + p2 * 0.2
          fbMat.color.copy(sampleRamp(rt))

          core.scale.setScalar(r * 0.5 * (1 - Math.min(1, (elapsed - 0.2) / 3)))
          core.position.copy(fireball.position)
          coreMat.opacity = Math.max(0, 1 - (elapsed - 0.2) / 2.5)
          coreMat.color.copy(sampleRamp(rt * 0.3))

          const pos = fbGeo.attributes.position.array
          for (let i = 0; i < fbBase.length; i += 3) {
            const n = fbm(elapsed * 2.5 + fbBase[i+1] * 2, fbBase[i] * 2, fbBase[i+2] * 2)
            pos[i]   = fbBase[i]   * (1 + n * 0.2)
            pos[i+1] = fbBase[i+1] * (1 + n * 0.15)
            pos[i+2] = fbBase[i+2] * (1 + n * 0.2)
          }
          fbGeo.attributes.position.needsUpdate = true

          ptLight.position.set(0, fireball.position.y, 0)
          ptLight.intensity = Math.max(0, 20 * (1 - (elapsed - 0.2) / 5.5))
          ptLight.color.copy(sampleRamp(rt))

          bubbles.forEach(b => {
            b.visible = true
            const br = (0.3 + Math.random() * 0.12) * r
            b.scale.setScalar(br)
            const a = b.userData.angle + elapsed * 0.8
            b.position.set(
              Math.cos(a) * b.userData.dist * p2,
              fireball.position.y + b.userData.yOff - b.userData.lag * 3,
              Math.sin(a) * b.userData.dist * p2
            )
            b.material.color.copy(sampleRamp(rt + 0.05 + Math.random() * 0.05))
            const bp = b.geometry.attributes.position.array, bo = b.userData.origPos
            for (let i = 0; i < bo.length; i += 3) {
              const n = fbm(elapsed * 3 + bo[i+1] * 3, bo[i] * 3, bo[i+2] * 3)
              bp[i]   = bo[i]   * (1 + n * 0.2)
              bp[i+1] = bo[i+1] * (1 + n * 0.15)
              bp[i+2] = bo[i+2] * (1 + n * 0.2)
            }
            b.geometry.attributes.position.needsUpdate = true
          })
        }

        // ── Phase 3: Stem + rings (0.5–6.5s) ──
        if (elapsed >= 0.5 && elapsed < 6.5) {
          stem.visible = true
          stemRing.visible = true
          stemRing2.visible = true
          stemRing3.visible = true
          const p3 = Math.min(1, (elapsed - 0.5) / 1.5)
          const h = p3 * 9
          stem.scale.set(1, Math.max(0.01, h), 1)
          stem.position.y = h / 2

          const sp = stemGeo.attributes.position.array
          for (let i = 0; i < stemBase.length; i += 3) {
            const turb = fbm(elapsed * 1.2 + stemBase[i+1] * 3, stemBase[i] * 2, stemBase[i+2] * 2)
            const turb2 = fbm(stemBase[i] * 2, stemBase[i+1] * 3, elapsed * 1.2)
            sp[i]   = stemBase[i]   + turb * 0.25
            sp[i+1] = stemBase[i+1]
            sp[i+2] = stemBase[i+2] + turb2 * 0.25
          }
          stemGeo.attributes.position.needsUpdate = true
          stemMat.color.copy(sampleRamp(0.25 + p3 * 0.2))

          const ringP = Math.min(1, (elapsed - 0.8) / 2.0)
          const ringExpand = easeOutExpo(ringP)
          stemRing.position.y = 1.5 + p3 * 2.5
          const r1s = 0.3 + ringExpand * 2.5
          stemRing.scale.set(r1s, r1s * 0.25 + ringExpand * 0.15, r1s)
          stemRingMat.color.copy(sampleRamp(0.3 + p3 * 0.15))
          stemRingMat.opacity = Math.min(1, ringP * 3) * (1 - Math.max(0, (elapsed - 4) / 2.5))

          const ring2P = Math.min(1, Math.max(0, (elapsed - 1.2)) / 2.0)
          const ring2Expand = easeOutExpo(ring2P)
          stemRing2.position.y = 2.5 + p3 * 3.5
          const r2s = 0.2 + ring2Expand * 1.8
          stemRing2.scale.set(r2s, r2s * 0.2 + ring2Expand * 0.12, r2s)
          stemRing2Mat.color.copy(sampleRamp(0.28 + p3 * 0.18))
          stemRing2Mat.opacity = Math.min(1, ring2P * 3) * (1 - Math.max(0, (elapsed - 3.5) / 2.5))

          const ring3P = Math.min(1, Math.max(0, (elapsed - 1.6)) / 2.0)
          const ring3Expand = easeOutExpo(ring3P)
          stemRing3.position.y = 3.5 + p3 * 4.0
          const r3s = 0.15 + ring3Expand * 1.2
          stemRing3.scale.set(r3s, r3s * 0.18 + ring3Expand * 0.1, r3s)
          stemRing3Mat.color.copy(sampleRamp(0.25 + p3 * 0.2))
          stemRing3Mat.opacity = Math.min(1, ring3P * 3) * (1 - Math.max(0, (elapsed - 3) / 2.5))
        }

        // Ground fire
        if (elapsed >= 0.4 && elapsed < 7) {
          const gfP = Math.min(1, (elapsed - 0.4) / 1.5)
          groundFires.forEach(gf => {
            gf.visible = true
            const flicker = 0.5 + 0.5 * Math.sin(elapsed * gf.userData.speed + gf.userData.phase)
            const s = gf.userData.baseScale * gfP * flicker
            gf.scale.set(s, s * (1.5 + Math.sin(elapsed * gf.userData.speed * 1.3) * 0.5), s)
            gf.position.y = s * 0.5
            gf.material.opacity = gfP * flicker * 0.8 * (1 - Math.max(0, (elapsed - 4.5) / 2.5))
            gf.material.color.copy(sampleRamp(0.2 + flicker * 0.2))
          })
          groundLight.intensity = gfP * 8 * (1 - Math.max(0, (elapsed - 4) / 3))
        }

        // ── Phase 4: Mushroom cap (1.2–6.5s) ──
        if (elapsed >= 1.2 && elapsed < 6.5) {
          capMesh.visible = true
          dome.visible = true
          innerCap.visible = true
          underCap.visible = true
          const p4 = Math.min(1, (elapsed - 1.2) / 0.8)
          const cs = easeOutBack(p4)
          const capY = 9 + Math.min(1, (elapsed - 1.2) / 2) * 3.5
          const billow = 1 + Math.sin(elapsed * 1.5) * 0.04

          capMesh.scale.set(cs * 1.3 * billow, cs * 0.55, cs * 1.3 * billow)
          capMesh.position.y = capY
          capMesh.rotation.x = Math.PI / 2

          dome.scale.set(cs * 1.05 * billow, cs * 0.85, cs * 1.05 * billow)
          dome.position.y = capY + 1.5 * cs
          dome.rotation.x = 0

          innerCap.scale.set(cs * 0.8, cs * 0.7, cs * 0.8)
          innerCap.position.y = capY + 2.5 * cs
          innerCap.rotation.x = 0

          underCap.scale.set(cs * 1.1 * billow, cs * 0.6, cs * 1.1 * billow)
          underCap.position.y = capY - 1.5 * cs
          underCap.rotation.x = 0

          const cr = 0.15 + p4 * 0.2
          capMat.color.copy(sampleRamp(cr))
          domeMat.color.copy(sampleRamp(cr - 0.02))
          innerCapMat.color.copy(sampleRamp(cr * 0.6))
          underCapMat.color.copy(sampleRamp(cr + 0.12))

          capLight.position.y = capY
          capLight.intensity = 15 * (1 - Math.max(0, (elapsed - 2) / 4))
          capLight.color.copy(sampleRamp(cr))

          const cp = capGeo.attributes.position.array
          for (let i = 0; i < capOrigPos.length; i += 3) {
            const n = fbm(elapsed * 1.5 + capOrigPos[i+1] * 1.5, capOrigPos[i] * 1.5, capOrigPos[i+2] * 1.5)
            const amp = 0.12 + (elapsed - 1.2) * 0.04
            cp[i]   = capOrigPos[i]   * (1 + n * amp)
            cp[i+1] = capOrigPos[i+1] * (1 + n * amp * 0.6)
            cp[i+2] = capOrigPos[i+2] * (1 + n * amp)
          }
          capGeo.attributes.position.needsUpdate = true

          const dp = domeGeo.attributes.position.array
          for (let i = 0; i < domeOrigPos.length; i += 3) {
            const n = fbm(elapsed * 1.8 + domeOrigPos[i] * 1.2, domeOrigPos[i+1] * 1.2, domeOrigPos[i+2] * 1.2)
            dp[i]   = domeOrigPos[i]   * (1 + n * 0.15)
            dp[i+1] = domeOrigPos[i+1] * (1 + n * 0.12)
            dp[i+2] = domeOrigPos[i+2] * (1 + n * 0.15)
          }
          domeGeo.attributes.position.needsUpdate = true

          const icp = innerCapGeo.attributes.position.array
          for (let i = 0; i < innerCapBase.length; i += 3) {
            const n = fbm(elapsed * 2.2 + innerCapBase[i] * 1.8, innerCapBase[i+1] * 1.8, innerCapBase[i+2] * 1.8)
            icp[i]   = innerCapBase[i]   * (1 + n * 0.18)
            icp[i+1] = innerCapBase[i+1] * (1 + n * 0.14)
            icp[i+2] = innerCapBase[i+2] * (1 + n * 0.18)
          }
          innerCapGeo.attributes.position.needsUpdate = true

          capBlobs.forEach(b => {
            b.visible = true
            const a = b.userData.angle + elapsed * 0.6
            const d = b.userData.dist * cs * billow
            b.position.set(Math.cos(a) * d, capY + b.userData.yOff * cs, Math.sin(a) * d)
            b.scale.setScalar(b.userData.baseScale * cs)
            b.material.color.copy(sampleRamp(cr + 0.05))
            b.material.opacity = 0.85
            const bp = b.geometry.attributes.position.array, bo = b.userData.origPos
            for (let i = 0; i < bo.length; i += 3) {
              const n = fbm(elapsed * 2.5 + bo[i+1] * 2, bo[i] * 2, bo[i+2] * 2)
              bp[i]   = bo[i]   * (1 + n * 0.25)
              bp[i+1] = bo[i+1] * (1 + n * 0.2)
              bp[i+2] = bo[i+2] * (1 + n * 0.25)
            }
            b.geometry.attributes.position.needsUpdate = true
          })

          while (emberIdx < EMBER_N && elapsed >= 1.2 + emberIdx * (3.0 / EMBER_N)) {
            const e = embers[emberIdx]
            e.visible = true
            e.userData.spawned = true
            const th = Math.random() * Math.PI * 2, er = 2 + Math.random() * 8
            e.position.set(Math.cos(th) * er, capY + (Math.random() - 0.5) * 6, Math.sin(th) * er)
            emberIdx++
          }
        }

        // Secondary explosions
        secExplosions.forEach(se => {
          if (elapsed >= se.userData.spawnTime && se.userData.age < 0) {
            se.userData.age = 0
            se.visible = true
            se.position.copy(se.userData.targetPos)
          }
          if (se.userData.age >= 0 && se.visible) {
            se.userData.age += dt
            const lt = se.userData.age / se.userData.lifetime
            if (lt > 1) { se.visible = false; return }
            const s = easeOutExpo(Math.min(1, lt * 3)) * se.userData.maxScale
            se.scale.setScalar(s)
            se.material.opacity = lt < 0.2 ? lt / 0.2 : Math.max(0, 1 - (lt - 0.2) / 0.8)
            se.material.color.copy(sampleRamp(lt * 0.35))
          }
        })

        // Update embers
        embers.forEach(e => {
          if (!e.userData.spawned || !e.visible) return
          e.userData.age += dt
          const lt = e.userData.age / e.userData.lifetime
          if (lt > 1) { e.visible = false; return }
          e.position.x += e.userData.vx * dt
          e.position.y += e.userData.vy * dt
          e.position.z += e.userData.vz * dt
          e.userData.vy -= 0.15 * dt
          e.rotation.x += dt * 2.5; e.rotation.z += dt * 1.5
          e.material.opacity = lt < 0.08 ? lt / 0.08 : Math.max(0, 1 - (lt - 0.08) / 0.92)
          e.material.color.copy(sampleRamp(0.1 + lt * 0.5))
        })

        // Smoke puffs — spawn from fireball and stem
        if (elapsed >= 0.5 && smokeIdx < SMOKE_N) {
          const rate = elapsed < 2 ? 12 : 4
          while (smokeIdx < SMOKE_N && Math.random() < rate * dt) {
            const sp = smokePuffs[smokeIdx]
            sp.visible = true
            sp.userData.spawned = true
            sp.userData.age = 0
            const th = Math.random() * Math.PI * 2
            const r = 1 + Math.random() * 5
            const baseY = elapsed < 2 ? 3 + Math.random() * 6 : 6 + Math.random() * 8
            sp.position.set(Math.cos(th) * r, baseY, Math.sin(th) * r)
            smokeIdx++
          }
        }
        smokePuffs.forEach(sp => {
          if (!sp.userData.spawned || !sp.visible) return
          sp.userData.age += dt
          const lt = sp.userData.age / sp.userData.lifetime
          if (lt > 1) { sp.visible = false; return }
          sp.position.y += sp.userData.vy * dt
          sp.position.x += sp.userData.vx * dt
          sp.position.z += sp.userData.vz * dt
          sp.rotation.y += sp.userData.rotSpeed * dt
          sp.scale.multiplyScalar(1 + dt * 0.15)
          const fadeIn = Math.min(1, lt * 5)
          const fadeOut = Math.max(0, 1 - (lt - 0.4) / 0.6)
          sp.material.opacity = fadeIn * fadeOut * sp.userData.maxOpacity
          const grey = Math.round(60 + lt * 80)
          sp.material.color.setRGB(grey/255, grey/255, grey/255)
        })

        // Triple shockwaves
        shockwaves.forEach(sw => {
          const st0 = elapsed - sw.userData.delay
          if (st0 > 0 && st0 < 3) {
            sw.visible = true
            const st = st0 / 3
            sw.scale.setScalar(1 + st * sw.userData.speed)
            sw.material.opacity = (1 - st) * 0.7
            sw.material.color.copy(sampleRamp(st * 0.25))
          } else {
            sw.visible = false
          }
        })

        // ── Phase 5: Dissipation (5.0–9.0s) ──
        if (elapsed >= 5.0) {
          const fade = 1 - Math.min(1, (elapsed - 5.0) / 4.0)
          fbMat.opacity = fade
          coreMat.opacity = fade * 0.3
          stemMat.opacity = fade
          stemRingMat.opacity = fade * 0.7
          stemRing2Mat.opacity = fade * 0.6
          stemRing3Mat.opacity = fade * 0.5
          capMat.opacity = fade
          domeMat.opacity = fade
          bubbles.forEach(b => { b.material.opacity = fade })
          fireball.position.y += 0.6 * dt
          fireball.scale.multiplyScalar(0.996)
          core.position.y = fireball.position.y
          bubbles.forEach(b => { b.position.y += 0.4 * dt; b.scale.multiplyScalar(0.996) })
          ambLight.intensity = 4 * fade
          fillLight.intensity = 2 * fade
          rimLight.intensity = 1.5 * fade
        }

        // ── Camera — dramatic orbit ──
        const orbitAngle = elapsed * 0.15
        if (elapsed < 0.3) {
          camTgt.set(0, 3, 28)
        } else if (elapsed < 2.0) {
          const ct = (elapsed - 0.3) / 1.7
          camTgt.set(Math.sin(orbitAngle) * 5, 4 + ct * 7, 28 - ct * 10)
        } else if (elapsed < 5.0) {
          const ct = (elapsed - 2.0) / 3.0
          camTgt.set(Math.sin(orbitAngle) * 8, 10 + ct * 4, 18 - ct * 2)
        } else {
          const ct = Math.min(1, (elapsed - 5.0) / 4.0)
          camTgt.set(Math.sin(orbitAngle) * 4, 14 - ct * 6, 16 + ct * 18)
        }
        camera.position.lerp(camTgt, 0.05)
        lookTgt.set(0, Math.min(13, 4 + elapsed * 1.2), 0)
        camera.lookAt(lookTgt)

        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }

      raf = requestAnimationFrame(tick)

      function cleanup() {
        cancelAnimationFrame(raf)
        container.style.transform = ''
        document.body.classList.remove('nuke-whitehot')
        const bs = document.body.style
        bs.removeProperty('--nuke-bright')
        bs.removeProperty('--nuke-sat')
        bs.removeProperty('--nuke-sepia')
        bs.removeProperty('--nuke-glow')
        bs.removeProperty('--nuke-edge')
        if (sparkCtx) sparkCtx.clearRect(0, 0, sW, sH)
        if (peakFlashRef.current) peakFlashRef.current.style.opacity = '0'
        if (meltRef.current) meltRef.current.style.opacity = '0'
        if (heatRef.current) heatRef.current.style.opacity = '0'
        objs.forEach(o => { scene.remove(o); o.geometry?.dispose(); o.material?.dispose() })
        renderer.dispose()
        renderer.domElement.parentNode?.removeChild(renderer.domElement)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <div ref={meltRef} style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
        opacity: 0, mixBlendMode: 'screen',
      }} />
      <div ref={heatRef} style={{
        position: 'fixed', inset: 0, zIndex: 10002, pointerEvents: 'none',
        opacity: 0, mixBlendMode: 'overlay',
      }} />
      <div ref={peakFlashRef} style={{
        position: 'fixed', inset: 0, zIndex: 10004, pointerEvents: 'none',
        opacity: 0,
      }} />
      <canvas ref={sparkRef} style={{
        position: 'fixed', inset: 0, zIndex: 10003, pointerEvents: 'none',
      }} />
      <div ref={flashRef} style={{
        position: 'fixed', inset: 0, zIndex: 10001, pointerEvents: 'none',
        background: 'white', opacity: 0,
      }} />
      <div ref={containerRef} style={{
        position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none',
        width: '100vw', height: '100vh',
      }} />
    </>
  )
}

// BloodFill extracted to BloodFill.jsx

const ToolBtn = ({ children, onClick, disabled, active, title, style, dm = true }) => (
  <button
    className={`tb-btn flex flex-col items-center justify-center px-3 py-1 rounded-lg text-xs gap-0.5 transition-colors
      ${active
        ? (dm ? 'bg-blue-500/30 text-white' : 'bg-blue-500/20 text-blue-700')
        : (dm ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-black/5 hover:text-gray-900')}
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={style}
  >
    {children}
  </button>
)

function ToolDropdown({ label, icon, children, dm, iconOnly, bloodRain }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        className={`tb-btn flex flex-col items-center justify-center ${iconOnly ? 'px-1.5 w-8' : 'px-2'} py-1 rounded-lg text-xs gap-0.5 transition-colors cursor-pointer
          ${open
            ? (dm ? 'bg-blue-500/30 text-white' : 'bg-blue-500/20 text-blue-700')
            : (dm ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-black/5 hover:text-gray-900')}`}
        onClick={() => setOpen(v => !v)}
        title={label}
      >
        {icon}
        {!iconOnly && <span className="tb-label">{label}</span>}
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl border z-50 py-1 min-w-[160px] overflow-hidden ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
          onClick={(e) => { if (e.target.closest('[data-drop-item]')) setOpen(false) }}
        >
          {bloodRain && <BloodFill />}
          {children}
        </div>
      )}
    </div>
  )
}

function DropItem({ icon, label, onClick, disabled, dm }) {
  return (
    <button
      data-drop-item
      className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors text-left rounded
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      {label}
    </button>
  )
}

function DropSep({ dm }) {
  return <div className={`my-1 mx-2 border-t ${dm ? 'border-gray-700' : 'border-gray-100'}`} />
}

function DropLabel({ children, dm }) {
  return <div className={`px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{children}</div>
}

const AlignIcon = ({ type }) => {
  const icons = {
    left: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="2" y2="14"/><rect x="4" y="4" width="10" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="4" y="9" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    centerH: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="2" x2="8" y2="14" strokeDasharray="1.5 1.5"/><rect x="3" y="4" width="10" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="5" y="9" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    right: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="14" y1="2" x2="14" y2="14"/><rect x="2" y="4" width="10" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="6" y="9" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    top: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="2" x2="14" y2="2"/><rect x="4" y="4" width="3" height="10" rx="0.5" fill="currentColor" stroke="none"/><rect x="9" y="4" width="3" height="6" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    centerV: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8" strokeDasharray="1.5 1.5"/><rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" stroke="none"/><rect x="9" y="5" width="3" height="6" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    bottom: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="14" x2="14" y2="14"/><rect x="4" y="2" width="3" height="10" rx="0.5" fill="currentColor" stroke="none"/><rect x="9" y="6" width="3" height="6" rx="0.5" fill="currentColor" stroke="none"/></svg>,
    distH: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="2" x2="1" y2="14"/><line x1="15" y1="2" x2="15" y2="14"/><rect x="3" y="5" width="3" height="6" rx="0.5" fill="currentColor" stroke="none"/><rect x="10" y="5" width="3" height="6" rx="0.5" fill="currentColor" stroke="none"/><path d="M7 8h2" strokeWidth="1" strokeDasharray="1 1"/></svg>,
    distV: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="1" x2="14" y2="1"/><line x1="2" y1="15" x2="14" y2="15"/><rect x="5" y="3" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="5" y="10" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/><path d="M8 7v2" strokeWidth="1" strokeDasharray="1 1"/></svg>,
  }
  return icons[type] || null
}

function AlignPanel({ canvasState, bloodRain }) {
  const [open, setOpen] = useState(false)
  const [alignMode, setAlignMode] = useState('canvas')
  const panelRef = useRef(null)
  const { alignObjects, distributeObjects, selectedObject, darkMode } = canvasState
  const dm = !!darkMode
  const hasSelection = !!selectedObject
  const isMultiSelect = selectedObject?._objects?.length > 1

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const hasThreePlus = selectedObject?._objects?.length >= 3

  return (
    <div className="relative" ref={panelRef}>
      <ToolBtn dm={dm} onClick={() => setOpen(v => !v)} active={open} disabled={!hasSelection} title="Align & Distribute">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="2" x2="2" y2="14"/>
          <rect x="4" y="3" width="10" height="3" rx="0.5" fill="currentColor" stroke="none"/>
          <rect x="4" y="8" width="6" height="3" rx="0.5" fill="currentColor" stroke="none"/>
        </svg>
        <span>Align</span>
      </ToolBtn>
      {open && (
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-3 w-56 border overflow-hidden ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
          {bloodRain && <BloodFill />}
          {isMultiSelect && (
            <div className={`flex items-center rounded-md p-0.5 mb-2 ${dm ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <button
                className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${alignMode === 'canvas'
                  ? (dm ? 'bg-gray-600 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                  : (dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600')}`}
                onClick={() => setAlignMode('canvas')}
              >
                Canvas
              </button>
              <button
                className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${alignMode === 'selection'
                  ? (dm ? 'bg-gray-600 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                  : (dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600')}`}
                onClick={() => setAlignMode('selection')}
              >
                Selection
              </button>
            </div>
          )}
          <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            Align to {isMultiSelect ? (alignMode === 'canvas' ? 'Canvas' : 'Selection') : 'Canvas'}
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {[
              { dir: 'left', label: 'Align Left' },
              { dir: 'centerH', label: 'Center Horizontally' },
              { dir: 'right', label: 'Align Right' },
              { dir: 'top', label: 'Align Top' },
              { dir: 'centerV', label: 'Center Vertically' },
              { dir: 'bottom', label: 'Align Bottom' },
            ].map(({ dir, label }) => (
              <button
                key={dir}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded transition-colors cursor-pointer ${dm ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
                onClick={() => { alignObjects(dir, isMultiSelect ? alignMode : 'canvas'); setOpen(false) }}
                title={label}
              >
                <AlignIcon type={dir} />
                <span className="text-[9px] leading-none">{label.replace('Align ', '').replace(' Horizontally', '').replace(' Vertically', '')}</span>
              </button>
            ))}
          </div>
          <div className={`border-t pt-2 mt-1 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Distribute</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                className={`flex items-center gap-1.5 p-1.5 rounded text-[10px] transition-colors
                  ${hasThreePlus
                    ? (dm ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800 cursor-pointer')
                    : (dm ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')}`}
                onClick={() => { if (hasThreePlus) { distributeObjects('horizontal'); setOpen(false) } }}
                disabled={!hasThreePlus}
                title="Distribute Horizontally (3+ objects)"
              >
                <AlignIcon type="distH" />
                <span>Horizontal</span>
              </button>
              <button
                className={`flex items-center gap-1.5 p-1.5 rounded text-[10px] transition-colors
                  ${hasThreePlus
                    ? (dm ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800 cursor-pointer')
                    : (dm ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed')}`}
                onClick={() => { if (hasThreePlus) { distributeObjects('vertical'); setOpen(false) } }}
                disabled={!hasThreePlus}
                title="Distribute Vertically (3+ objects)"
              >
                <AlignIcon type="distV" />
                <span>Vertical</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TILE_MODES = [
  { id: 'none', label: 'None' },
  { id: 'basic', label: 'Basic' },
  { id: 'halfBrick', label: 'Half Brick' },
  { id: 'halfDrop', label: 'Half Drop' },
  { id: 'mirror', label: 'Mirror' },
]

function TileIcon({ mode, size = 40 }) {
  const s = size
  const g = s / 5
  const r = g * 0.35
  const cells = []

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let cx = g + col * (g * 1.2)
      let cy = g + row * (g * 1.2)
      let flipX = false
      let flipY = false

      if (mode === 'halfBrick' && row % 2 !== 0) cx += g * 0.6
      if (mode === 'halfDrop' && col % 2 !== 0) cy += g * 0.6
      if (mode === 'mirror') {
        flipX = col % 2 !== 0
        flipY = row % 2 !== 0
      }

      cells.push(
        <g key={`${row}-${col}`} transform={`translate(${cx}, ${cy})${flipX ? ` scale(-1,1)` : ''}${flipY ? ` scale(1,-1)` : ''}`}>
          <circle cx="0" cy="0" r={r} stroke="currentColor" strokeWidth="0.8" fill="none" />
          <polyline points={`${-r * 0.4},0 ${-r * 0.1},${r * 0.3} ${r * 0.4},${-r * 0.25}`} stroke="currentColor" strokeWidth="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {cells}
    </svg>
  )
}

const PASTEBOARD = 300

function TilePanel({ canvasState, bloodRain }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const { selectedObject, canvasRef, saveUndoState, refreshObjects, canvasW, canvasH, darkMode: dm } = canvasState
  const hasSelection = !!selectedObject

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const getTargetObj = () => {
    if (!selectedObject) return null
    if (selectedObject._dtoolTileClone) return null
    return selectedObject
  }

  const targetObj = getTargetObj()
  const currentMode = targetObj?._dtoolTileMode || 'none'
  const currentSpacing = targetObj?._dtoolTileSpacing || 0
  const currentRandomRot = !!targetObj?._dtoolTileRandomRotation

  const handleSelect = async (mode) => {
    let obj = getTargetObj()
    const canvas = canvasRef.current
    if (!obj || !canvas) return
    saveUndoState()

    const isActiveSelection = obj._objects && obj.type !== 'group'
    if (isActiveSelection) {
      const members = [...obj._objects]
      members.forEach(child => {
        if (child._dtoolTileMode && child._dtoolTileMode !== 'none') {
          removeTiling(canvas, child._dtoolId)
          child._dtoolTileMode = 'none'
        }
      })
      canvas.discardActiveObject()
      for (const m of members) canvas.remove(m)
      const group = new Group(members, { _dtoolId: uuidv4() })
      canvas.add(group)
      canvas.setActiveObject(group)
      obj = group
    }

    if (obj._objects && obj.type === 'group') {
      obj._objects.forEach(child => {
        if (child._dtoolTileMode && child._dtoolTileMode !== 'none') {
          removeTiling(canvas, child._dtoolId)
          child._dtoolTileMode = 'none'
        }
      })
    }

    removeOrphanedTileClones(canvas)
    await applyTiling(canvas, obj, mode, canvasW, canvasH, PASTEBOARD)
    canvas.requestRenderAll()
    refreshObjects()
    canvasState.setSelectedObject(obj)
  }

  const handleSpacingChange = async (val) => {
    const obj = getTargetObj()
    const canvas = canvasRef.current
    if (!obj || !canvas || currentMode === 'none') return
    obj._dtoolTileSpacing = val
    removeOrphanedTileClones(canvas)
    await applyTiling(canvas, obj, currentMode, canvasW, canvasH, PASTEBOARD)
    canvas.requestRenderAll()
    refreshObjects()
  }

  const handleRandomRotToggle = async () => {
    const obj = getTargetObj()
    const canvas = canvasRef.current
    if (!obj || !canvas || currentMode === 'none') return
    obj._dtoolTileRandomRotation = !obj._dtoolTileRandomRotation
    removeOrphanedTileClones(canvas)
    await applyTiling(canvas, obj, currentMode, canvasW, canvasH, PASTEBOARD)
    canvas.requestRenderAll()
    refreshObjects()
  }

  const isTilingActive = currentMode !== 'none'

  return (
    <div className="relative" ref={panelRef}>
      <ToolBtn dm={dm} onClick={() => setOpen(v => !v)} active={open || isTilingActive} disabled={!hasSelection} title="Tiling">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>Tiling</span>
      </ToolBtn>
      {open && (
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-3 w-auto overflow-hidden ${
          dm ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
        }`}>
          {bloodRain && <BloodFill />}
          <div className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${dm ? 'text-gray-400' : 'text-gray-400'}`}>Tiling</div>
          <div className="flex gap-2">
            {TILE_MODES.map(m => (
              <button
                key={m.id}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors cursor-pointer
                  ${currentMode === m.id
                    ? (dm ? 'border-indigo-400 bg-indigo-900/30' : 'border-indigo-500 bg-indigo-50')
                    : (dm ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50')}`}
                onClick={() => handleSelect(m.id)}
                title={m.label}
              >
                <div className={dm ? 'text-gray-300' : 'text-gray-600'}>
                  {m.id === 'none'
                    ? <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" /><polyline points="17,20 19,22.5 23.5,17.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : <TileIcon mode={m.id} size={40} />}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${dm ? 'text-gray-400' : 'text-gray-600'}`}>{m.label}</span>
              </button>
            ))}
          </div>

          {isTilingActive && (
            <div className={`mt-3 pt-3 border-t ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                Spacing
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-100}
                  max={200}
                  step={1}
                  value={currentSpacing}
                  onChange={(e) => handleSpacingChange(Number(e.target.value))}
                  className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${
                    dm ? 'accent-blue-400 bg-gray-600' : 'accent-blue-500 bg-gray-200'
                  }`}
                />
                <span className={`text-xs tabular-nums w-12 text-right ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                  {currentSpacing} px
                </span>
              </div>
              <div className={`text-[9px] mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                Negative = overlap, Positive = gap
              </div>

              <label className={`flex items-center justify-between mt-3 py-1.5 rounded cursor-pointer transition-colors ${
                dm ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
              }`}>
                <span className={`text-xs ${dm ? 'text-gray-200' : 'text-gray-700'}`}>
                  Randomize Rotation
                </span>
                <div className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={currentRandomRot}
                    onChange={handleRandomRotToggle}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${
                    currentRandomRot
                      ? 'bg-blue-500'
                      : dm ? 'bg-gray-600' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full shadow transition-transform ${
                      currentRandomRot ? 'translate-x-4 bg-white' : (dm ? 'translate-x-0 bg-gray-300' : 'translate-x-0 bg-white')
                    }`} />
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlobBrushSettings({ canvasState }) {
  const { activeTool, setActiveTool, darkMode } = canvasState
  const isActive = activeTool === 'blobBrush'

  return (
    <ToolBtn
      dm={!!darkMode}
      onClick={() => setActiveTool(isActive ? 'select' : 'blobBrush')}
      active={isActive}
      title="Blob Brush (B)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.37 2.63a2.12 2.12 0 013 3L14 13l-4 1 1-4z" />
        <path d="M9 14c-2.5 2-4.5 4-4.5 6a2.5 2.5 0 005 0c0-2-1-3.5-2-5" />
      </svg>
      <span>Blob</span>
    </ToolBtn>
  )
}

function PenToolSettings({ canvasState }) {
  const { activeTool, setActiveTool, darkMode } = canvasState
  const isActive = activeTool === 'pen'

  return (
    <ToolBtn
      dm={!!darkMode}
      onClick={() => setActiveTool(isActive ? 'select' : 'pen')}
      active={isActive}
      title="Pen Tool (P)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" fill="currentColor" stroke="none" />
      </svg>
      <span>Pen</span>
    </ToolBtn>
  )
}

const UNITS = [
  { id: 'px', label: 'Pixels', abbr: 'px' },
  { id: 'in', label: 'Inches', abbr: 'in' },
  { id: 'cm', label: 'Centimeters', abbr: 'cm' },
  { id: 'mm', label: 'Millimeters', abbr: 'mm' },
  { id: 'pt', label: 'Points', abbr: 'pt' },
]
const DPI_OPTIONS = [72, 96, 150, 300]
function pxToUnit(px, unit, dpi) {
  if (unit === 'in') return px / dpi
  if (unit === 'cm') return (px / dpi) * 2.54
  if (unit === 'mm') return (px / dpi) * 25.4
  if (unit === 'pt') return (px / dpi) * 72
  return px
}
function unitToPx(val, unit, dpi) {
  if (unit === 'in') return val * dpi
  if (unit === 'cm') return (val / 2.54) * dpi
  if (unit === 'mm') return (val / 25.4) * dpi
  if (unit === 'pt') return (val / 72) * dpi
  return val
}
function fmtVal(v, unit) {
  if (unit === 'px') return Math.round(v).toString()
  return v.toFixed(2).replace(/\.?0+$/, '')
}

const CANVAS_PRESETS = [
  { id: '1x1',   label: '1 : 1',    wPx: 2160, hPx: 2160, unit: 'px', dpi: 72,  desc: 'Square',          sizeHint: '2160×2160' },
  { id: '9x16',  label: '9 : 16',   wPx: 2160, hPx: 3840, unit: 'px', dpi: 72,  desc: 'Story / Reel 4K', sizeHint: '2160×3840' },
  { id: '16x9',  label: '16 : 9',   wPx: 3840, hPx: 2160, unit: 'px', dpi: 72,  desc: 'Widescreen 4K',   sizeHint: '3840×2160' },
  { id: '4x5',   label: '4 : 5',    wPx: 2160, hPx: 2700, unit: 'px', dpi: 72,  desc: 'Instagram Post',  sizeHint: '2160×2700' },
  { id: '5x7',   label: '5 × 7',    wPx: 1500, hPx: 2100, unit: 'in', dpi: 300, desc: 'Portrait',        sizeHint: '5×7 in' },
  { id: 'letter',label: 'Letter',   wPx: 2550, hPx: 3300, unit: 'in', dpi: 300, desc: '8.5×11 in',       sizeHint: '8.5×11 in' },
  { id: 'a4',    label: 'A4',       wPx: 2480, hPx: 3508, unit: 'mm', dpi: 300, desc: '210×297 mm',      sizeHint: '210×297 mm' },
  { id: '1080p', label: '1080p',   wPx: 1920, hPx: 1080, unit: 'px', dpi: 72,  desc: 'Full HD',         sizeHint: '1920×1080' },
  { id: '2x3',   label: '2 : 3',   wPx: 2000, hPx: 3000, unit: 'px', dpi: 72,  desc: 'Pinterest Pin',   sizeHint: '2000×3000' },
  { id: '4x6',   label: '4 × 6',   wPx: 1200, hPx: 1800, unit: 'in', dpi: 300, desc: 'Photo Print',     sizeHint: '4×6 in' },
  { id: 'fbcover',label: 'Cover',  wPx: 1640, hPx: 624,  unit: 'px', dpi: 72,  desc: 'Facebook Cover',  sizeHint: '1640×624' },
]

function CanvasSizePicker({ canvasState, bloodRain }) {
  const { canvasW, canvasH, setCanvasW, setCanvasH, canvasUnit: unit, setCanvasUnit: setUnit, canvasDpi: dpi, setCanvasDpi: setDpi, darkMode } = canvasState
  const dm = !!darkMode
  const [open, setOpen] = useState(false)
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open) {
      setCustomW(fmtVal(pxToUnit(canvasW, unit, dpi), unit))
      setCustomH(fmtVal(pxToUnit(canvasH, unit, dpi), unit))
    }
  }, [open, unit, dpi])

  const applyCustom = () => {
    const wVal = parseFloat(customW)
    const hVal = parseFloat(customH)
    if (!wVal || !hVal || wVal <= 0 || hVal <= 0) return
    const newW = Math.round(unitToPx(wVal, unit, dpi))
    const newH = Math.round(unitToPx(hVal, unit, dpi))
    if (newW < 10 || newH < 10 || newW > 10000 || newH > 10000) return
    setCanvasW(newW)
    setCanvasH(newH)
    setOpen(false)
  }

  const applyPreset = (preset) => {
    setUnit(preset.unit)
    setDpi(preset.dpi)
    setCanvasW(preset.wPx)
    setCanvasH(preset.hPx)
    setOpen(false)
  }

  const unitAbbr = UNITS.find(u => u.id === unit)?.abbr || 'px'
  const wDisp = fmtVal(pxToUnit(canvasW, unit, dpi), unit)
  const hDisp = fmtVal(pxToUnit(canvasH, unit, dpi), unit)
  const currentLabel = `${wDisp} × ${hDisp} ${unitAbbr}`

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
          open
            ? (dm ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800')
            : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100')
        }`}
        title="Canvas Size"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h4M3 15h4M9 3v4M15 3v4" />
        </svg>
        <span className="font-medium">{currentLabel}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
      </button>

      {open && (
        <>
        <style>{`
          @keyframes sizeDropBloodDrip {
            0% { clip-path: inset(0 0 100% 0); opacity: 0; }
            15% { clip-path: inset(0 0 80% 0); opacity: 1; }
            40% { clip-path: inset(0 0 40% 0); }
            70% { clip-path: inset(0 0 5% 0); }
            100% { clip-path: inset(0 0 0% 0); opacity: 1; }
          }

          @keyframes bloodFall {
            0% { transform: translateY(-60px); opacity: 0; }
            8% { opacity: 0.7; }
            50% { opacity: 0.65; }
            85% { opacity: 0.4; }
            100% { transform: translateY(var(--travel)); opacity: 0; }
          }

          @keyframes bloodFallFast {
            0% { transform: translateY(-40px); opacity: 0; }
            6% { opacity: 0.8; }
            50% { opacity: 0.6; }
            82% { opacity: 0.35; }
            100% { transform: translateY(var(--travel)); opacity: 0; }
          }

          @keyframes puddleRise {
            0% { height: 0%; opacity: 0; }
            5% { height: 2%; opacity: 0.6; }
            15% { height: 8%; }
            30% { height: 20%; opacity: 0.8; }
            50% { height: 40%; }
            70% { height: 58%; opacity: 0.9; }
            85% { height: 68%; }
            100% { height: 75%; opacity: 1; }
          }

          @keyframes puddleRipple {
            0% { transform: scaleX(1) scaleY(1); opacity: 0.5; }
            50% { transform: scaleX(1.8) scaleY(0.6); opacity: 0.2; }
            100% { transform: scaleX(2.5) scaleY(0.3); opacity: 0; }
          }

          @keyframes surfaceWobble {
            0%, 100% { transform: scaleY(1) translateY(0); }
            25% { transform: scaleY(1.3) translateY(-1px); }
            50% { transform: scaleY(0.7) translateY(1px); }
            75% { transform: scaleY(1.2) translateY(-0.5px); }
          }

          @keyframes puddleShine {
            0%, 100% { opacity: 0.15; transform: translateX(0); }
            50% { opacity: 0.45; transform: translateX(3px); }
          }

          .size-drop-metal {
            animation: sizeDropBloodDrip 0.5s ease-out forwards;
            transform-origin: top center;
          }

          .blood-rain-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
            border-radius: inherit;
          }

          .blood-streak {
            position: absolute;
            top: 0;
            border-radius: 1px;
            animation: bloodFall var(--dur) linear infinite;
          }
          .blood-streak.fast {
            animation-name: bloodFallFast;
          }

          .blood-streak-inner {
            width: 100%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(180deg,
              rgba(180,0,0,0) 0%,
              rgba(180,0,0,0.15) 8%,
              rgba(190,0,0,0.5) 18%,
              #bb0000 30%,
              #dd1111 45%,
              #cc0000 65%,
              rgba(150,0,0,0.3) 85%,
              rgba(120,0,0,0) 100%
            );
          }

          .blood-puddle {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 0%;
            pointer-events: none;
            z-index: 2;
            border-radius: 0 0 8px 8px;
            overflow: hidden;
            animation: puddleRise 8s cubic-bezier(0.25, 0.1, 0.25, 1) 0.4s both;
          }

          .blood-puddle-fill {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg,
              rgba(100,0,0,0.0) 0%,
              rgba(130,0,0,0.15) 10%,
              rgba(160,5,5,0.4) 30%,
              rgba(170,10,10,0.6) 50%,
              rgba(160,0,0,0.78) 70%,
              #8b0000 88%,
              #660000 100%
            );
          }

          .blood-puddle-surface {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(255,80,80,0.12) 10%,
              rgba(255,120,120,0.25) 30%,
              rgba(255,160,160,0.35) 50%,
              rgba(255,120,120,0.25) 70%,
              rgba(255,80,80,0.12) 90%,
              transparent 100%
            );
            animation: puddleShine 4s ease-in-out infinite;
          }

          .blood-puddle-meniscus {
            position: absolute;
            top: -1px;
            left: 0;
            width: 100%;
            height: 4px;
            background: linear-gradient(180deg,
              rgba(200,20,20,0.5) 0%,
              rgba(160,0,0,0.3) 50%,
              transparent 100%
            );
            animation: surfaceWobble 3s ease-in-out infinite;
          }

          .blood-puddle-ripple {
            position: absolute;
            border: 1px solid rgba(220,40,40,0.25);
            border-radius: 50%;
            animation: puddleRipple 1.5s ease-out infinite;
          }

          .size-drop-metal .size-shimmer {
            position: absolute;
            top: 0; left: -100%; width: 50%; height: 100%;
            background: linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,60,60,0.06) 40%, rgba(255,100,100,0.12) 48%, rgba(255,160,160,0.18) 50%, rgba(255,100,100,0.12) 52%, rgba(255,60,60,0.06) 60%, transparent 70%, transparent 100%);
            animation: chromeShimmerSweep 8s ease-in-out 0.6s infinite;
            pointer-events: none;
            filter: blur(1px);
          }
        `}</style>
        <div
          className="size-drop-metal absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 w-72"
          style={{
            background: dm ? '#1f2937' : '#ffffff',
            border: dm ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'visible',
          }}
        >
          {bloodRain && <BloodFill />}
          <div className="size-shimmer" />
          <div className="max-h-[80vh] overflow-y-auto overflow-x-hidden rounded-lg">

          <div style={{ borderBottom: dm ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb', padding: '12px' }}>
            <div className={`text-[10px] uppercase tracking-[0.15em] font-bold mb-2 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Units &amp; Resolution</div>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`flex-1 rounded px-2 py-1 text-xs outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                style={{ border: '1px solid' }}
              >
                {UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.label} ({u.abbr})</option>
                ))}
              </select>
              <select
                value={dpi}
                onChange={(e) => setDpi(parseInt(e.target.value))}
                className={`w-[72px] rounded px-1.5 py-1 text-xs outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                style={{ border: '1px solid' }}
              >
                {DPI_OPTIONS.map(d => (
                  <option key={d} value={d}>{d} DPI</option>
                ))}
              </select>
            </div>

            <div className={`text-[10px] uppercase tracking-[0.15em] font-bold mb-1.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Custom Size</div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="flex-1">
                <label className={`text-[9px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Width</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                    min={0}
                    step={unit === 'px' ? 1 : 0.1}
                    className={`w-full rounded px-2 py-1 text-xs tabular-nums outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-400'}`}
                    style={{ border: '1px solid' }}
                  />
                  <span className={`text-[10px] shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
                </div>
              </div>
              <div className={`mt-3.5 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>×</div>
              <div className="flex-1">
                <label className={`text-[9px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Height</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                    min={0}
                    step={unit === 'px' ? 1 : 0.1}
                    className={`w-full rounded px-2 py-1 text-xs tabular-nums outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-700 focus:border-blue-400'}`}
                    style={{ border: '1px solid' }}
                  />
                  <span className={`text-[10px] shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
                </div>
              </div>
            </div>
            <button
              onClick={applyCustom}
              className={`w-full py-1.5 rounded text-xs font-bold transition-all hover:scale-[1.02] ${dm ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              Apply Size
            </button>
            <div className={`text-[9px] mt-1 text-center ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {Math.round(unitToPx(parseFloat(customW) || 0, unit, dpi))} × {Math.round(unitToPx(parseFloat(customH) || 0, unit, dpi))} px
            </div>
          </div>

          <div className="py-1">
            <div className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-bold ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Presets</div>
            {CANVAS_PRESETS.map(preset => {
              const isActive = preset.wPx === canvasW && preset.hPx === canvasH
              const aspect = Math.min(preset.wPx, preset.hPx) / Math.max(preset.wPx, preset.hPx)
              const thumbW = preset.wPx >= preset.hPx ? 22 : Math.round(22 * aspect)
              const thumbH = preset.hPx >= preset.wPx ? 22 : Math.round(22 * aspect)
              const sizeLabel = preset.unit === 'px'
                ? `${preset.wPx}×${preset.hPx}`
                : `${preset.sizeHint} · ${preset.wPx}×${preset.hPx} px`
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? (dm ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600')
                      : (dm ? 'text-gray-300 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  <div className="w-7 h-7 flex items-center justify-center shrink-0">
                    <div
                      style={{
                        width: thumbW, height: thumbH,
                        border: isActive ? (dm ? '2px solid #60a5fa' : '2px solid #3b82f6') : (dm ? '2px solid #4b5563' : '2px solid #d1d5db'),
                        borderRadius: 2,
                        background: isActive ? (dm ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : (dm ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{preset.desc} · {sizeLabel}</div>
                  </div>
                  {isActive && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dm ? '#60a5fa' : '#3b82f6'} strokeWidth="3" className="shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          </div>{/* end scrollable inner */}
        </div>
        </>
      )}
    </div>
  )
}

function PrinterMarksPanel({ canvasState, bloodRain }) {
  const [open, setOpen] = useState(false)
  const [linkBleed, setLinkBleed] = useState(true)
  const [linkSafe, setLinkSafe] = useState(true)
  const panelRef = useRef(null)
  const { printerMarks: pm, setPrinterMarks, darkMode: dm, canvasUnit: unit, canvasDpi: dpi, canvasW, canvasH } = canvasState

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const toggle = (key) => setPrinterMarks(prev => ({ ...prev, [key]: !prev[key] }))

  const unitAbbr = UNITS.find(u => u.id === unit)?.abbr || 'px'

  const toDisplay = (pxVal) => {
    const v = pxToUnit(pxVal, unit, dpi)
    return unit === 'px' ? Math.round(v).toString() : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  }
  const fromDisplay = (displayVal) => {
    const v = parseFloat(displayVal)
    if (isNaN(v) || v < 0) return 0
    return Math.round(unitToPx(v, unit, dpi))
  }

  const setBleedSide = (side, rawVal) => {
    const px = fromDisplay(rawVal)
    if (linkBleed) {
      setPrinterMarks(prev => ({ ...prev, bleedTop: px, bleedRight: px, bleedBottom: px, bleedLeft: px }))
    } else {
      setPrinterMarks(prev => ({ ...prev, [side]: px }))
    }
  }
  const setSafeSide = (side, rawVal) => {
    const px = fromDisplay(rawVal)
    const maxPx = Math.floor(Math.min(canvasW, canvasH) / 2)
    const clamped = Math.min(px, maxPx)
    if (linkSafe) {
      setPrinterMarks(prev => ({ ...prev, safeTop: clamped, safeRight: clamped, safeBottom: clamped, safeLeft: clamped }))
    } else {
      setPrinterMarks(prev => ({ ...prev, [side]: clamped }))
    }
  }

  const anyOn = pm.bleedLine || pm.cutLine || pm.safeArea || pm.cropMarks || pm.registrationMarks || pm.colorBars || pm.gridLines
  const hasBleed = (pm.bleedTop || 0) + (pm.bleedRight || 0) + (pm.bleedBottom || 0) + (pm.bleedLeft || 0) > 0
  const safeSmall = pm.safeArea && Math.min(pm.safeTop || 0, pm.safeRight || 0, pm.safeBottom || 0, pm.safeLeft || 0) < 9

  /* ToggleRow and OffsetInput are defined at module level to avoid focus loss */

  const LinkBtn = ({ linked, onToggle }) => (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
        linked ? (dm ? 'text-blue-400 bg-blue-900/30' : 'text-blue-600 bg-blue-50')
               : (dm ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600')
      }`}
      title={linked ? 'Linked: all sides equal' : 'Unlinked: set each side independently'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {linked ? (
          <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
        ) : (
          <><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" /><line x1="2" y1="2" x2="22" y2="22" /></>
        )}
      </svg>
      <span>{linked ? 'Linked' : 'Per side'}</span>
    </button>
  )

  const SchematicPreview = () => {
    const w = 120, h = 80, pad = 16
    const bScale = 10, sScale = 8
    const cx = w / 2, cy = h / 2
    const dw = w - pad * 2, dh = h - pad * 2
    const dx = pad, dy = pad
    return (
      <svg width={w} height={h} className="mx-auto" viewBox={`0 0 ${w} ${h}`}>
        {pm.bleedLine && (
          <rect x={dx - bScale} y={dy - bScale} width={dw + bScale * 2} height={dh + bScale * 2}
            fill="none" stroke="rgba(255,40,40,0.5)" strokeWidth="1" strokeDasharray="3 2" />
        )}
        {hasBleed && (
          <>
            <rect x={dx - bScale} y={dy - bScale} width={dw + bScale * 2} height={bScale}
              fill="rgba(255,40,40,0.08)" />
            <rect x={dx - bScale} y={dy + dh} width={dw + bScale * 2} height={bScale}
              fill="rgba(255,40,40,0.08)" />
            <rect x={dx - bScale} y={dy} width={bScale} height={dh}
              fill="rgba(255,40,40,0.08)" />
            <rect x={dx + dw} y={dy} width={bScale} height={dh}
              fill="rgba(255,40,40,0.08)" />
          </>
        )}
        <rect x={dx} y={dy} width={dw} height={dh}
          fill={dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}
          stroke={dm ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} strokeWidth="1" />
        {pm.cutLine && (
          <rect x={dx} y={dy} width={dw} height={dh}
            fill="none" stroke="rgba(0,200,80,0.7)" strokeWidth="1.5" strokeDasharray="4 2" />
        )}
        {pm.safeArea && (
          <rect x={dx + sScale} y={dy + sScale} width={dw - sScale * 2} height={dh - sScale * 2}
            fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1" strokeDasharray="3 2" />
        )}
        {pm.safeArea && (
          <text x={cx} y={cy - 2} textAnchor="middle" fill={dm ? 'rgba(96,165,250,0.7)' : 'rgba(59,130,246,0.6)'} fontSize="7" fontWeight="500">Safe Area</text>
        )}
        <text x={cx} y={cy + 7} textAnchor="middle" fill={dm ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} fontSize="6">Canvas / Trim</text>
        {pm.bleedLine && (
          <text x={cx} y={dy - bScale + 7} textAnchor="middle" fill="rgba(255,40,40,0.5)" fontSize="5.5">Bleed</text>
        )}
        {pm.cropMarks && (
          <>
            <line x1={dx} y1={dy - bScale - 2} x2={dx} y2={dy - bScale - 6} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx - bScale - 2} y1={dy} x2={dx - bScale - 6} y2={dy} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx + dw} y1={dy - bScale - 2} x2={dx + dw} y2={dy - bScale - 6} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx + dw + bScale + 2} y1={dy} x2={dx + dw + bScale + 6} y2={dy} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx} y1={dy + dh + bScale + 2} x2={dx} y2={dy + dh + bScale + 6} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx - bScale - 2} y1={dy + dh} x2={dx - bScale - 6} y2={dy + dh} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx + dw} y1={dy + dh + bScale + 2} x2={dx + dw} y2={dy + dh + bScale + 6} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
            <line x1={dx + dw + bScale + 2} y1={dy + dh} x2={dx + dw + bScale + 6} y2={dy + dh} stroke={dm ? '#aaa' : '#555'} strokeWidth="0.7" />
          </>
        )}
      </svg>
    )
  }

  return (
    <div className="relative" ref={panelRef}>
      <ToolBtn dm={dm} onClick={() => setOpen(v => !v)} active={open || anyOn} title="Bleed & Printer's Marks">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 3L1 1M21 3l2-2M3 21l-2 2M21 21l2 2" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <path d="M12 8v-2M12 18v-2M8 12H6M18 12h-2" strokeWidth="1.5" />
        </svg>
        <span>Marks</span>
      </ToolBtn>

      {open && (
        <div className={`absolute top-full right-0 mt-1 rounded-lg shadow-xl z-50 w-80 max-h-[80vh] overflow-y-auto ${
          dm ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
        }`}>
          {bloodRain && <BloodFill />}
          {/* Header */}
          <div className={`px-3 py-2 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className={`text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              Print Marks & Zones
            </div>
          </div>

          {/* Schematic Preview */}
          <div className={`px-3 py-2.5 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <SchematicPreview />
            <div className="flex items-center justify-center gap-3 mt-1.5">
              {[
                { color: '#ff2828', label: 'Bleed', on: pm.bleedLine },
                { color: '#00c850', label: 'Trim', on: pm.cutLine },
                { color: '#3b82f6', label: 'Safe', on: pm.safeArea },
              ].map(z => (
                <span key={z.label} className={`flex items-center gap-1 text-[9px] ${z.on ? '' : 'opacity-30'} ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                  {z.label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 1. Bleed ── */}
          <div className={`px-3 py-2.5 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#ff2828' }} />
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Bleed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LinkBtn linked={linkBleed} onToggle={() => setLinkBleed(v => !v)} />
                <div className="relative inline-flex items-center">
                  <input type="checkbox" checked={pm.bleedLine} onChange={() => toggle('bleedLine')} className="sr-only" />
                  <div onClick={() => toggle('bleedLine')} className={`w-8 h-[18px] rounded-full cursor-pointer transition-colors ${pm.bleedLine ? 'bg-blue-500' : dm ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full shadow transition-transform ${pm.bleedLine ? 'translate-x-[14px] bg-white' : (dm ? 'translate-x-0 bg-gray-300' : 'translate-x-0 bg-white')}`} />
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-[10px] leading-snug mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              Extends beyond the trim edge to prevent white borders after cutting.
            </p>
            <div className="flex items-center justify-between gap-1.5">
              <OffsetInput label="Top" value={toDisplay(pm.bleedTop)} onChange={v => setBleedSide('bleedTop', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Right" value={toDisplay(pm.bleedRight)} onChange={v => setBleedSide('bleedRight', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Bottom" value={toDisplay(pm.bleedBottom)} onChange={v => setBleedSide('bleedBottom', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Left" value={toDisplay(pm.bleedLeft)} onChange={v => setBleedSide('bleedLeft', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <span className={`text-[9px] self-end pb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
            </div>
            {!hasBleed && (
              <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${dm ? 'text-amber-400/80' : 'text-amber-600'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Artwork may be clipped after cutting
              </div>
            )}
            <div className={`text-[9px] mt-1 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>Standard: 0.125 in / 3 mm</div>
          </div>

          {/* ── 2. Cut / Trim Line ── */}
          <div className={`px-3 py-2.5 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#00c850' }} />
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Cut / Trim Line</span>
              </div>
              <div className="relative inline-flex items-center">
                <input type="checkbox" checked={pm.cutLine} onChange={() => toggle('cutLine')} className="sr-only" />
                <div onClick={() => toggle('cutLine')} className={`w-8 h-[18px] rounded-full cursor-pointer transition-colors ${pm.cutLine ? 'bg-blue-500' : dm ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full shadow transition-transform ${pm.cutLine ? 'translate-x-[14px] bg-white' : (dm ? 'translate-x-0 bg-gray-300' : 'translate-x-0 bg-white')}`} />
                </div>
              </div>
            </div>
            <p className={`text-[10px] leading-snug mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              The finished document edge. Defined by your canvas size — not editable here.
            </p>
            <div className={`flex items-center gap-2 text-[10px] ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className={`px-1.5 py-0.5 rounded ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {fmtVal(pxToUnit(canvasW, unit, dpi), unit)} × {fmtVal(pxToUnit(canvasH, unit, dpi), unit)} {unitAbbr}
              </span>
              <span className={`text-[9px] ${dm ? 'text-gray-600' : 'text-gray-300'}`}>({canvasW} × {canvasH} px)</span>
            </div>
          </div>

          {/* ── 3. Safe Area ── */}
          <div className={`px-3 py-2.5 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Safe Area</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LinkBtn linked={linkSafe} onToggle={() => setLinkSafe(v => !v)} />
                <div className="relative inline-flex items-center">
                  <input type="checkbox" checked={pm.safeArea} onChange={() => toggle('safeArea')} className="sr-only" />
                  <div onClick={() => toggle('safeArea')} className={`w-8 h-[18px] rounded-full cursor-pointer transition-colors ${pm.safeArea ? 'bg-blue-500' : dm ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full shadow transition-transform ${pm.safeArea ? 'translate-x-[14px] bg-white' : (dm ? 'translate-x-0 bg-gray-300' : 'translate-x-0 bg-white')}`} />
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-[10px] leading-snug mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              Keep critical content inside this area to avoid cropping during cutting.
            </p>
            <div className="flex items-center justify-between gap-1.5">
              <OffsetInput label="Top" value={toDisplay(pm.safeTop || 9)} onChange={v => setSafeSide('safeTop', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Right" value={toDisplay(pm.safeRight || 9)} onChange={v => setSafeSide('safeRight', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Bottom" value={toDisplay(pm.safeBottom || 9)} onChange={v => setSafeSide('safeBottom', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <OffsetInput label="Left" value={toDisplay(pm.safeLeft || 9)} onChange={v => setSafeSide('safeLeft', v)} dm={dm} step={unit === 'px' ? 1 : 0.01} />
              <span className={`text-[9px] self-end pb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
            </div>
            {safeSmall && (
              <div className={`flex items-center gap-1 mt-1.5 text-[10px] ${dm ? 'text-amber-400/80' : 'text-amber-600'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Small safe margin — critical content may be cropped
              </div>
            )}
            <div className={`text-[9px] mt-1 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>Standard: 0.125 in / 3 mm inward</div>
          </div>

          {/* ── Guides ── */}
          <div className={`py-1 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className={`px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              Guides
            </div>
            <ToggleRow label="Grid Lines" checked={pm.gridLines} onChange={() => toggle('gridLines')} dm={dm} />
          </div>

          {/* ── Printer's Marks ── */}
          <div className="py-1">
            <div className={`px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider font-semibold ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              Printer's Marks
            </div>
            <ToggleRow label="Crop Marks" checked={pm.cropMarks} onChange={() => toggle('cropMarks')} disabled={!hasBleed} dm={dm} />
            <ToggleRow label="Registration Marks" checked={pm.registrationMarks} onChange={() => toggle('registrationMarks')} disabled={!hasBleed} dm={dm} />
            <ToggleRow label="Color Bars" checked={pm.colorBars} onChange={() => toggle('colorBars')} disabled={!hasBleed} dm={dm} />
            {!hasBleed && (
              <p className={`px-3 pb-1.5 text-[9px] ${dm ? 'text-gray-600' : 'text-gray-300'}`}>
                Set a bleed value to enable printer's marks.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AiToolsDropdown({ canvasState, dm, bloodRain }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const [error, setError] = useState('')

  const placeImage = useCallback((url) => {
    const canvas = canvasState?.canvasRef?.current
    if (!canvas) return

    const tryLoad = (useCors) => {
      const img = new Image()
      if (useCors) img.crossOrigin = 'anonymous'
      img.onload = async () => {
        const { FabricImage } = await import('fabric')
        const { v4: uuidv4 } = await import('uuid')
        if (canvasState.saveUndoState) canvasState.saveUndoState()
        const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
        const maxDim = 400
        if (fImg.width > maxDim || fImg.height > maxDim) {
          const scale = maxDim / Math.max(fImg.width, fImg.height)
          fImg.set({ scaleX: scale, scaleY: scale })
        }
        fImg.set({ left: 80 + Math.random() * 60, top: 80 + Math.random() * 60 })
        canvas.add(fImg)
        canvas.setActiveObject(fImg)
        canvas.renderAll()
        if (canvasState.refreshObjects) canvasState.refreshObjects()
      }
      img.onerror = () => {
        if (useCors) {
          tryLoad(false)
        } else {
          console.error('Image failed to load:', url)
          setError('Image failed to load')
        }
      }
      img.src = url
    }
    tryLoad(true)
  }, [canvasState])

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const { generateImage } = await import('../utils/aiImageApi')
      const { saveToGallery } = await import('../utils/imageGallery')
      const data = await generateImage({ prompt: prompt.trim() })
      const url = data.urls?.[0]
      if (url) {
        saveToGallery({ url, prompt: prompt.trim(), source: 'Quick Generate' })
        placeImage(url)
        setPrompt('')
        setOpen(false)
      } else {
        setError('No image URL returned')
      }
    } catch (err) {
      console.error('AI image gen failed:', err)
      setError(err.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative mr-1">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 shrink-0 ${dm ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        title="AI Image Generate"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={dm ? '#ffffff' : '#374151'}>
          <path d="M10 2 L11.5 6.5 L16 8 L11.5 9.5 L10 14 L8.5 9.5 L4 8 L8.5 6.5 Z" />
          <path d="M18 10 L19 12.5 L21.5 13.5 L19 14.5 L18 17 L17 14.5 L14.5 13.5 L17 12.5 Z" />
          <path d="M7 14 L7.7 16 L9.5 16.7 L7.7 17.4 L7 19.5 L6.3 17.4 L4.5 16.7 L6.3 16 Z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 rounded-lg shadow-2xl z-50 p-3 flex flex-col gap-2 overflow-hidden"
          style={{
            background: dm ? '#1a1a2e' : '#ffffff',
            border: dm ? '1px solid rgba(100,160,255,0.3)' : '1px solid #e2e8f0',
          }}
        >
          {bloodRain && <BloodFill />}
          <div className="text-xs font-bold mb-1" style={{ color: dm ? '#8bb8ff' : '#2563eb' }}>
            ⚡ Quick Image Generate
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image you want..."
            rows={2}
            className="w-full rounded px-2 py-1.5 text-xs resize-none outline-none"
            style={{
              background: dm ? 'rgba(30,30,50,0.8)' : '#f8fafc',
              border: dm ? '1px solid rgba(100,160,255,0.3)' : '1px solid #cbd5e1',
              color: dm ? '#e2e8f0' : '#1e293b',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
            autoFocus
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full rounded py-1.5 text-xs font-bold uppercase transition-all hover:scale-[1.02] disabled:opacity-50"
            style={{
              background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
              color: '#fff',
              border: '1px solid #c0c0d0',
            }}
          >
            {loading ? 'Generating...' : 'Generate & Add to Canvas'}
          </button>
          {error && <div className="text-[9px] mt-1 px-1 py-0.5 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>{error}</div>}
          <div className="text-[9px] mt-1" style={{ color: dm ? '#666' : '#94a3b8' }}>
            For more AI tools (edit, BG removal, restore, colorize), open the AI Tools panel on the left sidebar.
          </div>
        </div>
      )}
    </div>
  )
}

export default function Toolbar({ canvasState, onToggleDarkMode }) {
  const {
    canvasRef, saveUndoState, undo, redo, undoStackRef, redoStackRef, historyVersion, refreshObjects,
    copySelected, pasteFromClipboard, cutSelected, duplicateSelected,
    deleteSelected, groupSelected, ungroupSelected, bringForward, sendBackward, selectedObject,
    activeTool, setActiveTool,
    autoplay, setAutoplay,
    darkMode,
    bloodRain, setBloodRain,
    laserSmoke, setLaserSmoke,
  } = canvasState

  const toolbarRef = useRef(null)
  const logoImgRef = useRef(null)
  const logoShimmerRef = useRef(null)
  const logoShimmer2Ref = useRef(null)
  const [logoDims, setLogoDims] = useState({ w: 0, h: 0 })
  const [collapse, setCollapse] = useState(0)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [nukeActive, setNukeActive] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutText, setLogoutText] = useState(() => pickRandom(LOGOUT_TEXTS))
  const musicRef = useRef(null)
  const bloodAudioRef = useRef(null)

  // Initialize audio element
  useEffect(() => {
    musicRef.current = new Audio('/theme_song.mp4')
    musicRef.current.loop = true
    musicRef.current.volume = 0.5
    return () => {
      if (musicRef.current) {
        musicRef.current.pause()
        musicRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!bloodRain) {
      if (bloodAudioRef.current) {
        try { bloodAudioRef.current.destroy() } catch {}
        bloodAudioRef.current = null
      }
      const container = document.getElementById('blood-rain-yt')
      if (container) container.innerHTML = ''
      return
    }

    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        createPlayer()
        return
      }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev()
        createPlayer()
      }
    }

    const createPlayer = () => {
      let container = document.getElementById('blood-rain-yt')
      if (!container) {
        container = document.createElement('div')
        container.id = 'blood-rain-yt'
        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;'
        document.body.appendChild(container)
      }
      const div = document.createElement('div')
      container.innerHTML = ''
      container.appendChild(div)
      bloodAudioRef.current = new window.YT.Player(div, {
        videoId: 'z8ZqFlw6hYg',
        playerVars: { autoplay: 1, loop: 1, playlist: 'z8ZqFlw6hYg' },
        events: {
          onReady: (e) => { e.target.setVolume(60); e.target.playVideo() },
        },
      })
    }

    loadApi()
    return () => {
      if (bloodAudioRef.current) {
        try { bloodAudioRef.current.destroy() } catch {}
        bloodAudioRef.current = null
      }
      const container = document.getElementById('blood-rain-yt')
      if (container) container.innerHTML = ''
    }
  }, [bloodRain])

  const toggleMusic = () => {
    if (!musicRef.current) return
    if (musicPlaying) {
      musicRef.current.pause()
      setMusicPlaying(false)
    } else {
      musicRef.current.play().catch(() => {})
      setMusicPlaying(true)
    }
  }

  const triggerNuke = useCallback(() => {
    if (nukeActive) return
    setNukeActive(true)
  }, [nukeActive])

  const CRATER_STORAGE_KEY = 'lazerclaw_crater_pool'
  const CRATER_SEEN_KEY = 'lazerclaw_crater_seen'

  function getCraterPool() {
    try { return JSON.parse(localStorage.getItem(CRATER_STORAGE_KEY) || '[]') } catch { return [] }
  }
  function getSeenCraters() {
    try { return JSON.parse(localStorage.getItem(CRATER_SEEN_KEY) || '[]') } catch { return [] }
  }
  function saveCraterToPool(url) {
    const pool = getCraterPool()
    if (!pool.includes(url)) {
      pool.push(url)
      localStorage.setItem(CRATER_STORAGE_KEY, JSON.stringify(pool))
    }
  }
  function markCraterSeen(url) {
    const seen = getSeenCraters()
    if (!seen.includes(url)) {
      seen.push(url)
      localStorage.setItem(CRATER_SEEN_KEY, JSON.stringify(seen))
    }
  }
  function pickCraterFromPool() {
    const pool = getCraterPool()
    if (pool.length === 0) return null
    const seen = getSeenCraters()
    const unseen = pool.filter(u => !seen.includes(u))
    const candidates = unseen.length > 0 ? unseen : pool
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  async function generateCraterInBackground() {
    try {
      const { generateImage } = await import('../utils/aiImageApi')
      const data = await generateImage({
        prompt: 'Aerial top-down view of a massive nuclear bomb crater in scorched earth, glowing embers and charred ground radiating outward from the impact center, smoke wisps rising, devastation, photorealistic',
        aspectRatio: canvasState.canvasW > canvasState.canvasH ? '16:9' : canvasState.canvasW < canvasState.canvasH ? '9:16' : '1:1',
        addMetal: false,
      })
      const url = data.urls?.[0]
      if (url) saveCraterToPool(url)
      return url
    } catch (err) {
      console.error('Crater generation failed:', err)
      return null
    }
  }

  async function placeCraterOnCanvas(url) {
    const canvas = canvasRef.current
    if (!url || !canvas) return
    const { FabricImage } = await import('fabric')
    const { v4: uuidv4 } = await import('uuid')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
      const scale = Math.max(canvasState.canvasW / fImg.width, canvasState.canvasH / fImg.height)
      fImg.set({
        scaleX: scale, scaleY: scale,
        left: (canvasState.canvasW - fImg.width * scale) / 2,
        top: (canvasState.canvasH - fImg.height * scale) / 2,
      })
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      canvas.renderAll()
      refreshObjects()
    }
    img.onerror = () => console.error('Crater image failed to load')
    img.src = url
  }

  const onFlashPeak = useCallback(async () => {
    const canvas = canvasRef.current
    if (canvas) {
      saveUndoState()
      canvas.discardActiveObject()
      canvas.getObjects().slice().forEach(o => canvas.remove(o))
      canvas.renderAll()
      refreshObjects()
    }

    // Pick an existing crater to show immediately (prefer unseen)
    const poolPick = pickCraterFromPool()
    if (poolPick) {
      markCraterSeen(poolPick)
      placeCraterOnCanvas(poolPick)
    }

    // Always generate a new one in the background
    const newUrl = await generateCraterInBackground()
    // If we had no pool pick, place the freshly generated one
    if (!poolPick && newUrl) {
      markCraterSeen(newUrl)
      placeCraterOnCanvas(newUrl)
    }
  }, [canvasRef, saveUndoState, refreshObjects, canvasState])

  const onNukeComplete = useCallback(() => {
    setNukeActive(false)
  }, [])

  // Dynamically increase collapse level until toolbar content fits without overflow
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    let raf
    const check = () => {
      raf = requestAnimationFrame(() => {
        const w = el.offsetWidth
        if (w >= 1520) setCollapse(0)
        else if (w >= 1280) setCollapse(1)
        else if (w >= 1050) setCollapse(2)
        else if (w >= 800) setCollapse(3)
        else setCollapse(4)
      })
    }
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  // Track logo dimensions for lightning overlay
  useEffect(() => {
    const img = logoImgRef.current
    if (!img) return
    const measure = () => {
      if (img.offsetWidth && img.offsetHeight) setLogoDims({ w: img.offsetWidth, h: img.offsetHeight })
    }
    measure()
    img.addEventListener('load', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(img)
    return () => { img.removeEventListener('load', measure); ro.disconnect() }
  }, [])

  // Periodic shimmer sweep across toolbar logo
  useEffect(() => {
    if (!darkMode) return
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
      const el = logoShimmerRef.current
      const el2 = logoShimmer2Ref.current
      if (el) {
        sweepEl(el, 40 + Math.random() * 40, 0.5 + Math.random() * 0.24)
        if (el2 && Math.random() < 0.35) {
          setTimeout(() => sweepEl(el2, 20 + Math.random() * 30, 0.4 + Math.random() * 0.2), 80 + Math.random() * 160)
        }
      }
      timer = setTimeout(triggerShimmer, 5000 + Math.random() * 10000)
    }
    timer = setTimeout(triggerShimmer, 800 + Math.random() * 1200)
    return () => clearTimeout(timer)
  }, [darkMode])

  const handleAddText = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    saveUndoState()
    const id = uuidv4()
    const text = new Textbox('Type here', {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 24,
      fontFamily: 'Inter',
      fill: '#000000',
      _dtoolId: id,
      _dtoolTokens: null,
    })
    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.renderAll()
    refreshObjects()
  }

  const hasSelection = !!selectedObject
  const isMultiSelection = hasSelection && selectedObject._objects && selectedObject._objects.length > 1 && selectedObject.type !== 'group'
  const isGroup = hasSelection && selectedObject.type === 'group'

  const VECTOR_TYPES = new Set(['rect', 'circle', 'ellipse', 'triangle', 'polygon', 'path'])
  const canMask = isMultiSelection && selectedObject instanceof ActiveSelection && (() => {
    const members = selectedObject._objects.filter(o => !o._dtoolTileClone)
    if (members.length < 2) return false
    const hasVector = members.some(o => VECTOR_TYPES.has((o.type || '').toLowerCase()))
    const hasNonVector = members.some(o => !VECTOR_TYPES.has((o.type || '').toLowerCase()))
    return hasVector && hasNonVector
  })()

  const dm = !!darkMode
  const Div = () => <div className={`h-8 w-px shrink-0 ${dm ? 'bg-gray-600' : 'bg-gray-300'}`} />

  const ic = {
    copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    paste: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 2v3h8V2"/><path d="M8 12h8M8 16h4"/></svg>,
    dup: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="14" height="14" rx="2"/><rect x="2" y="2" width="14" height="14" rx="2"/></svg>,
    fwd: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="10" height="10" rx="1"/><rect x="11" y="11" width="10" height="10" rx="1"/></svg>,
    bwd: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="11" y="11" width="10" height="10" rx="1"/><rect x="3" y="3" width="10" height="10" rx="1"/></svg>,
    grp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M6 14v-2h2M18 10v2h-2"/></svg>,
    ungrp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M14 6h4M10 18H6"/></svg>,
    mask: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="7" /><rect x="5" y="8" width="14" height="12" rx="2" strokeDasharray="3 2" /></svg>,
    select: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" /></svg>,
    text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M8 20h8"/></svg>,
    del: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6"/></svg>,
    tmpl: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 9v12"/></svg>,
    play: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21" /></svg>,
    pause: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>,
    edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    arrange: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    canvas: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
    more: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>,
  }

  const _v = historyVersion
  const canvas = canvasRef.current
  return (
    <div ref={toolbarRef} className={`relative z-50 h-[66px] border-b flex items-center px-2 pr-2 shrink-0 min-w-0 ${dm ? 'galaxy-header' : ''} ${collapse >= 1 ? 'tb-compact' : ''}`}
      style={{
        background: dm
          ? 'linear-gradient(180deg, #1f2937 0%, #111827 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        borderColor: dm ? 'rgba(100,160,255,0.2)' : '#e2e8f0',
      }}
    >
      {dm && (
        <>
          <div className="galaxy-star" style={{ top: '12%', left: '15%', animationDelay: '0s' }} />
          <div className="galaxy-star" style={{ top: '70%', left: '25%', animationDelay: '0.5s' }} />
          <div className="galaxy-star" style={{ top: '30%', left: '45%', animationDelay: '1s' }} />
          <div className="galaxy-star" style={{ top: '60%', left: '55%', animationDelay: '1.5s' }} />
          <div className="galaxy-star" style={{ top: '20%', left: '70%', animationDelay: '0.8s' }} />
          <div className="galaxy-star" style={{ top: '75%', left: '85%', animationDelay: '1.2s' }} />
        </>
      )}

      {/* Left/center group — shrinkable, clips horizontal overflow but allows dropdowns to extend vertically */}
      <div className="flex items-center gap-1" style={{ flex: '1 1 0%', minWidth: 0, overflowX: 'clip', overflowY: 'visible' }}>

      {/* Logo with lightning + shimmer — always visible */}
      <div className="flex items-center gap-1.5 px-1 shrink-0 relative">
        <div className="relative" style={{ height: collapse >= 3 ? 44 : collapse >= 1 ? 51 : 53 }}>
          <img
            ref={logoImgRef}
            src="/lazerclaw_logo.png"
            alt="LazerClaw"
            className="transition-all duration-200 hover:scale-105"
            style={{ height: '100%', width: 'auto' }}
            draggable={false}
          />
          {darkMode && logoDims.w > 0 && (
            <LogoLightning width={logoDims.w} height={logoDims.h} darkMode={darkMode} />
          )}
          {darkMode && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{
                WebkitMaskImage: 'url(/lazerclaw_logo.png)',
                maskImage: 'url(/lazerclaw_logo.png)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            >
              <div
                ref={logoShimmerRef}
                className="absolute pointer-events-none"
                style={{
                  top: '-20%', left: '-120%', width: '60%', height: '140%',
                  background: 'linear-gradient(105deg, transparent 0%, transparent 25%, rgba(255,255,255,0.25) 35%, rgba(255,255,255,0.5) 42%, rgba(255,255,255,0.9) 48%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 52%, rgba(255,255,255,0.5) 58%, rgba(255,255,255,0.25) 65%, transparent 75%, transparent 100%)',
                  transform: 'skewX(-15deg)', opacity: 0, filter: 'blur(1px)',
                }}
              />
              <div
                ref={logoShimmer2Ref}
                className="absolute pointer-events-none"
                style={{
                  top: '-20%', left: '-120%', width: '35%', height: '140%',
                  background: 'linear-gradient(105deg, transparent 0%, transparent 25%, rgba(255,255,255,0.2) 35%, rgba(255,255,255,0.4) 42%, rgba(255,255,255,0.8) 48%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.8) 52%, rgba(255,255,255,0.4) 58%, rgba(255,255,255,0.2) 65%, transparent 75%, transparent 100%)',
                  transform: 'skewX(-15deg)', opacity: 0, filter: 'blur(1px)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Div />

      {/* Undo/Redo — always visible */}
      <ToolBtn dm={dm} onClick={undo} disabled={undoStackRef.current.length === 0} title="Undo (Ctrl+Z)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h13a4 4 0 010 8H7"/><path d="M3 10l4-4M3 10l4 4"/></svg>
        {collapse < 4 && <span>Undo</span>}
      </ToolBtn>
      <ToolBtn dm={dm} onClick={redo} disabled={redoStackRef.current.length === 0} title="Redo (Ctrl+Y)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H8a4 4 0 000 8h9"/><path d="M21 10l-4-4M21 10l-4 4"/></svg>
        {collapse < 4 && <span>Redo</span>}
      </ToolBtn>

      {/* ── Level 0: everything expanded ── */}
      {collapse === 0 && (
        <>
          <Div />
          <ToolBtn dm={dm} onClick={copySelected} disabled={!hasSelection} title="Copy (Ctrl+C)">{ic.copy}<span>Copy</span></ToolBtn>
          <ToolBtn dm={dm} onClick={pasteFromClipboard} title="Paste (Ctrl+V)">{ic.paste}<span>Paste</span></ToolBtn>
          <ToolBtn dm={dm} onClick={duplicateSelected} disabled={!hasSelection} title="Duplicate (Ctrl+D)">{ic.dup}<span>Duplicate</span></ToolBtn>
          <Div />
          <ToolDropdown label="Arrange" icon={ic.arrange} dm={dm} bloodRain={bloodRain}>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>
          <AlignPanel canvasState={canvasState} bloodRain={bloodRain} />
          <TilePanel canvasState={canvasState} bloodRain={bloodRain} />
          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />
          <Div />
          <ToolBtn dm={dm} onClick={handleAddText} title="Add Text Box">{ic.text}<span>Text</span></ToolBtn>
          <Div />
          <CanvasSizePicker canvasState={canvasState} bloodRain={bloodRain} />
          <PrinterMarksPanel canvasState={canvasState} bloodRain={bloodRain} />
        </>
      )}

      {/* ── Level 1: Copy/Paste/Dup → dropdown, Marks merged into Canvas area ── */}
      {collapse === 1 && (
        <>
          <Div />
          <ToolDropdown label="Edit" icon={ic.edit} dm={dm} bloodRain={bloodRain}>
            <DropItem icon={ic.copy} label="Copy" onClick={copySelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.paste} label="Paste" onClick={pasteFromClipboard} dm={dm} />
            <DropItem icon={ic.dup} label="Duplicate" onClick={duplicateSelected} disabled={!hasSelection} dm={dm} />
          </ToolDropdown>
          <ToolDropdown label="Arrange" icon={ic.arrange} dm={dm} bloodRain={bloodRain}>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>
          <AlignPanel canvasState={canvasState} bloodRain={bloodRain} />
          <TilePanel canvasState={canvasState} bloodRain={bloodRain} />
          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />
          <Div />
          <ToolBtn dm={dm} onClick={handleAddText} title="Add Text Box">{ic.text}<span>Text</span></ToolBtn>
          <Div />
          <CanvasSizePicker canvasState={canvasState} bloodRain={bloodRain} />
        </>
      )}

      {/* ── Level 2: grouped dropdowns, icon-only buttons ── */}
      {collapse === 2 && (
        <>
          <Div />
          <ToolDropdown label="Edit" icon={ic.edit} dm={dm} bloodRain={bloodRain}>
            <DropItem icon={ic.copy} label="Copy" onClick={copySelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.paste} label="Paste" onClick={pasteFromClipboard} dm={dm} />
            <DropItem icon={ic.dup} label="Duplicate" onClick={duplicateSelected} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.text} label="Add Text" onClick={handleAddText} dm={dm} />
            <DropItem icon={ic.del} label="Delete" onClick={deleteSelected} disabled={!hasSelection} dm={dm} />
          </ToolDropdown>

          <ToolDropdown label="Arrange" icon={ic.arrange} dm={dm} bloodRain={bloodRain}>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>

          <AlignPanel canvasState={canvasState} bloodRain={bloodRain} />
          <TilePanel canvasState={canvasState} bloodRain={bloodRain} />

          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />

          <Div />
          <CanvasSizePicker canvasState={canvasState} bloodRain={bloodRain} />
        </>
      )}

      {/* ── Level 3: single "More" dropdown ── */}
      {collapse === 3 && (
        <>
          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />

          <Div />
          <ToolDropdown label="More" icon={ic.more} dm={dm} bloodRain={bloodRain}>
            <DropLabel dm={dm}>Edit</DropLabel>
            <DropItem icon={ic.copy} label="Copy" onClick={copySelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.paste} label="Paste" onClick={pasteFromClipboard} dm={dm} />
            <DropItem icon={ic.dup} label="Duplicate" onClick={duplicateSelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.text} label="Add Text" onClick={handleAddText} dm={dm} />
            <DropItem icon={ic.del} label="Delete" onClick={deleteSelected} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropLabel dm={dm}>Arrange</DropLabel>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>
          <CanvasSizePicker canvasState={canvasState} bloodRain={bloodRain} />
        </>
      )}

      {/* ── Level 4: ultra-compact — everything in one "Tools" dropdown ── */}
      {collapse >= 4 && (
        <>
          <Div />
          <ToolDropdown label="Tools" icon={ic.more} dm={dm} iconOnly bloodRain={bloodRain}>
            <DropLabel dm={dm}>Tools</DropLabel>
            <DropItem icon={ic.select} label="Select" onClick={() => setActiveTool('select')} dm={dm} />
            <DropItem icon={ic.text} label="Add Text" onClick={handleAddText} dm={dm} />
            <DropSep dm={dm} />
            <DropLabel dm={dm}>Edit</DropLabel>
            <DropItem icon={ic.copy} label="Copy" onClick={copySelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.paste} label="Paste" onClick={pasteFromClipboard} dm={dm} />
            <DropItem icon={ic.dup} label="Duplicate" onClick={duplicateSelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.del} label="Delete" onClick={deleteSelected} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropLabel dm={dm}>Arrange</DropLabel>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>
        </>
      )}

      {/* AI Image Generate */}
      {collapse < 4 && <Div />}
      <AiToolsDropdown canvasState={canvasState} dm={dm} bloodRain={bloodRain} />

      {/* Music / Theme Song button */}
      <button
        onClick={toggleMusic}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${dm ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        title={musicPlaying ? 'Pause Theme Song' : 'Play Theme Song'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={musicPlaying ? '#f59e0b' : (dm ? '#ffffff' : '#374151')}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </button>

      {/* Blood Rain toggle */}
      <button
        onClick={() => setBloodRain(v => !v)}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 relative overflow-hidden ${dm ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        title={bloodRain ? 'Stop Blood Rain' : 'Blood Rain'}
      >
        <svg width={collapse >= 4 ? 16 : 20} height={collapse >= 4 ? 16 : 20} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C12 2 6 10 6 15a6 6 0 0012 0c0-5-6-13-6-13z" fill={bloodRain ? '#dc2626' : (dm ? 'rgba(220,60,60,0.7)' : 'rgba(180,30,30,0.55)')} />
          <ellipse cx="10" cy="16" rx="1.5" ry="2" fill="rgba(255,255,255,0.25)" />
        </svg>
        {bloodRain && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(100deg, transparent 20%, rgba(220,40,40,0.3) 45%, rgba(180,0,0,0.4) 50%, rgba(220,40,40,0.3) 55%, transparent 80%)',
            animation: 'fireShimmer 1.8s ease-in-out infinite',
          }} />
        )}
      </button>

      {bloodRain && <BloodRainOverlay />}

      {/* Laser & Smoke Machine */}
      <button
        onClick={() => setLaserSmoke(v => !v)}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${dm ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        title={laserSmoke ? 'Stop Laser Show' : 'Laser & Smoke Machine'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={laserSmoke ? '#00ffcc' : (dm ? '#ffffff' : '#374151')} strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="2" x2="4" y2="18" />
          <line x1="12" y1="2" x2="20" y2="18" />
          <line x1="12" y1="2" x2="12" y2="20" />
          <ellipse cx="12" cy="20" rx="10" ry="3" fill={laserSmoke ? 'rgba(0,255,200,0.15)' : 'none'} stroke={laserSmoke ? '#00ffcc' : (dm ? '#ffffff' : '#374151')} strokeWidth="1.5" />
        </svg>
      </button>
      <LaserSmokeMachine active={laserSmoke} />

      {/* Nuclear Explosion */}
      <button
        onClick={triggerNuke}
        disabled={nukeActive}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${nukeActive ? 'animate-pulse' : ''} ${dm ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
        title="Nuclear Explosion"
      >
        <svg width="20" height="20" viewBox="0 0 225 225" fill={nukeActive ? '#f59e0b' : (dm ? '#ffffff' : '#374151')}>
          <path d="M121,0c1,.6,2.9.6,5,.9,51.7,6.2,92.4,47.3,98.1,99s.4,3.4.9,4.1v17c-.6,1-.6,2.9-.9,5-6.2,51.3-46.7,91.8-98.1,98.1-2.1.3-4.1.3-5,.9h-17c-1-.6-3-.6-5-.9C47.6,217.8,7.1,177.5.9,126c-.3-2.1-.3-4.1-.9-5v-17C5.3,48,48,5.4,104,0h17ZM216.4,112.5c0-57.4-46.5-103.9-103.9-103.9S8.6,55.1,8.6,112.5s46.5,103.9,103.9,103.9,103.9-46.5,103.9-103.9Z"/>
          <path d="M139.1,108.2c-1.5-7-5-13.1-10.5-17.6s-1.9-3.4-.9-5.1l28.4-49.1c1.2-2,3.8-2.6,5.7-1.4,24.8,16.6,40.2,43.4,41.8,72.6s-1.8,4.2-4.1,4.2l-56.6-.5c-1.9,0-3.5-1.3-3.9-3.1Z"/>
          <path d="M154.8,193.8c-26.6,13-56.9,13.3-83.7,0-2.1-1-2.9-3.6-1.7-5.7l28.7-49c1-1.7,3.1-2.4,5-1.7,6.5,2.6,13.3,2.3,20.1-.2,1.8-.7,3.9,0,4.9,1.8l28.4,49.2c1.2,2,.4,4.6-1.7,5.6Z"/>
          <path d="M82.5,112.2H25.6c-2.3,0-4.2-1.9-4-4.2,1.8-29.4,16.9-56,41.9-72.5s4.6-.6,5.7,1.4l28.1,49.5c1,1.7.5,4-1.1,5.2-5.4,4.2-8.5,9.9-9.8,17.4s-2,3.3-4,3.3Z"/>
          <circle cx="112.6" cy="113.6" r="17.6"/>
        </svg>
      </button>

      {nukeActive && <NukeExplosion onComplete={onNukeComplete} onFlashPeak={onFlashPeak} />}

      {/* Dark/Light mode toggle */}
      <button
        onClick={onToggleDarkMode}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${dm ? 'text-yellow-300 hover:bg-white/10' : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'}`}
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      </div>{/* end left/center group */}

      {/* Right group — always visible, never clips off screen */}
      <div className="flex items-center gap-1 shrink-0 ml-1 min-w-0">

      {/* Right side — Download with chrome effect + shimmer */}
      <DownloadButton canvasState={canvasState} collapse={collapse} />

      {/* Logout button - outlined secondary CTA with chrome effect */}
      <button
        onClick={() => { setLogoutText(pickRandom(LOGOUT_TEXTS)); setShowLogoutConfirm(true) }}
        className={`${collapse >= 4 ? 'px-2 w-9' : collapse >= 1 ? 'px-2.5' : 'px-5'} py-2 rounded-lg text-sm font-bold transition-all shrink-0 flex items-center justify-center gap-2 ${collapse >= 1 ? 'ml-1' : 'ml-3'} relative overflow-hidden hover:scale-105`}
        style={{
          background: dm
            ? 'linear-gradient(180deg, rgba(60,65,80,0.95) 0%, rgba(40,45,60,0.98) 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          border: dm ? '1px solid rgba(100,160,255,0.4)' : '1px solid #cbd5e1',
          color: dm ? 'rgba(255,255,255,0.9)' : '#475569',
          boxShadow: dm
            ? '0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(100,160,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
        title="Logout"
      >
        {/* Chrome shimmer overlay */}
        <div className="logout-shimmer" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', zIndex: 1 }}>
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {collapse < 4 && <span className="logout-label" style={{ position: 'relative', zIndex: 1 }}>Logout</span>}
      </button>

      </div>{/* end right group */}

      {/* Logout shimmer styles */}
      <style>{`
        .logout-shimmer {
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            105deg,
            transparent 0%,
            transparent 30%,
            rgba(255,255,255,0.1) 40%,
            rgba(255,255,255,0.3) 48%,
            rgba(255,255,255,0.5) 50%,
            rgba(255,255,255,0.3) 52%,
            rgba(255,255,255,0.1) 60%,
            transparent 70%,
            transparent 100%
          );
          animation: logoutShimmerSweep 9s ease-in-out infinite;
          filter: blur(1px);
          pointer-events: none;
        }
        @keyframes logoutShimmerSweep {
          0% { left: -100%; opacity: 0; }
          80% { left: -100%; opacity: 0; }
          83% { opacity: 1; }
          93% { left: 200%; opacity: 1; }
          95% { left: 200%; opacity: 0; }
          100% { left: 200%; opacity: 0; }
        }
      `}</style>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogoutConfirm(false) }}
        >
          <div
            className="rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
            style={{
              background: dm
                ? 'linear-gradient(180deg, #1e1e2f 0%, #16162a 100%)'
                : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              border: dm
                ? '1px solid rgba(100,160,255,0.3)'
                : '1px solid #e2e8f0',
              animation: 'logoutModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{
                borderBottom: dm ? '1px solid rgba(100,160,255,0.15)' : '1px solid #e2e8f0',
                background: dm ? 'rgba(100,160,255,0.05)' : 'rgba(59,130,246,0.04)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dm ? '#fbbf24' : '#f59e0b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-sm font-bold" style={{ color: dm ? '#e2e8f0' : '#1e293b' }}>
                {logoutText.title}
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-relaxed" style={{ color: dm ? '#94a3b8' : '#475569' }}>
                {logoutText.body}
              </p>
              <p className="text-xs mt-3 font-medium" style={{ color: dm ? '#f59e0b' : '#d97706' }}>
                {logoutText.warning}
              </p>
            </div>
            <div
              className="px-5 py-3 flex justify-end gap-2"
              style={{
                borderTop: dm ? '1px solid rgba(100,160,255,0.15)' : '1px solid #e2e8f0',
                background: dm ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:scale-105"
                style={{
                  background: dm ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                  color: dm ? '#94a3b8' : '#64748b',
                  border: dm ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                }}
              >
                {logoutText.cancel}
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('dtool-theme')
                  localStorage.removeItem('dtool-dark-mode')
                  window.location.reload()
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:scale-105"
                style={{
                  background: dm
                    ? 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)'
                    : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: '1px solid rgba(0,0,0,0.2)',
                  boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
                }}
              >
                {logoutText.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes logoutModalIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
