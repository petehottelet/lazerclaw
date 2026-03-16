import React, { useState, useRef, useEffect, useCallback } from 'react'
import { buildAgentSystemPrompt, serializeCanvasForAgent } from '../utils/agentPrompt'
import { executeActions } from '../utils/agentExecutor'

// ─── REALISTIC LIGHTNING BOLT GENERATION FOR DIAMOND PERIMETER ─────────────
function generatePerimeterBolt(x1, y1, x2, y2, detail = 4) {
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

// 3-pass bolt rendering matching lightning_overlay_fix.html exactly
function strokePerimeterBolt(ctx, pts, intensity = 1.0, scale = 1.0) {
  // Pass 1 – outer glow
  ctx.shadowColor = `rgba(100,160,255,${intensity * 0.8})`
  ctx.shadowBlur = 40 * scale
  ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.18})`
  ctx.lineWidth = 14 * scale
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 2 – mid core
  ctx.shadowColor = `rgba(130,190,255,${intensity * 0.9})`
  ctx.shadowBlur = 20 * scale
  ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.45})`
  ctx.lineWidth = 5 * scale
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  // Pass 3 – bright core
  ctx.shadowColor = `rgba(200,225,255,${intensity})`
  ctx.shadowBlur = 6 * scale
  ctx.strokeStyle = `rgba(230,240,255,${intensity * 0.95})`
  ctx.lineWidth = 1.5 * scale
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

// Draw branches off the main bolt (matching reference)
function strokeBranch(ctx, pts, intensity = 1.0, scale = 1.0) {
  ctx.shadowColor = `rgba(100,150,255,${intensity * 0.5})`
  ctx.shadowBlur = 14 * scale
  ctx.strokeStyle = `rgba(90,140,240,${intensity * 0.3})`
  ctx.lineWidth = 4 * scale
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.strokeStyle = `rgba(200,220,255,${intensity * 0.6})`
  ctx.lineWidth = 0.7 * scale
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()

  ctx.shadowBlur = 0
}

// Diamond perimeter lightning canvas overlay
function OrbLightning({ size, wild }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    const center = size / 2
    // Diamond corners (rotated square) - slightly outside the gem
    const gemRadius = size * 0.32
    const outerRadius = size * 0.48

    function draw() {
      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      const numBolts = wild ? 1 + Math.floor(Math.random() * 2) : (Math.random() < 0.3 ? 1 : 0)

      for (let i = 0; i < numBolts; i++) {
        const angle = Math.random() * Math.PI * 2
        const startR = gemRadius + Math.random() * 2
        const endR = outerRadius + (wild ? 4 : 2) + Math.random() * (wild ? 5 : 3)

        const startX = center + Math.cos(angle) * startR
        const startY = center + Math.sin(angle) * startR
        const endX = center + Math.cos(angle + (Math.random() - 0.5) * 0.3) * endR
        const endY = center + Math.sin(angle + (Math.random() - 0.5) * 0.3) * endR

        const bolt = generatePerimeterBolt(startX, startY, endX, endY, wild ? 4 : 3)
        const intensity = wild ? 0.15 + Math.random() * 0.1 : 0.07 + Math.random() * 0.05
        const boltScale = wild ? 0.08 : 0.05
        strokePerimeterBolt(ctx, bolt, intensity, boltScale)
      }

      if (wild && Math.random() < 0.3) {
        const angle1 = Math.random() * Math.PI * 2
        const angle2 = angle1 + (Math.random() - 0.5) * Math.PI * 0.8
        const r = outerRadius + 2 + Math.random() * 5
        const bolt = generatePerimeterBolt(
          center + Math.cos(angle1) * r,
          center + Math.sin(angle1) * r,
          center + Math.cos(angle2) * r,
          center + Math.sin(angle2) * r,
          3
        )
        strokePerimeterBolt(ctx, bolt, 0.08 + Math.random() * 0.05, 0.05)
      }

      ctx.restore()
      rafId = requestAnimationFrame(draw)
    }

    canvas.width = size
    canvas.height = size
    rafId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(rafId)
  }, [size, wild])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}

// ─── GEM PERIMETER LIGHTNING (traces visible pixel edges) ──────────────────
function GemPerimeterLightning({ size }) {
  const canvasRef = useRef(null)
  const edgePointsRef = useRef([])
  const loadedRef = useRef(false)

  // Load gem image and extract edge points
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      try {
        const tempCanvas = document.createElement('canvas')
        const scale = 2
        tempCanvas.width = size * scale
        tempCanvas.height = size * scale
        const tempCtx = tempCanvas.getContext('2d')
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height)

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
        const data = imageData.data
        const w = tempCanvas.width
        const h = tempCanvas.height

        const edges = []
        const alphaThreshold = 30

        for (let y = 1; y < h - 1; y += 3) {
          for (let x = 1; x < w - 1; x += 3) {
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
                edges.push({ x: x / scale, y: y / scale })
              }
            }
          }
        }

        edgePointsRef.current = edges
        loadedRef.current = true
      } catch (e) {
        console.warn('Gem edge detection failed:', e)
      }
    }
    img.onerror = () => console.warn('Failed to load gem image for edge detection')
    img.src = '/claw_gem.png'
  }, [size])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId
    let perimeterBolts = []
    let lastBoltTime = 0

    canvas.width = size
    canvas.height = size

    function draw() {
      const now = Date.now()
      ctx.clearRect(0, 0, size, size)

      if (!loadedRef.current || edgePointsRef.current.length < 20) {
        rafId = requestAnimationFrame(draw)
        return
      }

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      const edges = edgePointsRef.current

      if (now - lastBoltTime > 500 && perimeterBolts.length < 1 && Math.random() < 0.4) {
        const startIdx = Math.floor(Math.random() * edges.length)
        const segLen = 6 + Math.floor(Math.random() * 10)
        const direction = Math.random() > 0.5 ? 1 : -1

        perimeterBolts.push({
          startIdx,
          segLen,
          direction,
          life: 0.15,
          decay: 0.008 + Math.random() * 0.006
        })
        lastBoltTime = now
      }

      perimeterBolts = perimeterBolts.filter(bolt => {
        bolt.life -= bolt.decay
        if (bolt.life <= 0) return false

        const alpha = bolt.life

        ctx.shadowColor = `rgba(100,180,255,${alpha * 0.3})`
        ctx.shadowBlur = 4
        ctx.strokeStyle = `rgba(80,140,255,${alpha * 0.1})`
        ctx.lineWidth = 1.5
        ctx.beginPath()

        let first = true
        for (let i = 0; i < bolt.segLen; i++) {
          let idx = bolt.startIdx + i * bolt.direction
          while (idx < 0) idx += edges.length
          idx = idx % edges.length

          const pt = edges[idx]
          const jitterX = (Math.random() - 0.5) * 3
          const jitterY = (Math.random() - 0.5) * 3

          if (first) {
            ctx.moveTo(pt.x + jitterX, pt.y + jitterY)
            first = false
          } else {
            ctx.lineTo(pt.x + jitterX, pt.y + jitterY)
          }
        }
        ctx.stroke()

        ctx.shadowBlur = 2
        ctx.strokeStyle = `rgba(150,200,255,${alpha * 0.15})`
        ctx.lineWidth = 0.8
        ctx.stroke()

        ctx.shadowBlur = 1
        ctx.strokeStyle = `rgba(220,240,255,${alpha * 0.2})`
        ctx.lineWidth = 0.4
        ctx.stroke()

        return true
      })

      ctx.restore()
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  )
}

// ─── BLOOD RAIN EFFECT (Slayer Easter Egg) ─────────────────────────────────
function BloodRain({ active }) {
  const canvasRef = useRef(null)
  const dropsRef = useRef([])

  useEffect(() => {
    if (!active) {
      dropsRef.current = []
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    // Initialize blood drops
    function initDrops() {
      dropsRef.current = []
      for (let i = 0; i < 200; i++) {
        dropsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height,
          speed: 8 + Math.random() * 12,
          length: 20 + Math.random() * 40,
          width: 1 + Math.random() * 2,
          opacity: 0.4 + Math.random() * 0.6,
        })
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Blood-red sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
      skyGrad.addColorStop(0, 'rgba(80, 0, 0, 0.3)')
      skyGrad.addColorStop(0.5, 'rgba(120, 20, 20, 0.2)')
      skyGrad.addColorStop(1, 'rgba(60, 0, 0, 0.1)')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw blood drops
      dropsRef.current.forEach(drop => {
        const grad = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y + drop.length)
        grad.addColorStop(0, `rgba(180, 0, 0, ${drop.opacity})`)
        grad.addColorStop(0.5, `rgba(140, 0, 0, ${drop.opacity * 0.8})`)
        grad.addColorStop(1, `rgba(100, 0, 0, ${drop.opacity * 0.4})`)

        ctx.beginPath()
        ctx.strokeStyle = grad
        ctx.lineWidth = drop.width
        ctx.lineCap = 'round'
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(drop.x + 2, drop.y + drop.length)
        ctx.stroke()

        // Update position
        drop.y += drop.speed
        if (drop.y > canvas.height) {
          drop.y = -drop.length
          drop.x = Math.random() * canvas.width
        }
      })

      rafId = requestAnimationFrame(draw)
    }

    resize()
    initDrops()
    window.addEventListener('resize', resize)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  )
}

function SparkleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="currentColor" />
      <path d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z" fill="currentColor" />
      <path d="M5 2L5.5 3.5L7 4L5.5 4.5L5 6L4.5 4.5L3 4L4.5 3.5L5 2Z" fill="currentColor" />
    </svg>
  )
}

function MoonStarIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.14 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.69 1 1 0 0 0-.36-1.05Z" />
      <path d="M17 4L17.5 5.5L19 6L17.5 6.5L17 8L16.5 6.5L15 6L16.5 5.5L17 4Z" />
      <path d="M21 8L21.37 9.13L22.5 9.5L21.37 9.87L21 11L20.63 9.87L19.5 9.5L20.63 9.13L21 8Z" />
    </svg>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: ['#2dd4bf', '#0ea5e9', '#1e3a8a'][i],
              animation: `agentBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">Dr. Claw is thinking...</span>
    </div>
  )
}

// Claw SVG path for profile picture
const CLAW_PATH = "M431.4,0h1c4.6,14.1,5.9,23.2,11.2,38.8,8,23.6,37.8,20.6,57.9,30.1l-37.2,10.2c-10.3,2.8-18,10.2-21.2,20.5-3.3,10.3-5.5,20.6-7.8,31.3s-1.1,5.5-3.9,7.8l-9.4-36.1c-3.2-12.3-10.8-20.7-23.5-23.9l-31.3-7.9c-.8-.2-2.6-2-2.2-2.4s1.8-1.2,2.5-1.4c11.9-3,23.6-6.1,35.1-9.9s14.8-8.1,17.3-16.9L431.4,0ZM111.4,920.6c1.2,6.8,5.5,12.4,11.2,16.8,12.1,9.4,27.1,29.2,18,44.3s-7.8,28,.7,39.8,16.5,14.2,27.2,16.7c4.7,1.1,8.4,3.2,11.2,7,17.6,23.9,39.9,42.4,66.4,55.5,23.4,11.6,47.6,18.7,73.8,20,11,.5,22.1,1.1,33-.1,42.7-4.8,60-15.4,96.7-34.5s8.2-5.2,11.7-4.9c9.7.7,18,3.1,27.4,1.4,22.8-4.2,37.5-25.2,35.4-48.4-.7-7.7-.1-14.6,4.1-21.3,7-11,14.2-22.7,25.3-30.4s32.5-8.4,40.8-27.4c7.9-18-7.8-27.8,3.5-48.7l9.4-17.4c4.1-7.6,10.1-12.4,18.1-15.7,14.2-5.8,25.4-16.8,29.3-31.7,3-11.5,1.4-23.6-5.6-33-5.1-6.9-5.4-13.9-3.1-21.9,8.8-30.5,26.1-27.3,35-52.9,4.3-12.3,3.9-24.6-2-36.3-2.5-5-2.9-10.6-1.6-16.3l20.7-87.8c12.8-54.4,14.4-34.6,33.7-62.5s5.4-12.6,5.9-19.6c1.9-30.6-17.5-29.2-15.3-54.1l1.5-16.4c.7-8,4.5-15.2,9.4-21.5,12.8-16.6,13.8-38.4,1.2-55.2-7.4-9.9-10.7-14.5-11.4-25.9-1.8-26.9-5.6-52.7-11.9-78.8-4.1-17,7.1-22.2,6.7-39.8-.7-26.1-25.9-30.9-31-41.6l-18.2-38c-5.6-11.7-12.9-21.8-20.7-32.1-14.8-19.7-32.3-36-53-49.1-8.1-5.1-16.1-9.5-25.5-11.3s-16.6,2.6-20.1,10.4c-3.1,7-4.2,14.5-3.5,22.2.9,10.9,2.3,21.2,4,32,1.6,10.2,6.1,37.7.8,45.2-6.6,9.5-20.6,16.8-10.1,27.1s5.5,7.8,3.2,11.3c-4.5,6.7-16.6,9.2-17.7,20.5-1.4,14.1,14.2,17.5,11.9,26.6s-14.7,6.5-16.4,16.1,1.5,7.8,4.8,10.9,5.5,9.8,1.1,13.4c-10.3,8.1-29.9,1.5-33.8,17.2s1.7,19.6,9,26.2,4.2,5.7,2.9,8.9c-2.7,6.9-11.9,5.2-15.5,11.1s-2.7,9-.5,12.1l8.4,12.2c3.5,5,.9,11.3-2.2,15.1-8.9,10.7-18.7-1.8-33,6.1-8,4.4-10.7,13.8-5.2,21.6l8.7,12.3c1.7,2.5,2.1,7.1.4,9.6-3.7,5.6-12.7,1-15.8,8.2-2.7,6.3,7.1,11.1,4.9,18.3s-12.5.9-21.9,1.9-10.6,6.6-9.4,13c1.8,9.5,8.4,16.3,4.8,20-2.3,2.5-12.9.5-16.6,4.6-6,6.7,6.9,16.8,2.9,21.2s-6.7,1.3-9.2,2.2c-3.9,1.3-4.9,7.4-3.5,11.2l4,11.3c-1.1,4.8-4.4,9.4-6.8,13.8-11.2,20.3-31.2,1.2-44.1,27.9s-8.4,15.1-13.2,22.8c-18.7,30.2-48.1,51.3-82.4,60.3-16.9,4.4-33.3,6.7-50.7,8.4-22.7,2.1-49.4,5.6-69,17.9-18.6,11.6-30.3,30.8-34.6,52.2-2,9.8-1.1,19-2.5,29s-22.2,16.5-20.6,42.5c.8,13.7,7.1,25,18.9,32.8,14.5,9.6,23.6,28.4,16.3,45.7s-7.7,12.1-6.3,20.1Z"

// Claw profile picture with irregular shimmering blue blob
function ClawPfp({ size = 36, className = '' }) {
  return (
    <div
      className={`claw-pfp-container ${className}`}
      style={{
        width: size,
        height: size,
        position: 'relative',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src="/dr_claw_pfp.png"
        alt="Dr. Claw"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'drop-shadow(0 0 3px rgba(189,0,255,0.4))',
        }}
      />
    </div>
  )
}

function MessageBubble({ message, darkMode }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="shrink-0 mr-1" style={{ marginTop: '-4px' }}>
          <ClawPfp size={28} />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isUser ? 'text-white rounded-br-md' : 'rounded-bl-md'
        }`}
        style={isUser
          ? { background: 'linear-gradient(135deg, #0ea5e9, #1e3a8a)' }
          : { background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.08)', color: darkMode ? '#e2e8f0' : '#1e293b' }
        }
      >
        {message.content}
        {message.actionSummary && (
          <div className={`mt-1.5 text-xs border-t pt-1.5`} style={isUser ? { color: '#bae6fd', borderColor: 'rgba(186,230,253,0.3)' } : { color: darkMode ? '#94a3b8' : '#64748b', borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(14,165,233,0.15)' }}>
            {message.actionSummary}
          </div>
        )}
      </div>
    </div>
  )
}

