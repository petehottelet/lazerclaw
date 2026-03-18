/**
 * ⚡ LAZERCLAW LIGHTNING INTRO ⚡
 *
 * A dramatic Raiden-style entrance animation for the LazerClaw design tool.
 * Because every legendary tool deserves an entrance that makes users go "WHOA!"
 *
 * Uses canvas-based 3-pass lightning rendering from lazerclaw_lightning_overlay.html
 *
 * TOASTY!
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'

// ─── REALISTIC LIGHTNING BOLT GENERATION ───────────────────────────────────
// Midpoint displacement algorithm for realistic jagged bolts
// Directly from lazerclaw_lightning_overlay.html reference
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

// 3-pass bolt rendering - exact style from lazerclaw_lightning_overlay.html
function strokeBolt(ctx, pts, intensity = 1.0, scale = 1.0) {
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

// Draw branches off the main bolt - exact style from reference
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

// Draw sub-branches (thinnest level)
function strokeSubBranch(ctx, pts, intensity = 1.0) {
  ctx.shadowColor = `rgba(130,190,255,0.5)`
  ctx.shadowBlur = 8
  ctx.strokeStyle = `rgba(170,200,255,${intensity * 0.25})`
  ctx.lineWidth = 0.4
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let sp = 1; sp < pts.length; sp++) ctx.lineTo(pts[sp].x, pts[sp].y)
  ctx.stroke()
  ctx.shadowBlur = 0
}

// ─── FULL-SCREEN LIGHTNING STORM CANVAS ─────────────────────────────────────
// Canvas-based lightning storm effect using reference style
function LightningStorm({ active, intensity = 1.0 }) {
  const canvasRef = useRef(null)
  const boltsRef = useRef([])
  const frameRef = useRef(0)

  useEffect(() => {
    if (!active) {
      boltsRef.current = []
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

    // Spawn a new storm bolt
    function spawnStormBolt() {
      const W = canvas.width, H = canvas.height
      // Random start from top edge
      const startX = Math.random() * W
      const startY = -20
      // End somewhere in the middle-lower area
      const endX = startX + (Math.random() - 0.5) * W * 0.4
      const endY = H * (0.4 + Math.random() * 0.5)

      const bolt = generateBolt(startX, startY, endX, endY, 5)
      const mainAng = Math.atan2(endY - startY, endX - startX)

      // Generate branches
      const branches = []
      const numBranches = 3 + Math.floor(Math.random() * 4)
      for (let bi = 0; bi < numBranches; bi++) {
        const brIdx = 2 + Math.floor(Math.random() * (bolt.length - 4))
        if (brIdx >= bolt.length) continue
        const brLen = 40 + Math.random() * 120
        const brAng = mainAng + (Math.random() - 0.5) * 1.8
        const brEnd = {
          x: bolt[brIdx].x + Math.cos(brAng) * brLen,
          y: bolt[brIdx].y + Math.sin(brAng) * brLen
        }
        const branch = generateBolt(bolt[brIdx].x, bolt[brIdx].y, brEnd.x, brEnd.y, 3)

        // Sub-branches
        const subBranches = []
        if (Math.random() < 0.6) {
          const si = 1 + Math.floor(Math.random() * (branch.length - 2))
          if (si < branch.length) {
            const sLen = 20 + Math.random() * 50
            const sAng = brAng + (Math.random() - 0.5) * 2
            const sb = generateBolt(
              branch[si].x, branch[si].y,
              branch[si].x + Math.cos(sAng) * sLen,
              branch[si].y + Math.sin(sAng) * sLen,
              2
            )
            subBranches.push(sb)
          }
        }
        branches.push({ pts: branch, subBranches })
      }

      return {
        id: Date.now() + Math.random(),
        pts: bolt,
        branches,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        scale: 1.5 + Math.random() * 1.0, // Bigger bolts for intro
      }
    }

    function draw() {
      frameRef.current++
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Spawn new bolts periodically
      if (active && frameRef.current % 3 === 0) {
        boltsRef.current.push(spawnStormBolt())
      }

      // Draw and update bolts
      boltsRef.current = boltsRef.current.filter(bolt => {
        // Draw main bolt
        strokeBolt(ctx, bolt.pts, bolt.life * intensity, bolt.scale)

        // Draw branches
        bolt.branches.forEach(branch => {
          strokeBranch(ctx, branch.pts, bolt.life * intensity * 0.8, bolt.scale)
          // Draw sub-branches
          branch.subBranches.forEach(sb => {
            strokeSubBranch(ctx, sb, bolt.life * intensity * 0.6)
          })
        })

        // Decay
        bolt.life -= bolt.decay
        return bolt.life > 0
      })

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
  }, [active, intensity])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}

// Logo lightning overlay component
function LogoLightning({ logoRef, active }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active || !logoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let rafId

    // Anchor points for the laser (dragon mouth to beam tip)
    const ORIGIN_X = 0.625, ORIGIN_Y = 0.390
    const TARGET_X = 0.895, TARGET_Y = 0.210

    function resize() {
      const rect = logoRef.current.getBoundingClientRect()
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }

    function draw() {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const ox = ORIGIN_X * W, oy = ORIGIN_Y * H
      const tx = TARGET_X * W, ty = TARGET_Y * H

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Main bolt
      const bolt = generateBolt(ox, oy, tx, ty, 5)
      strokeBolt(ctx, bolt, 1.0)

      // Branches
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
        strokeBranch(ctx, branch, 1.0)

        // Sub-branch
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
          ctx.strokeStyle = `rgba(170,200,255,0.25)`
          ctx.lineWidth = 0.4
          ctx.beginPath()
          ctx.moveTo(sb[0].x, sb[0].y)
          for (let sp = 1; sp < sb.length; sp++) ctx.lineTo(sb[sp].x, sb[sp].y)
          ctx.stroke()
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
  }, [active, logoRef])

  if (!active) return null

  return (
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
  )
}

// ─── DEMONIC WILHELM SCREAM WITH HEAVY METAL FX ─────────────────────────────
// Creates a brutal, distorted, reverb-drenched version of the Wilhelm scream
async function playDemonicWilhelm() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

    // Fetch the Wilhelm scream
    const response = await fetch('/wilhelm_scream.wav')
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    // Create source
    const source = audioCtx.createBufferSource()
    source.buffer = audioBuffer

    // PITCH DOWN for demonic voice (slower playback = lower pitch)
    source.playbackRate.value = 0.666 // Number of the beast! 🤘

    // HEAVY DISTORTION - Make it gnarly
    const distortion = audioCtx.createWaveShaper()
    function makeDistortionCurve(amount) {
      const samples = 44100
      const curve = new Float32Array(samples)
      const deg = Math.PI / 180
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
      }
      return curve
    }
    distortion.curve = makeDistortionCurve(400) // BRUTAL distortion
    distortion.oversample = '4x'

    // SECOND LAYER OF DISTORTION for extra crunch
    const distortion2 = audioCtx.createWaveShaper()
    distortion2.curve = makeDistortionCurve(200)
    distortion2.oversample = '2x'

    // LOW-PASS FILTER - Remove harsh highs, keep it heavy
    const lowPass = audioCtx.createBiquadFilter()
    lowPass.type = 'lowpass'
    lowPass.frequency.value = 2000
    lowPass.Q.value = 1

    // HIGH-PASS - Remove mud
    const highPass = audioCtx.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = 80

    // COMPRESSOR - Squash dynamics for that metal sound
    const compressor = audioCtx.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.knee.value = 30
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    // CONVOLVER REVERB - Create a massive space
    const convolver = audioCtx.createConvolver()
    // Generate impulse response for huge reverb
    const reverbTime = 4.0 // 4 seconds of hell
    const sampleRate = audioCtx.sampleRate
    const length = sampleRate * reverbTime
    const impulse = audioCtx.createBuffer(2, length, sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // Exponential decay with some randomness
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5)
      }
    }
    convolver.buffer = impulse

    // DELAY for evil echo
    const delay1 = audioCtx.createDelay(2.0)
    delay1.delayTime.value = 0.333
    const delay1Gain = audioCtx.createGain()
    delay1Gain.gain.value = 0.4

    const delay2 = audioCtx.createDelay(2.0)
    delay2.delayTime.value = 0.666
    const delay2Gain = audioCtx.createGain()
    delay2Gain.gain.value = 0.25

    // DRY/WET MIX
    const dryGain = audioCtx.createGain()
    dryGain.gain.value = 0.7

    const wetGain = audioCtx.createGain()
    wetGain.gain.value = 0.8

    // MASTER GAIN
    const masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.425

    // Chain: source -> distortion -> distortion2 -> filters -> compressor -> split (dry/wet)
    source.connect(distortion)
    distortion.connect(distortion2)
    distortion2.connect(lowPass)
    lowPass.connect(highPass)
    highPass.connect(compressor)

    // Dry path
    compressor.connect(dryGain)
    dryGain.connect(masterGain)

    // Wet path (reverb)
    compressor.connect(convolver)
    convolver.connect(wetGain)
    wetGain.connect(masterGain)

    // Delay paths
    compressor.connect(delay1)
    delay1.connect(delay1Gain)
    delay1Gain.connect(masterGain)

    delay1.connect(delay2)
    delay2.connect(delay2Gain)
    delay2Gain.connect(masterGain)

    // Output
    masterGain.connect(audioCtx.destination)

    // PLAY THE DEMONIC SCREAM! 🔥
    source.start(0)

    // Cleanup after playback
    source.onended = () => {
      audioCtx.close()
    }
  } catch (err) {
    console.error('Failed to play demonic Wilhelm:', err)
  }
}

export default function LightningIntro({ onComplete }) {
  const [phase, setPhase] = useState('dark')        // dark -> strike -> done
  const [stormActive, setStormActive] = useState(false)
  const [stormIntensity, setStormIntensity] = useState(1.0)
  const [rings, setRings] = useState([])
  const [particles, setParticles] = useState([])
  const [flashKey, setFlashKey] = useState(0)
  const [shaking, setShaking] = useState(false)
  const lightningAudioRef = useRef(null)
  const containerRef = useRef(null)
  const logoRef = useRef(null)

  // Generate energy rings
  const spawnRing = useCallback((x, y) => {
    const id = Date.now() + Math.random()
    setRings(prev => [...prev, { id, x, y }])
    setTimeout(() => setRings(prev => prev.filter(r => r.id !== id)), 1000)
  }, [])

  // Generate particles
  const spawnParticles = useCallback((count = 20) => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      angle: (i / count) * 360,
      distance: 100 + Math.random() * 200,
      size: 2 + Math.random() * 4,
      duration: 0.5 + Math.random() * 0.5,
    }))
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles([]), 1500)
  }, [])

  // The main animation sequence - MORTAL KOMBAT STYLE!
  useEffect(() => {
    const sequence = async () => {
      // Phase 1: Initial darkness with anticipation
      await delay(300)

      // Phase 2: Lightning storm begins!
      setPhase('strike')
      setStormActive(true)
      setStormIntensity(1.0)

      // Play lightning strike sound
      if (lightningAudioRef.current) {
        lightningAudioRef.current.volume = 0.7
        lightningAudioRef.current.play().catch(() => {})
      }

      // Play the DEMONIC WILHELM SCREAM!
      playDemonicWilhelm()

      // Multiple flash pulses during storm
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          setFlashKey(k => k + 1)
          setShaking(true)
          setTimeout(() => setShaking(false), 350)
        }, i * 100)
      }

      // Let the storm rage
      await delay(800)

      // Spawn energy rings as the storm peaks
      spawnRing(50, 50)
      setTimeout(() => spawnRing(50, 50), 200)
      spawnParticles(20)

      // Additional storm pulses
      setStormIntensity(1.2)
      await delay(600)

      // Storm starts to subside
      setStormIntensity(0.6)
      await delay(400)

      setStormIntensity(0.3)
      await delay(300)

      // Fade out — welcome page with logo is revealed underneath
      setStormActive(false)
      setPhase('done')

      await delay(400)
      onComplete?.()
    }

    sequence()
  }, [spawnRing, spawnParticles, onComplete])

  // Don't render if done
  if (phase === 'done') {
    return (
      <div className="lazerclaw-intro intro-fadeout">
        <audio ref={lightningAudioRef} src="/lightning_strike_01.mp3" preload="auto" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`lazerclaw-intro ${shaking ? 'intro-shake' : ''}`}
    >
      {/* Lightning strike sound effect */}
      <audio ref={lightningAudioRef} src="/lightning_strike_01.mp3" preload="auto" />

      {/* Background energy gradient */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.3) 0%, transparent 70%)',
        }}
      />

      {/* Canvas lightning storm - reference style from lazerclaw_lightning_overlay.html */}
      <LightningStorm active={stormActive} intensity={stormIntensity} />

      {/* Lightning flash overlay */}
      {flashKey > 0 && (
        <div key={flashKey} className="lightning-flash" />
      )}

      {/* Energy rings */}
      {rings.map(ring => (
        <div
          key={ring.id}
          className="energy-ring"
          style={{
            left: `${ring.x}%`,
            top: `${ring.y}%`,
            width: 100,
            height: 100,
            marginLeft: -50,
            marginTop: -50,
          }}
        />
      ))}

      {/* Particles */}
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180
        const px = Math.cos(rad) * p.distance
        const py = Math.sin(rad) * p.distance
        return (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: '50%',
              top: '50%',
              width: p.size,
              height: p.size,
              background: `linear-gradient(135deg, #8b5cf6, #06b6d4)`,
              boxShadow: `0 0 ${p.size * 2}px #8b5cf6`,
              '--px': `${px}px`,
              '--py': `${py}px`,
              animation: `particleScatter ${p.duration}s ease-out forwards`,
            }}
          />
        )
      })}

      {/* No logo in intro — the welcome page logo is revealed when the storm fades */}
    </div>
  )
}

// Helper function for async delays
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
