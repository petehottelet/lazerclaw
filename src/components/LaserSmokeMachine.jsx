import React, { useState, useRef, useEffect, useCallback } from 'react'

const LASER_COLORS = [
  '#ff00ff',
  '#00ffff',
  '#00ff44',
  '#ff0033',
  '#aa00ff',
  '#0066ff',
  '#ff00ff',
  '#ffff00',
  '#ff4400',
  '#00ffaa',
  '#ff00aa',
]

const LASER_COUNT = LASER_COLORS.length

function parseHex(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function createLaserConfig(index, total) {
  return {
    originX: (index + 1) / (total + 1),
    speed: 0.4 + Math.random() * 0.7,
    phase: (index / total) * Math.PI * 2,
    amplitude: 0.3 + Math.random() * 0.4,
    color: LASER_COLORS[index % LASER_COLORS.length],
    rgb: parseHex(LASER_COLORS[index % LASER_COLORS.length]),
    pulseSpeed: 2.0 + Math.random() * 3,
    pulsePhase: Math.random() * Math.PI * 2,
    secondaryFreq: 0.1 + Math.random() * 0.3,
    secondaryAmp: 0.05 + Math.random() * 0.15,
  }
}

function drawGlowLine(ctx, x1, y1, x2, y2, color, rgb, opacity, pulse) {
  const intensity = 0.75 + pulse * 0.25

  const passes = [
    { width: 130, alpha: 0.02 },
    { width: 96,  alpha: 0.032 },
    { width: 64,  alpha: 0.048 },
    { width: 40,  alpha: 0.08 },
    { width: 26,  alpha: 0.13 },
    { width: 16,  alpha: 0.22 },
    { width: 10,  alpha: 0.36 },
    { width: 5,   alpha: 0.56 },
    { width: 2.5, alpha: 0.72 },
    { width: 1.5, alpha: 0.85 },
  ]

  for (const pass of passes) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = color
    ctx.globalAlpha = pass.alpha * opacity * intensity
    ctx.lineWidth = pass.width
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Saturated inner glow
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = `rgba(${Math.min(255, rgb[0] + 100)}, ${Math.min(255, rgb[1] + 100)}, ${Math.min(255, rgb[2] + 100)}, ${0.5 * opacity * intensity})`
  ctx.lineWidth = 6
  ctx.stroke()

  // White-hot core — triple pass, razor bright center
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * opacity * intensity})`
  ctx.lineWidth = 3.5
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * opacity * intensity})`
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = `rgba(255, 255, 255, ${1.0 * opacity * intensity})`
  ctx.lineWidth = 0.5
  ctx.stroke()

  ctx.globalAlpha = 1
}

function drawFog(ctx, w, h, time, fogOpacity) {
  const fogTop = h * 0.67
  const fogHeight = h - fogTop

  const cloudConfigs = [
    { yOffset: 0.0, scale: 1.8, speed: 0.00015, drift: 95, alpha: 0.234, count: 13 },
    { yOffset: 0.12, scale: 1.45, speed: 0.00022, drift: 75, alpha: 0.195, count: 15 },
    { yOffset: 0.28, scale: 1.1, speed: 0.00035, drift: 55, alpha: 0.156, count: 18 },
    { yOffset: 0.45, scale: 0.9, speed: 0.0005, drift: 40, alpha: 0.13, count: 20 },
    { yOffset: 0.6, scale: 0.7, speed: 0.0007, drift: 28, alpha: 0.104, count: 15 },
  ]

  for (const layer of cloudConfigs) {
    for (let i = 0; i < layer.count; i++) {
      const seed = i * 137.508 + layer.yOffset * 1000
      const baseX = ((seed * 7.31) % 1) * (w + 200) - 100
      const baseY = fogTop + layer.yOffset * fogHeight + ((seed * 3.17) % 1) * fogHeight * 0.3

      const driftX = Math.sin(time * layer.speed * Math.PI * 2 + seed) * layer.drift
      const driftY = Math.cos(time * layer.speed * Math.PI * 1.3 + seed * 0.7) * layer.drift * 0.3

      const x = baseX + driftX
      const y = baseY + driftY
      const radius = (80 + ((seed * 11.3) % 80)) * layer.scale

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(220, 220, 230, ${layer.alpha * fogOpacity})`)
      gradient.addColorStop(0.4, `rgba(200, 200, 215, ${layer.alpha * 0.7 * fogOpacity})`)
      gradient.addColorStop(1, `rgba(180, 180, 200, 0)`)

      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }
  }

  const baseGradient = ctx.createLinearGradient(0, fogTop, 0, h)
  baseGradient.addColorStop(0, `rgba(200, 200, 210, 0)`)
  baseGradient.addColorStop(0.3, `rgba(200, 200, 210, ${0.13 * fogOpacity})`)
  baseGradient.addColorStop(1, `rgba(200, 200, 210, ${0.286 * fogOpacity})`)
  ctx.fillStyle = baseGradient
  ctx.fillRect(0, fogTop, w, fogHeight)
}

function drawLaserFogInteraction(ctx, x, y, w, h, rgb, opacity, pulse) {
  const fogTop = h * 0.67
  if (y < fogTop - 20) return

  const intensity = 0.75 + pulse * 0.25

  // Large diffuse scatter
  const outerR = 160
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, outerR)
  outerGrad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.35 * opacity * intensity})`)
  outerGrad.addColorStop(0.25, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.18 * opacity * intensity})`)
  outerGrad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`)
  ctx.beginPath()
  ctx.arc(x, y, outerR, 0, Math.PI * 2)
  ctx.fillStyle = outerGrad
  ctx.fill()

  // Bright hot spot
  const innerR = 50
  const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, innerR)
  innerGrad.addColorStop(0, `rgba(255, 255, 255, ${0.55 * opacity * intensity})`)
  innerGrad.addColorStop(0.25, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.4 * opacity * intensity})`)
  innerGrad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`)
  ctx.beginPath()
  ctx.arc(x, y, innerR, 0, Math.PI * 2)
  ctx.fillStyle = innerGrad
  ctx.fill()

  // Volumetric cone of light scattered downward into the fog
  const coneH = 120
  const coneW = 70
  const coneGrad = ctx.createLinearGradient(x, y, x, y + coneH)
  coneGrad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.15 * opacity * intensity})`)
  coneGrad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`)
  ctx.beginPath()
  ctx.moveTo(x - 4, y)
  ctx.lineTo(x - coneW, y + coneH)
  ctx.lineTo(x + coneW, y + coneH)
  ctx.lineTo(x + 4, y)
  ctx.closePath()
  ctx.fillStyle = coneGrad
  ctx.fill()
}