function LightningOverlay({ targetX, targetY, onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    const W = window.innerWidth
    const H = window.innerHeight
    cvs.width = W
    cvs.height = H

    function buildBolt(x0, y0, x1, y1, displacement, branches) {
      const segments = []
      const midX = (x0 + x1) / 2 + (Math.random() - 0.5) * displacement
      const midY = (y0 + y1) / 2 + (Math.random() - 0.5) * displacement * 0.3

      if (displacement < 4) {
        segments.push({ x0, y0, x1, y1 })
      } else {
        segments.push(...buildBolt(x0, y0, midX, midY, displacement / 2, branches))
        segments.push(...buildBolt(midX, midY, x1, y1, displacement / 2, branches))
        if (branches > 0 && Math.random() < 0.35) {
          const branchLen = Math.hypot(x1 - midX, y1 - midY) * (0.4 + Math.random() * 0.3)
          const angle = Math.atan2(y1 - y0, x1 - x0) + (Math.random() - 0.5) * 1.2
          const bx = midX + Math.cos(angle) * branchLen
          const by = midY + Math.sin(angle) * branchLen
          segments.push(...buildBolt(midX, midY, bx, by, displacement / 3, branches - 1))
        }
      }
      return segments
    }

    function drawBolt(segments, alpha, width, color) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur = width * 6
      ctx.beginPath()
      for (const s of segments) {
        ctx.moveTo(s.x0, s.y0)
        ctx.lineTo(s.x1, s.y1)
      }
      ctx.stroke()
      ctx.restore()
    }

    const startX = targetX + (Math.random() - 0.5) * 60
    const bolts = [
      buildBolt(startX, -10, targetX, targetY, 120, 3),
      buildBolt(startX + (Math.random() - 0.5) * 40, -10, targetX + (Math.random() - 0.5) * 20, targetY, 100, 2),
    ]

    let frame = 0
    const totalFrames = 22

    const flashEl = document.createElement('div')
    Object.assign(flashEl.style, {
      position: 'fixed', inset: '0', zIndex: '99998',
      background: 'rgba(180,230,255,0.35)', pointerEvents: 'none',
      transition: 'opacity 0.15s ease-out',
    })
    document.body.appendChild(flashEl)
    requestAnimationFrame(() => { flashEl.style.opacity = '0' })

    function animate() {
      frame++
      ctx.clearRect(0, 0, W, H)

      if (frame <= 4) {
        const a = 1
        for (const bolt of bolts) {
          drawBolt(bolt, a * 0.3, 8, '#67e8f9')
          drawBolt(bolt, a * 0.5, 4, '#a5f3fc')
          drawBolt(bolt, a, 2, '#ffffff')
        }
      } else if (frame <= 6) {
        ctx.clearRect(0, 0, W, H)
      } else if (frame <= 10) {
        const reBolts = [
          buildBolt(startX + (Math.random() - 0.5) * 30, -10, targetX, targetY, 100, 3),
          buildBolt(startX + (Math.random() - 0.5) * 50, -10, targetX + (Math.random() - 0.5) * 15, targetY, 80, 2),
        ]
        const a = 1 - (frame - 7) * 0.15
        for (const bolt of reBolts) {
          drawBolt(bolt, Math.max(0, a * 0.3), 6, '#2dd4bf')
          drawBolt(bolt, Math.max(0, a * 0.5), 3, '#a5f3fc')
          drawBolt(bolt, Math.max(0, a), 1.5, '#ffffff')
        }
        if (frame === 8) {
          const flash2 = document.createElement('div')
          Object.assign(flash2.style, {
            position: 'fixed', inset: '0', zIndex: '99998',
            background: 'rgba(200,240,255,0.25)', pointerEvents: 'none',
            transition: 'opacity 0.12s ease-out',
          })
          document.body.appendChild(flash2)
          requestAnimationFrame(() => { flash2.style.opacity = '0' })
          setTimeout(() => flash2.remove(), 200)
        }
      } else {
        const fadeAlpha = Math.max(0, 1 - (frame - 10) / 8)
        if (fadeAlpha > 0) {
          const fadeBolts = [
            buildBolt(startX, -10, targetX, targetY, 60, 1),
          ]
          for (const bolt of fadeBolts) {
            drawBolt(bolt, fadeAlpha * 0.2, 4, '#0ea5e9')
            drawBolt(bolt, fadeAlpha * 0.4, 2, '#67e8f9')
            drawBolt(bolt, fadeAlpha, 1, 'rgba(255,255,255,0.6)')
          }
        }
      }

      if (frame < totalFrames) {
        requestAnimationFrame(animate)
      } else {
        flashEl.remove()
        onDone()
      }
    }

    requestAnimationFrame(animate)

    return () => {
      flashEl.remove()
    }
  }, [targetX, targetY, onDone])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}

function HeaderEffect() {
  const vidRef = useRef(null)

  useEffect(() => {
    vidRef.current?.play().catch(() => {})
  }, [])

  return (
    <video
      ref={vidRef}
      src="/lightning_storm.mp4"
      autoPlay
      loop
      muted
      playsInline
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', pointerEvents: 'none', zIndex: 0,
        opacity: 0.7,
      }}
    />
  )
}

function GenieShower({ chatLeft, chatTop, chatWidth }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const W = window.innerWidth
    const H = window.innerHeight
    cvs.width = W
    cvs.height = H
    const ctx = cvs.getContext('2d')

    const colors = ['#5eead4','#7dd3fc','#99f6e4','#67e8f9','#a5f3fc','#bae6fd','#ffffff','#2dd4bf','#e0f2fe','#cffafe']
    const particles = []
    const edgeY = chatTop
    const edgeLeft = chatLeft
    const edgeRight = chatLeft + chatWidth

    for (let i = 0; i < 60; i++) {
      const x = edgeLeft + Math.random() * chatWidth
      const frac = (x - edgeLeft) / chatWidth
      const spreadFromCenter = Math.abs(frac - 0.5) * 2
      particles.push({
        x,
        y: edgeY + Math.random() * 6 - 3,
        vx: (Math.random() - 0.5) * 2.5 + (frac - 0.5) * 3,
        vy: 1.5 + Math.random() * 3 + spreadFromCenter * 1.5,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.8 + Math.random() * 0.2,
        decay: 0.012 + Math.random() * 0.015,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        gravity: 0.08 + Math.random() * 0.06,
        delay: Math.random() * 8,
      })
    }

    let frame = 0
    const totalFrames = 90

    function drawStar(cx, cy, size, rotation, alpha, color) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotation)
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = size * 2
      ctx.beginPath()
      const s = size / 2
      const pts = [
        [0, -s], [s*0.15, -s*0.25], [s*0.6, -s*0.6], [s*0.25, -s*0.15],
        [s, 0], [s*0.25, s*0.15], [s*0.6, s*0.6], [s*0.15, s*0.25],
        [0, s], [-s*0.15, s*0.25], [-s*0.6, s*0.6], [-s*0.25, s*0.15],
        [-s, 0], [-s*0.25, -s*0.15], [-s*0.6, -s*0.6], [-s*0.15, -s*0.25],
      ]
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    function animate() {
      frame++
      ctx.clearRect(0, 0, W, H)

      let alive = false
      for (const p of particles) {
        if (p.delay > 0) { p.delay--; if (frame < totalFrames) alive = true; continue }
        p.alpha -= p.decay
        if (p.alpha <= 0) continue
        alive = true
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.985
        p.rotation += p.rotSpeed
        drawStar(p.x, p.y, p.size, p.rotation, Math.max(0, p.alpha), p.color)
      }

      if (alive) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [chatLeft, chatTop, chatWidth])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        pointerEvents: 'none',
      }}
    />
  )
}

