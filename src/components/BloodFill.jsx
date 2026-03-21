import React, { useRef, useEffect } from 'react'

export default function BloodFill() {
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
    const bubbles = []

    const WAVE_N = 80
    const waveH = new Float32Array(WAVE_N)
    const waveV = new Float32Array(WAVE_N)
    let poolLevel = 0
    const poolTarget = 0.95
    let lastTime = performance.now()
    let spawnAcc = 0

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

    function tick(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.04)
      lastTime = now
      const W = cvs.width, H = cvs.height
      ctx.clearRect(0, 0, W, H)

      if (poolLevel < poolTarget) poolLevel = Math.min(poolTarget, poolLevel + dt * 0.0016)

      spawnAcc += dt
      while (spawnAcc > 0 && drops.length < 30) { spawnDrop(); spawnAcc -= 1 / 50 }
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

        const meniscusH = 6
        const meniscusW = W * 0.08

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

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit', zIndex: 50 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.85 }} />
    </div>
  )
}