// Ambient glow on the ceiling/origin points
function drawOriginGlow(ctx, x, rgb, opacity, pulse, w) {
  const intensity = 0.75 + pulse * 0.25
  const r = 140
  const grad = ctx.createRadialGradient(x, 0, 0, x, 0, r)
  grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.3 * opacity * intensity})`)
  grad.addColorStop(0.4, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.1 * opacity * intensity})`)
  grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`)
  ctx.beginPath()
  ctx.arc(x, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
}

export default function LaserSmokeMachine({ active }) {
  const [visible, setVisible] = useState(false)
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const lasersRef = useRef([])
  const startTimeRef = useRef(null)
  const fadeRef = useRef(0)

  useEffect(() => {
    if (active) {
      setVisible(true)
      startTimeRef.current = performance.now()
    } else if (!active && visible) {
      const timer = setTimeout(() => setVisible(false), 600)
      return () => clearTimeout(timer)
    }
  }, [active])

  useEffect(() => {
    if (lasersRef.current.length === 0) {
      lasersRef.current = Array.from({ length: LASER_COUNT }, (_, i) =>
        createLaserConfig(i, LASER_COUNT)
      )
    }
  }, [])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const now = performance.now()
    const elapsed = now - (startTimeRef.current || now)

    if (active) {
      fadeRef.current = Math.min(1, fadeRef.current + 0.02)
    } else {
      fadeRef.current = Math.max(0, fadeRef.current - 0.025)
    }

    const masterOpacity = fadeRef.current
    const fogBuildUp = Math.min(1, elapsed / 2500)
    const fogOpacity = fogBuildUp * masterOpacity

    ctx.clearRect(0, 0, w, h)

    if (masterOpacity <= 0) {
      animRef.current = requestAnimationFrame(render)
      return
    }

    drawFog(ctx, w, h, now, fogOpacity)

    ctx.globalCompositeOperation = 'screen'

    const lasers = lasersRef.current
    const ts = now * 0.001
    for (let i = 0; i < lasers.length; i++) {
      const laser = lasers[i]
      const t = ts * laser.speed
      const primary = Math.sin(t + laser.phase) * laser.amplitude
      const secondary = Math.sin(t * laser.secondaryFreq * 3.7 + laser.phase * 2.1) * laser.secondaryAmp
      const angle = primary + secondary
      const pulse = 0.5 + 0.5 * Math.sin(ts * laser.pulseSpeed + laser.pulsePhase)

      const originX = laser.originX * w
      const originY = -10

      const beamLength = h * 1.6
      const endX = originX + Math.sin(angle * Math.PI) * beamLength
      const endY = originY + Math.cos(angle * Math.PI * 0.25) * beamLength

      drawGlowLine(ctx, originX, originY, endX, endY, laser.color, laser.rgb, masterOpacity, pulse)
      drawOriginGlow(ctx, originX, laser.rgb, masterOpacity, pulse, w)

      const fogTop = h * 0.67
      const dx = endX - originX
      const dy = endY - originY
      if (dy > 0 && endY > fogTop) {
        const tFog = Math.max(0, (fogTop - originY) / dy)
        const fogHitX = originX + dx * tFog
        const fogHitY = originY + dy * tFog
        if (fogHitY >= fogTop && fogHitY <= h) {
          drawLaserFogInteraction(ctx, fogHitX, fogHitY, w, h, laser.rgb, fogOpacity * masterOpacity, pulse)
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over'

    animRef.current = requestAnimationFrame(render)
  }, [active])

  useEffect(() => {
    if (visible) {
      animRef.current = requestAnimationFrame(render)
    }
    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
    }
  }, [visible, render])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: 'none',
        opacity: active ? 1 : 0,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