export default function AgentChat({ canvasState }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showLightning, setShowLightning] = useState(false)
  const [lightningTarget, setLightningTarget] = useState({ x: 0, y: 0 })
  const [pendingOpen, setPendingOpen] = useState(false)
  const [sparkBurst, setSparkBurst] = useState(false)
  const [wildLightning, setWildLightning] = useState(false)
  const [bloodRain, setBloodRain] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey dude! I'm Dr. Claw, the most metal crustacean design assistant in the seven seas. Tell me what you'd like to create and I'll bring it to life, man — with LIGHTNING SPEED! The Claw abides. 🦞⚡" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [iterativeState, setIterativeState] = useState(null)
  const [referenceImages, setReferenceImages] = useState([])
  const [orbPos, setOrbPos] = useState(null)
  const [orbReturning, setOrbReturning] = useState(false)
  const isDarkMode = !!canvasState.darkMode
  const orbDragRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const iterativeAbortRef = useRef(false)

  const ORB_SIZE = 120
  const DEFAULT_RIGHT = 20
  const DEFAULT_BOTTOM = 20
  const SNAP_RADIUS = 100

  const getDefaultOrbPos = useCallback(() => ({
    x: window.innerWidth - DEFAULT_RIGHT - ORB_SIZE,
    y: window.innerHeight - DEFAULT_BOTTOM - ORB_SIZE,
  }), [])

  const handleOrbMouseDown = useCallback((e) => {
    if (e.target.closest('.agent-fab-btn')) return
    e.preventDefault()
    const def = orbPos || getDefaultOrbPos()
    orbDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: def.x,
      origY: def.y,
      moved: false,
    }
    const onMove = (ev) => {
      if (!orbDragRef.current) return
      const dx = ev.clientX - orbDragRef.current.startX
      const dy = ev.clientY - orbDragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) orbDragRef.current.moved = true
      if (!orbDragRef.current.moved) return
      setOrbReturning(false)
      setOrbPos({
        x: Math.max(-ORB_SIZE / 2, Math.min(window.innerWidth - ORB_SIZE / 2, orbDragRef.current.origX + dx)),
        y: Math.max(-ORB_SIZE / 2, Math.min(window.innerHeight - ORB_SIZE / 2, orbDragRef.current.origY + dy)),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!orbDragRef.current?.moved) { orbDragRef.current = null; return }
      const def = getDefaultOrbPos()
      orbDragRef.current = null
      setOrbPos(prev => {
        if (!prev) return null
        const dist = Math.sqrt((prev.x - def.x) ** 2 + (prev.y - def.y) ** 2)
        if (dist < SNAP_RADIUS) {
          setOrbReturning(true)
          setTimeout(() => { setOrbPos(null); setOrbReturning(false) }, 350)
          return { x: def.x, y: def.y }
        }
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [orbPos, getDefaultOrbPos])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const takeSnapshot = useCallback(() => {
    const canvas = canvasState.canvasRef.current
    if (!canvas) return null
    try {
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 0.7, multiplier: 0.5 })
      return dataUrl.replace(/^data:image\/png;base64,/, '')
    } catch {
      return null
    }
  }, [canvasState])

  const isDesignRequest = useCallback((text) => {
    const t = text.toLowerCase().trim()
    const patterns = [
      /^(design|create|make|build|generate|craft|produce)\s+(me\s+)?(a|an|the)\s+/,
      /^(design|create|make|build|generate)\s+/,
      /^i\s+(want|need|would like)\s+(a|an|the)\s+.*\s*(design|invitation|card|poster|flyer|banner|layout)/,
      /\b(design|create|make|build)\b.*\b(invitation|card|poster|flyer|banner|layout|template|certificate|menu|resume|announcement|brochure)\b/,
    ]
    return patterns.some(p => p.test(t))
  }, [])

  const callAgent = useCallback(async (systemPrompt, conversationMessages, snapshot, refImages) => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        messages: conversationMessages,
        snapshot: snapshot || undefined,
        referenceImages: refImages?.length ? refImages : undefined,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `API error (${res.status})`)
    }

    const data = await res.json()
    const rawText = data.content?.[0]?.text || ''

    let parsed
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      parsed = null
    }
    return { parsed, rawText }
  }, [])

  const runIterativeDesign = useCallback(async (userText, refImages) => {
    const canvas = canvasState.canvasRef.current
    if (!canvas) return

    iterativeAbortRef.current = false
    setLoading(true)

    const delay = (ms) => new Promise(r => setTimeout(r, ms))

    try {
      // --- STEP 0: PLAN PHASE ---
      setMessages(prev => [...prev, { role: 'assistant', content: '🎨 Ooh, let\'s make something amazing!\n\nI\'m dreaming up the perfect palette, fonts, and layout for you...', actionSummary: 'Planning your design' }])

      let canvasObjects = serializeCanvasForAgent(canvas)
      let systemPrompt = buildAgentSystemPrompt(canvasObjects, { iterativeStep: null })

      const planMessages = [
        { role: 'user', content: userText }
      ]

      const { parsed: planResult, rawText: planRaw } = await callAgent(systemPrompt, planMessages, null, refImages)

      if (iterativeAbortRef.current) return
      if (!planResult) {
        setMessages(prev => [...prev, { role: 'assistant', content: planRaw || 'Failed to create design plan.' }])
        return
      }

      const designPlan = planResult.designPlan || null
      setIterativeState({ plan: designPlan, step: 0 })

      if (planResult.actions?.length > 0) {
        await executeActions(canvas, planResult.actions, canvasState)
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: planResult.message || 'Design plan created.',
        actionSummary: planResult.actions?.length ? `Step 1: Executed ${planResult.actions.length} action(s)` : 'Step 1: Plan created',
      }])

      if (planResult.designComplete) {
        await runFinalRating(designPlan)
        return
      }

      await delay(600)

      // --- STEPS 1-N: BUILD PHASE ---
      const MAX_STEPS = 8
      let stepNum = 1

      while (stepNum <= MAX_STEPS && !iterativeAbortRef.current) {
        const snapshot = takeSnapshot()
        if (!snapshot) break

        canvasObjects = serializeCanvasForAgent(canvas)
        systemPrompt = buildAgentSystemPrompt(canvasObjects, {
          iterativeStep: 'continue',
          iterativePlan: designPlan,
        })

        const stepMessages = [
          { role: 'user', content: userText },
          { role: 'assistant', content: planResult.message || '' },
          { role: 'user', content: `Continue building the design. This is build step ${stepNum + 1}. Look at the canvas screenshot and add the next layer of elements according to the plan.`, snapshot },
        ]

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✨ Adding more magic — layer ${stepNum + 1} coming right up!`,
          actionSummary: `Building layer ${stepNum + 1}`,
        }])

        const { parsed: stepResult, rawText: stepRaw } = await callAgent(systemPrompt, stepMessages, snapshot, null)

        if (iterativeAbortRef.current) return
        if (!stepResult) {
          setMessages(prev => [...prev, { role: 'assistant', content: stepRaw || 'Step failed.' }])
          break
        }

        if (stepResult.actions?.length > 0) {
          await executeActions(canvas, stepResult.actions, canvasState)
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: stepResult.message || `Step ${stepNum + 1} complete.`,
          actionSummary: stepResult.actions?.length ? `Step ${stepNum + 1}: Executed ${stepResult.actions.length} action(s)` : null,
        }])

        setIterativeState(prev => ({ ...prev, step: stepNum }))

        if (stepResult.designComplete) break
        if (!stepResult.stepComplete && !stepResult.actions?.length) break

        stepNum++
        await delay(600)
      }

      if (iterativeAbortRef.current) return

      // --- REFINE PHASE ---
      await delay(400)
      await runRefinement(userText, designPlan)

    } catch (err) {
      console.error('Design process error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: `Design process encountered an error: ${err.message}` }])
    } finally {
      setLoading(false)
      setIterativeState(null)
      setReferenceImages([])
    }
  }, [canvasState, takeSnapshot, callAgent])

  const runRefinement = useCallback(async (userText, designPlan) => {
    const canvas = canvasState.canvasRef.current
    if (!canvas) return

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '🔍 Almost there! Let me fine-tune a few things to make this *chef\'s kiss*...',
      actionSummary: 'Polishing the details',
    }])

    const snapshot = takeSnapshot()
    const canvasObjects = serializeCanvasForAgent(canvas)
    const systemPrompt = buildAgentSystemPrompt(canvasObjects, {
      iterativeStep: 'refine',
      iterativePlan: designPlan,
    })

    const refineMessages = [
      { role: 'user', content: `Original request: "${userText}". The design layout is now complete. Please review the screenshot and refine.`, snapshot },
    ]

    try {
      const { parsed, rawText } = await callAgent(systemPrompt, refineMessages, snapshot, null)

      if (parsed) {
        if (parsed.actions?.length > 0) {
          await executeActions(canvas, parsed.actions, canvasState)
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: parsed.message || 'Refinement complete.',
          actionSummary: parsed.actions?.length ? `Refined: ${parsed.actions.length} adjustment(s)` : 'No adjustments needed',
        }])
      }

      await runFinalRating(designPlan)

    } catch (err) {
      console.error('Refinement error:', err)
    }
  }, [canvasState, takeSnapshot, callAgent])

  const runFinalRating = useCallback(async (designPlan) => {
    const canvas = canvasState.canvasRef.current
    if (!canvas) return

    const delay = (ms) => new Promise(r => setTimeout(r, ms))
    await delay(500)

    const snapshot = takeSnapshot()
    if (!snapshot) return

    const canvasObjects = serializeCanvasForAgent(canvas)
    const systemPrompt = buildAgentSystemPrompt(canvasObjects, {
      iterativeStep: 'rate',
      iterativePlan: designPlan,
    })

    const rateMessages = [
      { role: 'user', content: 'Rate this final design and apply improvements if needed.', snapshot },
    ]

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '💯 Let me take a final look and make sure everything is gorgeous...',
      actionSummary: 'Final quality check',
    }])

    try {
      const { parsed, rawText } = await callAgent(systemPrompt, rateMessages, snapshot, null)

      if (parsed) {
        if (parsed.actions?.length > 0) {
          await executeActions(canvas, parsed.actions, canvasState)
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: parsed.message || 'Rating complete.',
          actionSummary: parsed.actions?.length ? `Applied ${parsed.actions.length} improvement(s)` : 'Design finalized',
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: rawText || 'Rating complete.' }])
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✨ Design complete! Feel free to ask me to make any changes or create something new.',
      }])
    } catch (err) {
      console.error('Rating error:', err)
    }
  }, [canvasState, takeSnapshot, callAgent])

  const sendMessage = useCallback(async (userText, includeSnapshot = false) => {
    if (!userText.trim() || loading) return

    const canvas = canvasState.canvasRef.current
    if (!canvas) return

    // Easter egg: "Reign in Blood" triggers blood rain effect
    if (userText.toLowerCase().includes('reign in blood') || userText.toLowerCase().includes('raining blood')) {
      setBloodRain(true)
      setTimeout(() => setBloodRain(false), 8000)
    }

    const userMessage = { role: 'user', content: userText.trim() }
    const currentRefImages = [...referenceImages]

    setMessages(prev => [...prev, userMessage])
    setInput('')

    if (isDesignRequest(userText) && !includeSnapshot) {
      await runIterativeDesign(userText.trim(), currentRefImages)
      return
    }

    const canvasObjects = serializeCanvasForAgent(canvas)
    const systemPrompt = buildAgentSystemPrompt(canvasObjects)
    const snapshot = includeSnapshot ? takeSnapshot() : null

    setLoading(true)

    const conversationMessages = [...messages.filter(m => m.role !== 'system'), userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const { parsed, rawText } = await callAgent(systemPrompt, conversationMessages, snapshot, currentRefImages.length ? currentRefImages : null)

      if (parsed && parsed.message) {
        let actionSummary = null
        if (parsed.actions && parsed.actions.length > 0) {
          const results = await executeActions(canvas, parsed.actions, canvasState)
          const successes = results.filter(r => r.success).length
          actionSummary = `Executed ${successes}/${results.length} actions`
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: parsed.message,
          actionSummary,
        }])

        if (parsed.shouldRate) {
          setTimeout(async () => {
            const ratingSnapshot = takeSnapshot()
            if (ratingSnapshot) {
              await runFinalRating(null)
            }
          }, 500)
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: rawText || 'I received an empty response. Please try again.' }])
      }
    } catch (err) {
      console.error('Agent error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}. Please try again.` }])
    } finally {
      setLoading(false)
      setReferenceImages([])
    }
  }, [canvasState, loading, messages, takeSnapshot, referenceImages, isDesignRequest, runIterativeDesign, callAgent, runFinalRating])

  const isImageFile = (file) => {
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    return t.startsWith('image/') || t.startsWith('video/') ||
      n.endsWith('.gif') || n.endsWith('.webm') || n.endsWith('.webp') ||
      n.endsWith('.mp4') || n.endsWith('.png') || n.endsWith('.jpg') ||
      n.endsWith('.jpeg') || n.endsWith('.svg') || n.endsWith('.apng') || n.endsWith('.avif')
  }

  const addFileAsReference = useCallback((file) => {
    if (!isImageFile(file)) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      setReferenceImages(prev => [...prev, {
        data: base64,
        mediaType: file.type || 'image/png',
        name: file.name || 'dropped-image',
      }])
    }
    reader.readAsDataURL(file)
  }, [])

  const handleImageUpload = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) addFileAsReference(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [addFileAsReference])

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) addFileAsReference(file)
      }
    }
  }, [addFileAsReference])

  const handleChatDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleChatDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files || [])
    for (const file of files) addFileAsReference(file)
  }, [addFileAsReference])

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      <style>{`
        @keyframes agentBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes agentSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes agentLightningArrive {
          0% {
            opacity: 0;
            transform: translateY(60px) scaleY(0.15) scaleX(0.4);
            transform-origin: bottom center;
            filter: brightness(3) saturate(0.5);
          }
          25% {
            opacity: 1;
            transform: translateY(-12px) scaleY(1.06) scaleX(1.02);
            transform-origin: bottom center;
            filter: brightness(1.8) saturate(0.7);
          }
          45% {
            opacity: 1;
            transform: translateY(4px) scaleY(0.98) scaleX(1);
            filter: brightness(1.2) saturate(0.9);
          }
          65% {
            transform: translateY(-2px) scaleY(1.01) scaleX(1);
            filter: brightness(1.05);
          }
          80% {
            transform: translateY(1px) scaleY(1) scaleX(1);
            filter: brightness(1);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1) scaleX(1);
            filter: brightness(1) saturate(1);
          }
        }
        @keyframes agentOrbFloat {
          0%   { transform: translateY(0px); }
          20%  { transform: translateY(-10px) translateX(2px); }
          40%  { transform: translateY(-4px) translateX(-2px); }
          60%  { transform: translateY(-12px) translateX(1px); }
          80%  { transform: translateY(-6px) translateX(-1px); }
          100% { transform: translateY(0px); }
        }
        @keyframes magicalGlow {
          0%, 100% {
            filter: drop-shadow(0 0 15px rgba(100,160,255,0.6))
                    drop-shadow(0 0 30px rgba(130,190,255,0.4))
                    drop-shadow(0 0 45px rgba(100,160,255,0.2));
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(100,160,255,0.9))
                    drop-shadow(0 0 50px rgba(130,190,255,0.6))
                    drop-shadow(0 0 75px rgba(200,225,255,0.3));
          }
        }
        @keyframes shadowFloat {
          0%   { transform: translateX(-50%) scale(1, 1); opacity: 0.4; }
          20%  { transform: translateX(-50%) scale(0.85, 0.85); opacity: 0.25; }
          40%  { transform: translateX(-50%) scale(0.95, 0.95); opacity: 0.35; }
          60%  { transform: translateX(-50%) scale(0.8, 0.8); opacity: 0.2; }
          80%  { transform: translateX(-50%) scale(0.9, 0.9); opacity: 0.3; }
          100% { transform: translateX(-50%) scale(1, 1); opacity: 0.4; }
        }
        @keyframes agentFabShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes agentStrokeShimmer {
          0% { background-position: 100% 50%; }
          50% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes agentGlowPulseDark {
          0%, 100% {
            box-shadow:
              0 4px 20px rgba(139,92,246,0.5),
              0 0 40px rgba(6,182,212,0.25),
              0 0 60px rgba(139,92,246,0.15);
          }
          50% {
            box-shadow:
              0 6px 30px rgba(139,92,246,0.65),
              0 0 55px rgba(6,182,212,0.4),
              0 0 80px rgba(139,92,246,0.25);
          }
        }
        @keyframes agentGlowPulse {
          0%, 100% {
            box-shadow:
              0 4px 20px rgba(139,92,246,0.5),
              0 0 40px rgba(6,182,212,0.25),
              0 0 60px rgba(139,92,246,0.15);
          }
          50% {
            box-shadow:
              0 6px 30px rgba(139,92,246,0.65),
              0 0 55px rgba(6,182,212,0.4),
              0 0 80px rgba(139,92,246,0.25);
          }
        }
        @keyframes agentGlowPulseLazer {
          0%, 100% {
            box-shadow:
              0 4px 20px rgba(139,92,246,0.6),
              0 0 40px rgba(6,182,212,0.35),
              0 0 60px rgba(139,92,246,0.2),
              0 0 80px rgba(6,182,212,0.1);
          }
          50% {
            box-shadow:
              0 6px 30px rgba(139,92,246,0.75),
              0 0 55px rgba(6,182,212,0.5),
              0 0 80px rgba(139,92,246,0.35),
              0 0 100px rgba(6,182,212,0.2);
          }
        }
        @keyframes agentAuraRing {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes agentAuraRing2 {
          0% { transform: scale(1); opacity: 0.3; }
          60% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes fStar1 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          6%   { opacity:1; transform: translate(-12px,-18px) scale(1.4) rotate(20deg); }
          20%  { opacity:1; transform: translate(-28px,-48px) scale(1.1) rotate(60deg); }
          45%  { opacity:0.5; transform: translate(-44px,-78px) scale(0.6) rotate(130deg); }
          65%  { opacity:0; transform: translate(-52px,-96px) scale(0.1) rotate(180deg); }
          100% { opacity:0; }
        }
        @keyframes fStar2 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          8%   { opacity:1; transform: translate(16px,-22px) scale(1.2) rotate(-15deg); }
          25%  { opacity:0.9; transform: translate(34px,-56px) scale(0.9) rotate(-55deg); }
          50%  { opacity:0.3; transform: translate(48px,-84px) scale(0.4) rotate(-110deg); }
          68%  { opacity:0; transform: translate(56px,-100px) scale(0) rotate(-150deg); }
          100% { opacity:0; }
        }
        @keyframes fStar3 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          7%   { opacity:1; transform: translate(-30px,-6px) scale(1.3) rotate(40deg); }
          22%  { opacity:0.8; transform: translate(-54px,-24px) scale(1.0) rotate(95deg); }
          48%  { opacity:0.2; transform: translate(-72px,-46px) scale(0.3) rotate(160deg); }
          62%  { opacity:0; transform: translate(-80px,-56px) scale(0) rotate(200deg); }
          100% { opacity:0; }
        }
        @keyframes fStar4 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          9%   { opacity:0.9; transform: translate(24px,8px) scale(1.0) rotate(-30deg); }
          28%  { opacity:0.7; transform: translate(50px,-16px) scale(0.7) rotate(-80deg); }
          52%  { opacity:0.15; transform: translate(66px,-38px) scale(0.2) rotate(-140deg); }
          66%  { opacity:0; transform: translate(74px,-48px) scale(0) rotate(-170deg); }
          100% { opacity:0; }
        }
        @keyframes fStar5 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          5%   { opacity:1; transform: translate(2px,-26px) scale(1.5) rotate(10deg); }
          18%  { opacity:1; transform: translate(4px,-60px) scale(1.2) rotate(35deg); }
          42%  { opacity:0.4; transform: translate(6px,-94px) scale(0.5) rotate(80deg); }
          60%  { opacity:0; transform: translate(8px,-112px) scale(0) rotate(120deg); }
          100% { opacity:0; }
        }
        @keyframes fStar6 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          10%  { opacity:0.85; transform: translate(28px,-18px) scale(1.1) rotate(25deg); }
          30%  { opacity:0.5; transform: translate(52px,-44px) scale(0.7) rotate(70deg); }
          55%  { opacity:0; transform: translate(68px,-66px) scale(0) rotate(120deg); }
          100% { opacity:0; }
        }
        @keyframes fStar7 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          8%   { opacity:0.9; transform: translate(-18px,-28px) scale(1.2) rotate(-25deg); }
          26%  { opacity:0.6; transform: translate(-36px,-62px) scale(0.8) rotate(-70deg); }
          50%  { opacity:0; transform: translate(-48px,-88px) scale(0) rotate(-120deg); }
          100% { opacity:0; }
        }
        @keyframes fStar8 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          6%   { opacity:1; transform: translate(-8px,-20px) scale(1.6) rotate(15deg); }
          15%  { opacity:0.9; transform: translate(-16px,-50px) scale(1.3) rotate(45deg); }
          35%  { opacity:0.4; transform: translate(-22px,-80px) scale(0.6) rotate(90deg); }
          55%  { opacity:0; transform: translate(-26px,-100px) scale(0) rotate(140deg); }
          100% { opacity:0; }
        }
        @keyframes fStar9 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          10%  { opacity:0.8; transform: translate(10px,-14px) scale(0.9) rotate(-20deg); }
          32%  { opacity:0.5; transform: translate(22px,-40px) scale(0.6) rotate(-60deg); }
          54%  { opacity:0; transform: translate(30px,-60px) scale(0) rotate(-100deg); }
          100% { opacity:0; }
        }
        @keyframes fDust1 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          5%   { opacity:0.8; transform: translate(-8px,-14px) scale(1); }
          25%  { opacity:0.6; transform: translate(-20px,-40px) scale(1.2); }
          50%  { opacity:0.25; transform: translate(-30px,-66px) scale(0.8); }
          70%  { opacity:0; transform: translate(-36px,-82px) scale(0.3); }
          100% { opacity:0; }
        }
        @keyframes fDust2 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          8%   { opacity:0.7; transform: translate(10px,-16px) scale(0.8); }
          30%  { opacity:0.5; transform: translate(24px,-44px) scale(1.0); }
          55%  { opacity:0.15; transform: translate(34px,-70px) scale(0.5); }
          72%  { opacity:0; transform: translate(40px,-84px) scale(0.2); }
          100% { opacity:0; }
        }
        @keyframes fDust3 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          6%   { opacity:0.6; transform: translate(4px,-20px) scale(0.9); }
          28%  { opacity:0.4; transform: translate(8px,-52px) scale(1.1); }
          52%  { opacity:0.1; transform: translate(10px,-78px) scale(0.4); }
          68%  { opacity:0; transform: translate(12px,-92px) scale(0.1); }
          100% { opacity:0; }
        }
        @keyframes fDust4 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          7%   { opacity:0.7; transform: translate(-16px,4px) scale(0.7); }
          26%  { opacity:0.4; transform: translate(-34px,-18px) scale(0.9); }
          50%  { opacity:0.1; transform: translate(-46px,-38px) scale(0.4); }
          65%  { opacity:0; }
          100% { opacity:0; }
        }
        @keyframes fDust5 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          9%   { opacity:0.65; transform: translate(18px,6px) scale(0.6); }
          30%  { opacity:0.35; transform: translate(38px,-12px) scale(0.8); }
          54%  { opacity:0; transform: translate(50px,-30px) scale(0.2); }
          100% { opacity:0; }
        }
        @keyframes fTrail {
          0%   { opacity:0; transform: scaleX(0); }
          10%  { opacity:0.6; transform: scaleX(0.5); }
          30%  { opacity:0.3; transform: scaleX(1); }
          60%  { opacity:0; transform: scaleX(1.2); }
          100% { opacity:0; }
        }
        @keyframes agentIconPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
          50% { transform: scale(1.18); filter: drop-shadow(0 0 12px rgba(94,234,212,0.8)) drop-shadow(0 0 24px rgba(14,165,233,0.5)); }
        }
        @keyframes sparkBurst1 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          8%   { opacity:1; transform: translate(-40px,-60px) scale(1.8) rotate(30deg); }
          35%  { opacity:0.7; transform: translate(-90px,-130px) scale(1.2) rotate(100deg); }
          70%  { opacity:0; transform: translate(-130px,-180px) scale(0.2) rotate(200deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst2 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          6%   { opacity:1; transform: translate(35px,-70px) scale(1.6) rotate(-20deg); }
          30%  { opacity:0.8; transform: translate(80px,-150px) scale(1.0) rotate(-80deg); }
          65%  { opacity:0; transform: translate(110px,-200px) scale(0.1) rotate(-180deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst3 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          10%  { opacity:1; transform: translate(-60px,-30px) scale(1.5) rotate(50deg); }
          40%  { opacity:0.6; transform: translate(-140px,-70px) scale(0.9) rotate(140deg); }
          72%  { opacity:0; transform: translate(-190px,-100px) scale(0) rotate(250deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst4 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          7%   { opacity:0.9; transform: translate(50px,-40px) scale(1.3) rotate(-40deg); }
          32%  { opacity:0.5; transform: translate(120px,-90px) scale(0.8) rotate(-120deg); }
          68%  { opacity:0; transform: translate(160px,-130px) scale(0) rotate(-220deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst5 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          5%   { opacity:1; transform: translate(5px,-80px) scale(2.0) rotate(15deg); }
          28%  { opacity:0.9; transform: translate(10px,-170px) scale(1.4) rotate(50deg); }
          60%  { opacity:0; transform: translate(12px,-240px) scale(0.3) rotate(130deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst6 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          9%   { opacity:1; transform: translate(-25px,-75px) scale(1.4) rotate(-35deg); }
          38%  { opacity:0.6; transform: translate(-55px,-160px) scale(0.8) rotate(-100deg); }
          70%  { opacity:0; transform: translate(-75px,-220px) scale(0) rotate(-190deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst7 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          8%   { opacity:0.9; transform: translate(60px,-20px) scale(1.2) rotate(25deg); }
          35%  { opacity:0.4; transform: translate(130px,-55px) scale(0.7) rotate(75deg); }
          65%  { opacity:0; transform: translate(170px,-80px) scale(0) rotate(150deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst8 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          6%   { opacity:1; transform: translate(-70px,-50px) scale(1.7) rotate(60deg); }
          32%  { opacity:0.5; transform: translate(-150px,-110px) scale(1.0) rotate(150deg); }
          66%  { opacity:0; transform: translate(-200px,-150px) scale(0) rotate(270deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst9 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          7%   { opacity:0.8; transform: translate(20px,-90px) scale(1.1) rotate(-25deg); }
          30%  { opacity:0.4; transform: translate(45px,-190px) scale(0.6) rotate(-70deg); }
          58%  { opacity:0; transform: translate(60px,-250px) scale(0) rotate(-140deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst10 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          8%   { opacity:1; transform: translate(-45px,-85px) scale(1.6) rotate(45deg); }
          36%  { opacity:0.6; transform: translate(-100px,-180px) scale(1.0) rotate(120deg); }
          68%  { opacity:0; transform: translate(-140px,-240px) scale(0) rotate(220deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst11 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          6%   { opacity:0.9; transform: translate(70px,-55px) scale(1.3) rotate(-50deg); }
          30%  { opacity:0.4; transform: translate(150px,-120px) scale(0.7) rotate(-130deg); }
          62%  { opacity:0; transform: translate(200px,-160px) scale(0) rotate(-240deg); }
          100% { opacity:0; }
        }
        @keyframes sparkBurst12 {
          0%   { opacity:0; transform: translate(0,0) scale(0) rotate(0deg); }
          10%  { opacity:1; transform: translate(-15px,-95px) scale(1.9) rotate(20deg); }
          40%  { opacity:0.7; transform: translate(-30px,-200px) scale(1.2) rotate(65deg); }
          72%  { opacity:0; transform: translate(-40px,-270px) scale(0.2) rotate(150deg); }
          100% { opacity:0; }
        }
        @keyframes dustBurst1 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          8%   { opacity:0.9; transform: translate(-30px,-50px) scale(1.5); }
          40%  { opacity:0.5; transform: translate(-70px,-120px) scale(1.8); }
          75%  { opacity:0; transform: translate(-100px,-170px) scale(0.5); }
          100% { opacity:0; }
        }
        @keyframes dustBurst2 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          7%   { opacity:0.8; transform: translate(40px,-60px) scale(1.3); }
          35%  { opacity:0.4; transform: translate(90px,-140px) scale(1.6); }
          70%  { opacity:0; transform: translate(120px,-190px) scale(0.3); }
          100% { opacity:0; }
        }
        @keyframes dustBurst3 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          9%   { opacity:0.7; transform: translate(10px,-80px) scale(1.4); }
          38%  { opacity:0.3; transform: translate(20px,-170px) scale(1.7); }
          72%  { opacity:0; transform: translate(25px,-230px) scale(0.4); }
          100% { opacity:0; }
        }
        @keyframes dustBurst4 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          6%   { opacity:0.8; transform: translate(-50px,-35px) scale(1.2); }
          32%  { opacity:0.3; transform: translate(-110px,-80px) scale(1.5); }
          65%  { opacity:0; transform: translate(-150px,-110px) scale(0.3); }
          100% { opacity:0; }
        }
        @keyframes dustBurst5 {
          0%   { opacity:0; transform: translate(0,0) scale(0); }
          8%   { opacity:0.7; transform: translate(55px,-30px) scale(1.1); }
          36%  { opacity:0.3; transform: translate(120px,-70px) scale(1.4); }
          68%  { opacity:0; transform: translate(160px,-95px) scale(0.2); }
          100% { opacity:0; }
        }
        @keyframes lavaLampDrift {
          0%   { transform: translate(0%, 0%) rotate(0deg); }
          25%  { transform: translate(8%, -6%) rotate(3deg); }
          50%  { transform: translate(-4%, 5%) rotate(-2deg); }
          75%  { transform: translate(-7%, -3%) rotate(4deg); }
          100% { transform: translate(0%, 0%) rotate(0deg); }
        }
        @keyframes lavaLampDrift2 {
          0%   { transform: translate(0%, 0%) rotate(0deg); }
          33%  { transform: translate(-6%, 4%) rotate(-3deg); }
          66%  { transform: translate(5%, -5%) rotate(2deg); }
          100% { transform: translate(0%, 0%) rotate(0deg); }
        }
        .agent-orb-container {
          animation: agentOrbFloat 6s ease-in-out infinite, magicalGlow 4s ease-in-out infinite;
        }
        .gem-shimmer-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: visible !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .agent-orb-shadow {
          position: absolute;
          bottom: -15px;
          left: 50%;
          width: 50px;
          height: 12px;
          background: radial-gradient(ellipse, rgba(100,160,255,0.5) 0%, rgba(60,100,180,0.3) 40%, transparent 70%);
          border-radius: 50%;
          animation: shadowFloat 6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes diamondCrackle {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 10px rgba(100,160,255,0.7)) drop-shadow(0 0 20px rgba(130,190,255,0.5)); }
          10% { filter: brightness(1.4) drop-shadow(0 0 16px rgba(100,160,255,1)) drop-shadow(0 0 32px rgba(200,225,255,0.9)); }
          12% { filter: brightness(1) drop-shadow(0 0 10px rgba(100,160,255,0.7)) drop-shadow(0 0 20px rgba(130,190,255,0.5)); }
          40% { filter: brightness(1.25) drop-shadow(0 0 14px rgba(130,190,255,0.9)) drop-shadow(0 0 28px rgba(100,160,255,0.7)); }
          42% { filter: brightness(1) drop-shadow(0 0 10px rgba(100,160,255,0.7)) drop-shadow(0 0 20px rgba(130,190,255,0.5)); }
          70% { filter: brightness(1.2) drop-shadow(0 0 18px rgba(200,225,255,0.95)) drop-shadow(0 0 36px rgba(130,190,255,0.8)); }
          72% { filter: brightness(1) drop-shadow(0 0 10px rgba(100,160,255,0.7)) drop-shadow(0 0 20px rgba(130,190,255,0.5)); }
        }
        @keyframes diamondRotate {
          0%, 100% { transform: rotate(45deg) scale(1); }
          50% { transform: rotate(45deg) scale(1.03); }
        }
        @keyframes diamondFacetShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes lightningArc {
          0%, 20%, 40%, 60%, 80%, 100% { opacity: 0; }
          5%, 10% { opacity: 0.8; }
          25%, 30% { opacity: 0.6; }
          45%, 50% { opacity: 0.9; }
          65%, 70% { opacity: 0.5; }
          85%, 90% { opacity: 0.7; }
        }
        .gem-heartbeat-active {
          animation: gemHeartbeat 3s ease-in-out infinite;
        }
        @keyframes gemHeartbeat {
          0%   { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(160,20,60,0.5)) drop-shadow(0 0 18px rgba(120,10,50,0.3)) hue-rotate(145deg) saturate(1.6); }
          25%  { transform: scale(1.03); filter: drop-shadow(0 0 14px rgba(180,15,55,0.7)) drop-shadow(0 0 30px rgba(140,10,70,0.5)) hue-rotate(150deg) saturate(1.9) brightness(1.08); }
          50%  { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(160,20,60,0.5)) drop-shadow(0 0 18px rgba(120,10,50,0.3)) hue-rotate(145deg) saturate(1.6); }
          75%  { transform: scale(1.02); filter: drop-shadow(0 0 12px rgba(170,18,65,0.6)) drop-shadow(0 0 24px rgba(130,12,60,0.4)) hue-rotate(148deg) saturate(1.8) brightness(1.05); }
          100% { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(160,20,60,0.5)) drop-shadow(0 0 18px rgba(120,10,50,0.3)) hue-rotate(145deg) saturate(1.6); }
        }
        .agent-fab-btn {
          background: transparent;
          transition: transform 0.2s ease;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .agent-fab-btn:hover {
          transform: scale(1.1);
        }
        .agent-fab-btn:focus,
        .agent-fab-btn:focus-visible {
          outline: none;
          box-shadow: none;
        }
        .agent-fab-btn-dark {
          background: transparent;
          outline: none;
        }
        
        .agent-lightning-arc {
          position: absolute;
          pointer-events: none;
          animation: lightningArc 1.5s ease-in-out infinite;
        }
        .agent-fab-sparkle {
          position: absolute;
          pointer-events: none;
          filter: drop-shadow(0 0 3px currentColor);
        }
        .agent-dust {
          position: absolute;
          pointer-events: none;
          border-radius: 9999px;
        }
        .agent-trail {
          position: absolute;
          pointer-events: none;
          border-radius: 4px;
          transform-origin: left center;
        }
        .agent-icon-inner {
          animation: agentIconPulse 2.5s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .agent-chat-input:focus {
          --tw-ring-color: rgba(14,165,233,0.35);
          border-color: rgba(14,165,233,0.4) !important;
        }
      `}</style>

      {showLightning && (
        <LightningOverlay
          targetX={lightningTarget.x}
          targetY={lightningTarget.y}
          onDone={() => setShowLightning(false)}
        />
      )}

      {/* Blood Rain - Slayer "Reign in Blood" Easter Egg */}
      <BloodRain active={bloodRain} />

      {isOpen && (() => {
        const chatW = 380, chatH = 560
        const isDark = canvasState.darkMode
        let chatStyle = { height: chatH, maxHeight: 'calc(100vh - 80px)', zIndex: 10000, animation: 'agentLightningArrive 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', transformOrigin: 'bottom center', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(14,165,233,0.2)', background: isDark ? '#0f172a' : '#f8fdff' }
        let computedLeft, computedTop
        const effectiveChatH = Math.min(chatH, window.innerHeight - 80)
        if (orbPos) {
          const orbCX = orbPos.x + ORB_SIZE / 2
          const orbCY = orbPos.y
          computedLeft = Math.max(8, Math.min(window.innerWidth - chatW - 8, orbCX - chatW / 2))
          computedTop = Math.max(8, Math.min(window.innerHeight - effectiveChatH - 8, orbCY - effectiveChatH - 16))
          chatStyle = { ...chatStyle, height: effectiveChatH, left: computedLeft, top: computedTop }
        } else {
          const bottomOffset = ORB_SIZE + DEFAULT_BOTTOM + 16
          const neededTop = window.innerHeight - bottomOffset - effectiveChatH
          if (neededTop < 8) {
            computedTop = 8
            computedLeft = window.innerWidth - DEFAULT_RIGHT - chatW
            chatStyle = { ...chatStyle, height: effectiveChatH, left: computedLeft, top: computedTop }
          } else {
            chatStyle = { ...chatStyle, height: effectiveChatH, bottom: bottomOffset, right: DEFAULT_RIGHT }
            computedLeft = window.innerWidth - DEFAULT_RIGHT - chatW
            computedTop = neededTop
          }
        }
        return (
        <>
        {sparkBurst && (
          <GenieShower chatLeft={computedLeft} chatTop={computedTop} chatWidth={chatW} />
        )}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <filter id="underwater-warp" x="-3%" y="-3%" width="106%" height="106%">
              <feTurbulence type="turbulence" baseFrequency="0.005 0.008" numOctaves="2" seed={0} result="wave">
                <animate attributeName="seed" from="0" to="50" dur="20s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="wave" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <div
          className="fixed w-[380px] rounded-2xl shadow-2xl flex flex-col"
          onDragOver={handleChatDragOver}
          onDrop={handleChatDrop}
          style={{ ...chatStyle, overflow: 'visible', filter: 'url(#underwater-warp)' }}
        >
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ background: '#0a0e1a', position: 'relative', overflow: 'hidden' }}>
            <HeaderEffect />
            <div className="flex items-center justify-between w-full" style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex items-center gap-2">
                <ClawPfp size={36} />
                <div>
                  <div className="text-white font-semibold text-sm">Dr. Claw</div>
                  <div className="text-xs" style={{ color: '#c4b5fd' }}>First & Only Design Tool for Lobsters™</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const snap = takeSnapshot()
                    if (snap) {
                      sendMessage('Please rate the current design and suggest improvements.', true)
                    }
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  title="Rate current design"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    iterativeAbortRef.current = true
                    setMessages([{ role: 'assistant', content: "Hey dude! I'm Dr. Claw, the most metal crustacean design assistant in the seven seas. Tell me what you'd like to create and I'll bring it to life, man — with LIGHTNING SPEED! The Claw abides. 🦞⚡" }])
                    setIterativeState(null)
                    setReferenceImages([])
                  }}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  title="Clear conversation"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1,4 1,10 7,10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                  title="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0" style={{ background: isDark ? 'linear-gradient(180deg, #0f172a 0%, #111827 40%, #1e293b 100%)' : 'linear-gradient(180deg, #f0fdfa 0%, #f8fafc 40%, #ffffff 100%)' }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} darkMode={isDark} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 shrink-0" style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(14,165,233,0.1)', background: isDark ? 'linear-gradient(180deg, #111827, #0f172a)' : 'linear-gradient(180deg, #f0fdfa, #f8fafc)' }}>
            {referenceImages.length > 0 && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={`data:${img.mediaType};base64,${img.data}`}
                      alt={img.name}
                      className={`w-12 h-12 rounded-lg object-cover border ${isDark ? 'border-gray-600' : 'border-cyan-200'}`}
                    />
                    <button
                      onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-400 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className={`text-[10px] self-end pb-0.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Reference images attached</div>
              </div>
            )}
            {iterativeState && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((iterativeState.step + 1) / 6) * 100)}%`,
                      background: 'linear-gradient(90deg, #2dd4bf, #0ea5e9)',
                    }}
                  />
                </div>
                <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Step {iterativeState.step + 1}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/webm,video/mp4,.gif,.webm,.mp4,.webp,.svg,.apng,.avif"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 ${isDark ? 'text-gray-500 hover:text-cyan-400 hover:bg-gray-700' : 'text-gray-400 hover:text-cyan-500 hover:bg-cyan-50'}`}
                title="Attach reference image"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={referenceImages.length > 0 ? "Describe what to create with these\u2026" : "Ask Dr. Claw to design something..."}
                  className={`w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent agent-chat-input ${isDark ? 'bg-gray-800 text-gray-200 placeholder-gray-500' : 'bg-white text-gray-800 placeholder-gray-400'}`}
                  style={{ border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(14,165,233,0.2)' }}
                  rows={1}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={`w-9 h-9 rounded-full disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-200 shrink-0 hover:scale-105 ${isDark ? 'disabled:bg-gray-700' : 'disabled:bg-gray-300'}`}
                style={!input.trim() || loading ? {} : { background: 'linear-gradient(135deg, #0ea5e9, #1e3a8a)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </div>
          </div>
        </div>
        </>
        )
      })()}

      <div
        className={`agent-orb-container ${orbDragRef.current?.moved ? '' : ''}`}
        onMouseDown={handleOrbMouseDown}
        style={{
          position: 'fixed',
          zIndex: 10001,
          width: ORB_SIZE,
          height: ORB_SIZE,
          cursor: orbDragRef.current?.moved ? 'grabbing' : 'grab',
          ...(orbPos
            ? { left: orbPos.x, top: orbPos.y, transition: orbReturning ? 'left 0.35s ease-out, top 0.35s ease-out' : 'none' }
            : { bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT }),
        }}
      >
        {/* Floating shadow underneath the gem */}
        <div className="agent-orb-shadow" />

        {/* Canvas-based realistic lightning effect - always on, wild when clicked */}
        <OrbLightning size={ORB_SIZE} wild={wildLightning || sparkBurst} />

        {/* Lightning bolt sparks - subtle */}
        {[
          { anim: 'fStar1 3.2s ease-out 0s infinite', size: 4, color: 'rgba(100,160,255,0.3)' },
          { anim: 'fStar3 3.4s ease-out 1.1s infinite', size: 3, color: 'rgba(200,225,255,0.25)' },
          { anim: 'fStar5 3.8s ease-out 0.3s infinite', size: 4, color: 'rgba(255,255,255,0.2)' },
        ].map((s, i) => (
          <svg key={i} className="agent-fab-sparkle" style={{ animation: s.anim, top: '50%', left: '50%', width: s.size, height: s.size, color: s.color, opacity: 0.3 }} viewBox="0 0 24 24">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        ))}

        {/* Subtle energy particles */}
        {[
          { anim: 'fDust1 3.4s ease-out 0.2s infinite', size: 2, color: '#64a0ff', shadow: 'rgba(100,160,255,0.15)' },
          { anim: 'fDust3 3.2s ease-out 1.6s infinite', size: 2, color: '#c8e1ff', shadow: 'rgba(200,225,255,0.1)' },
        ].map((d, i) => (
          <div key={i} className="agent-dust" style={{
            animation: d.anim, top: '50%', left: '50%', width: d.size, height: d.size,
            background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, ${d.color} 40%, transparent 70%)`,
            boxShadow: `0 0 3px 1px ${d.shadow}`,
          }} />
        ))}

        {/* Subtle burst when window opens */}
        {sparkBurst && (
          <>
            <svg className="agent-fab-sparkle" style={{ animation: 'sparkBurst1 1.6s ease-out forwards', top: '50%', left: '50%', width: 6, height: 6, color: 'rgba(100,160,255,0.3)' }} viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
            </svg>
            <svg className="agent-fab-sparkle" style={{ animation: 'sparkBurst3 1.4s ease-out 0.1s forwards', top: '50%', left: '50%', width: 5, height: 5, color: 'rgba(255,255,255,0.25)' }} viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
            </svg>
            <div className="agent-dust" style={{ animation: 'dustBurst1 1.5s ease-out forwards', top: '50%', left: '50%', width: 2, height: 2, background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(100,160,255,0.2) 40%, transparent 70%)', boxShadow: '0 0 3px 1px rgba(100,160,255,0.15)' }} />
          </>
        )}

        

        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => {
              // Trigger wild lightning on click
              setWildLightning(true)
              setTimeout(() => setWildLightning(false), 2000)

              if (isOpen) {
                setIsOpen(false)
              } else {
                const pos = orbPos || getDefaultOrbPos()
                const orbCX = pos.x + ORB_SIZE / 2
                const orbCY = pos.y + ORB_SIZE / 2
                setLightningTarget({ x: orbCX, y: orbCY })
                setShowLightning(true)
                setPendingOpen(true)
                try {
                  const sfx = new Audio('/lightning_strike_01.mp3')
                  sfx.volume = 0.7
                  sfx.play().catch(() => {})
                } catch (_) {}
                setTimeout(() => {
                  setIsOpen(true)
                  setPendingOpen(false)
                  setSparkBurst(true)
                  setTimeout(() => setSparkBurst(false), 1800)
                }, 180)
              }
            }}
            className="agent-fab-btn flex items-center justify-center transition-all duration-200 hover:scale-105 relative overflow-visible"
            title={isOpen ? 'Close Dr. Claw' : 'Open Dr. Claw — AI Design Assistant'}
            style={{ width: ORB_SIZE, height: ORB_SIZE, borderRadius: '0', background: 'transparent', border: 'none', boxShadow: 'none', outline: 'none', filter: 'none' }}
          >
            <>
              <GemPerimeterLightning size={ORB_SIZE} />
              <div className="gem-shimmer-container" style={{ overflow: 'visible', background: 'transparent' }}>
                <img
                  src="/claw_gem.png"
                  alt="Dr. Claw"
                  className={isOpen ? 'gem-heartbeat-active' : ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: isOpen
                      ? 'drop-shadow(0 0 8px rgba(160,20,60,0.5)) drop-shadow(0 0 18px rgba(120,10,50,0.3)) hue-rotate(145deg) saturate(1.6)'
                      : 'drop-shadow(0 0 4px rgba(100,160,255,0.15)) drop-shadow(0 0 8px rgba(130,190,255,0.08))',
                    transition: 'filter 0.6s ease',
                  }}
                />
              </div>
            </>
          </button>
        </div>
      </div>
    </>
  )
}
