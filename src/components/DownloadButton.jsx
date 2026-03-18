import React, { useState, useRef, useEffect } from 'react'
import { exportDesignZip } from '../utils/zipExport'
import { jsPDF } from 'jspdf'
import { exportMp4 } from '../utils/mp4Export'

function drawPrintMarks(ctx, px, py, pw, ph, pm) {
  const bTop = pm.bleedTop || 0
  const bRight = pm.bleedRight || 0
  const bBottom = pm.bleedBottom || 0
  const bLeft = pm.bleedLeft || 0
  const markLen = 20
  const markOff = 6
  const thinLine = 0.75

  if (pm.bleedLine) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.8)'
    ctx.lineWidth = thinLine
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.rect(px - bLeft, py - bTop, pw + bLeft + bRight, ph + bTop + bBottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  if (pm.cutLine) {
    ctx.save()
    ctx.strokeStyle = 'rgba(0, 200, 80, 0.8)'
    ctx.lineWidth = thinLine
    ctx.setLineDash([4, 3])
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
    ctx.setLineDash([])
    ctx.restore()
  }

  if (pm.cropMarks) {
    ctx.save()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = thinLine
    ctx.setLineDash([])
    const corners = [
      [px, py],
      [px + pw, py],
      [px, py + ph],
      [px + pw, py + ph],
    ]
    corners.forEach(([cx, cy]) => {
      const sx = cx === px ? -1 : 1
      const sy = cy === py ? -1 : 1
      ctx.beginPath()
      ctx.moveTo(cx + sx * markOff, cy)
      ctx.lineTo(cx + sx * (markOff + markLen), cy)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy + sy * markOff)
      ctx.lineTo(cx, cy + sy * (markOff + markLen))
      ctx.stroke()
    })
    ctx.restore()
  }

  if (pm.registrationMarks) {
    ctx.save()
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = '#000000'
    ctx.lineWidth = thinLine
    ctx.setLineDash([])
    const rr = 5
    const regOff = markOff + markLen + 10
    const regPositions = [
      [px + pw / 2, py - regOff],
      [px + pw / 2, py + ph + regOff],
      [px - regOff, py + ph / 2],
      [px + pw + regOff, py + ph / 2],
    ]
    regPositions.forEach(([rx, ry]) => {
      ctx.beginPath()
      ctx.arc(rx, ry, rr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(rx - rr - 2, ry)
      ctx.lineTo(rx + rr + 2, ry)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(rx, ry - rr - 2)
      ctx.lineTo(rx, ry + rr + 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(rx, ry, 1.5, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.restore()
  }

  if (pm.colorBars) {
    ctx.save()
    const barH = 8
    const barW = 14
    const gap = 2
    const cmykColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#000000']
    const grays = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000']
    const allColors = [...cmykColors, ...grays]
    const totalBarW = allColors.length * (barW + gap) - gap
    const startX = px + (pw - totalBarW) / 2
    const barY = py + ph + markOff + 2
    allColors.forEach((color, i) => {
      ctx.fillStyle = color
      ctx.fillRect(startX + i * (barW + gap), barY, barW, barH)
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(startX + i * (barW + gap), barY, barW, barH)
    })
    ctx.restore()
  }
}

async function exportPng(canvasState) {
  const canvas = canvasState.canvasRef.current
  if (!canvas) throw new Error('No canvas')
  const cW = canvasState.canvasW
  const cH = canvasState.canvasH

  const active = canvas.getActiveObject()
  if (active) canvas.discardActiveObject()

  const overlayVis = canvas.overlayImage?.visible
  if (canvas.overlayImage) canvas.overlayImage.visible = false

  const savedVpt = [...canvas.viewportTransform]
  const savedW = canvas.width
  const savedH = canvas.height

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.setDimensions({ width: cW, height: cH })
  canvas._dtoolExporting = true
  canvas.renderAll()

  let dataUrl
  try {
    dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 })
  } finally {
    canvas._dtoolExporting = false
    canvas.setViewportTransform(savedVpt)
    canvas.setDimensions({ width: savedW, height: savedH })
    if (canvas.overlayImage) canvas.overlayImage.visible = overlayVis
    if (active) canvas.setActiveObject(active)
    canvas.renderAll()
  }

  const link = document.createElement('a')
  link.download = 'design.png'
  link.href = dataUrl
  link.click()
}

async function exportPdf(canvasState) {
  const canvas = canvasState.canvasRef.current
  if (!canvas) throw new Error('No canvas')
  const cW = canvasState.canvasW
  const cH = canvasState.canvasH
  const pm = canvasState.printerMarks || {}

  const active = canvas.getActiveObject()
  if (active) canvas.discardActiveObject()

  const overlayVis = canvas.overlayImage?.visible
  if (canvas.overlayImage) canvas.overlayImage.visible = false

  const savedVpt = [...canvas.viewportTransform]
  const savedW = canvas.width
  const savedH = canvas.height

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.setDimensions({ width: cW, height: cH })
  canvas._dtoolExporting = true
  canvas.renderAll()

  const multiplier = 2
  let artboardUrl
  try {
    artboardUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
    })
  } finally {
    canvas._dtoolExporting = false
    canvas.setViewportTransform(savedVpt)
    canvas.setDimensions({ width: savedW, height: savedH })
    if (canvas.overlayImage) canvas.overlayImage.visible = overlayVis
    if (active) canvas.setActiveObject(active)
    canvas.renderAll()
  }

  const hasPrintMarks = pm.cropMarks || pm.registrationMarks || pm.colorBars || pm.bleedLine || pm.cutLine

  if (hasPrintMarks) {
    const pad = 50
    const exportW = cW + 2 * pad
    const exportH = cH + 2 * pad

    const offscreen = document.createElement('canvas')
    offscreen.width = exportW * multiplier
    offscreen.height = exportH * multiplier
    const ctx = offscreen.getContext('2d')
    ctx.scale(multiplier, multiplier)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportW, exportH)

    const img = await new Promise((resolve) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.src = artboardUrl
    })
    ctx.drawImage(img, 0, 0, cW * multiplier, cH * multiplier, pad, pad, cW, cH)

    drawPrintMarks(ctx, pad, pad, cW, cH, pm)

    const finalUrl = offscreen.toDataURL('image/png', 1)
    const isLandscape = exportW > exportH
    const orientation = isLandscape ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [exportW, exportH] })
    pdf.addImage(finalUrl, 'PNG', 0, 0, exportW, exportH)
    pdf.save('design.pdf')
  } else {
    const isLandscape = cW > cH
    const orientation = isLandscape ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [cW, cH] })
    pdf.addImage(artboardUrl, 'PNG', 0, 0, cW, cH)
    pdf.save('design.pdf')
  }
}

// ─── METAL RATING SYSTEM ─────────────────────────────────────────────────────
// Rate designs on how "metal" they are from 1-5 heavy metal hands
const METAL_RATING_PROMPT = `You are a heavy metal design critic. Analyze this design and rate it on how METAL it is.

RATING CRITERIA (each category 0-20 points, total 100):

1. **DARKNESS & INTENSITY** (0-20)
   - Dark color palettes, blacks, deep reds, purples
   - High contrast, dramatic lighting
   - Ominous or powerful mood

2. **METAL IMAGERY** (0-20)
   - Skulls, flames, lightning, dragons, demons
   - Band logo aesthetics, gothic typography
   - Chains, spikes, leather, metal textures

3. **AGGRESSION & ENERGY** (0-20)
   - Sharp angles, jagged edges
   - Explosive compositions, dynamic movement
   - Intensity of visual impact

4. **GENRE AUTHENTICITY** (0-20)
   - Classic Metal: Iron Maiden, Judas Priest vibes
   - Thrash: Slayer, Metallica, Megadeth energy
   - Death Metal: Brutal, gory, intense
   - Black Metal: Cold, atmospheric, evil
   - Nu-Metal: Modern, industrial, aggressive

5. **OVERALL BRUTALITY** (0-20)
   - Would this design melt faces?
   - Would it work as album art?
   - Does it capture the spirit of metal?

Respond with JSON only:
{
  "score": <total 0-100>,
  "hands": <1-5 based on score: 0-20=1, 21-40=2, 41-60=3, 61-80=4, 81-100=5>,
  "genre": "<best matching metal genre>",
  "verdict": "<one brutal sentence verdict>",
  "improvements": "<how to make it more metal>"
}`

function MetalRatingModal({ rating, onClose, dm }) {
  if (!rating) return null

  const hands = '🤘'.repeat(rating.hands)
  const emptyHands = '✋'.repeat(5 - rating.hands)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100000]"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-md mx-4"
        style={{
          background: dm ? 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)' : 'linear-gradient(135deg, #1f1f1f 0%, #0a0a0a 100%)',
          border: '2px solid rgba(180, 0, 0, 0.5)',
          boxShadow: '0 0 40px rgba(180, 0, 0, 0.3), inset 0 0 20px rgba(180, 0, 0, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          className="text-2xl font-black text-center mb-2"
          style={{
            background: 'linear-gradient(180deg, #ff4444 0%, #aa0000 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 20px rgba(180,0,0,0.5)',
            letterSpacing: '0.1em',
          }}
        >
          METAL RATING
        </h2>

        <div className="text-center text-4xl my-4" style={{ letterSpacing: '0.2em' }}>
          {hands}{emptyHands}
        </div>

        <div
          className="text-center text-5xl font-black mb-2"
          style={{ color: '#ff4444', textShadow: '0 0 20px rgba(255,0,0,0.5)' }}
        >
          {rating.score}/100
        </div>

        <div
          className="text-center text-sm font-bold mb-4"
          style={{ color: '#888', letterSpacing: '0.15em' }}
        >
          {rating.genre?.toUpperCase()}
        </div>

        <p
          className="text-center text-lg font-bold mb-4"
          style={{ color: '#ddd', lineHeight: 1.4 }}
        >
          "{rating.verdict}"
        </p>

        <div
          className="text-center text-xs mb-4"
          style={{ color: '#888' }}
        >
          <span className="font-bold" style={{ color: '#aa0000' }}>TO MAKE IT MORE METAL:</span>
          <br />
          {rating.improvements}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #aa0000 0%, #660000 100%)',
            boxShadow: '0 4px 20px rgba(180,0,0,0.4)',
          }}
        >
          PROCEED TO DOWNLOAD
        </button>
      </div>
    </div>
  )
}

async function rateDesignMetal(canvasState) {
  const canvas = canvasState.canvasRef.current
  if (!canvas) return null

  // Take snapshot
  const active = canvas.getActiveObject()
  if (active) canvas.discardActiveObject()

  const overlayVis = canvas.overlayImage?.visible
  if (canvas.overlayImage) canvas.overlayImage.visible = false

  const savedVpt = [...canvas.viewportTransform]
  const savedW = canvas.width
  const savedH = canvas.height
  const cW = canvasState.canvasW
  const cH = canvasState.canvasH

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.setDimensions({ width: cW, height: cH })
  canvas._dtoolExporting = true
  canvas.renderAll()

  const dataUrl = canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 0.5 })

  canvas._dtoolExporting = false
  canvas.setViewportTransform(savedVpt)
  canvas.setDimensions({ width: savedW, height: savedH })
  if (canvas.overlayImage) canvas.overlayImage.visible = overlayVis
  if (active) canvas.setActiveObject(active)
  canvas.renderAll()

  // Call API for rating
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: METAL_RATING_PROMPT,
        messages: [{ role: 'user', content: 'Rate this design on how METAL it is.' }],
        snapshot: dataUrl,
      }),
    })

    if (!res.ok) throw new Error('Rating failed')

    const data = await res.json()
    const text = data.content?.[0]?.text || data.text || ''

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.error('Metal rating error:', err)
  }

  // Fallback rating
  return {
    score: 50,
    hands: 3,
    genre: 'Classic Rock',
    verdict: 'Decent, but needs more METAL!',
    improvements: 'Add some fire, skulls, or lightning!',
  }
}

export default function DownloadButton({ canvasState, collapse = 0 }) {
  const dm = !!canvasState?.darkMode
  const [loading, setLoading] = useState(false)
  const [pngLoading, setPngLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [mp4Loading, setMp4Loading] = useState(false)
  const [mp4Progress, setMp4Progress] = useState(0)
  const [open, setOpen] = useState(false)
  const [metalRating, setMetalRating] = useState(null)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [pendingExport, setPendingExport] = useState(null)
  const ref = useRef(null)

  const showMp4 = true

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Auto-close dropdown when toolbar collapses so expanded state cannot overlap
  useEffect(() => {
    setOpen(false)
  }, [collapse])

  const handleZip = async () => {
    setLoading(true)
    setOpen(false)
    try {
      await exportDesignZip(canvasState)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Rate design first, then export
  const rateAndExport = async (exportType) => {
    setOpen(false)
    setRatingLoading(true)
    setPendingExport(exportType)

    try {
      const rating = await rateDesignMetal(canvasState)
      setMetalRating(rating)
    } catch (err) {
      console.error('Rating error:', err)
      // Proceed to export anyway
      doExport(exportType)
    } finally {
      setRatingLoading(false)
    }
  }

  const doExport = async (exportType) => {
    setMetalRating(null)
    setPendingExport(null)

    if (exportType === 'png') {
      setPngLoading(true)
      try {
        await exportPng(canvasState)
      } catch (err) {
        console.error('PNG export failed:', err)
        alert('PNG export failed: ' + err.message)
      } finally {
        setPngLoading(false)
      }
    } else if (exportType === 'pdf') {
      setPdfLoading(true)
      try {
        await exportPdf(canvasState)
      } catch (err) {
        console.error('PDF export failed:', err)
        alert('PDF export failed: ' + err.message)
      } finally {
        setPdfLoading(false)
      }
    } else if (exportType === 'mp4') {
      setMp4Loading(true)
      setMp4Progress(0)
      try {
        await exportMp4(canvasState, (pct) => setMp4Progress(pct))
      } catch (err) {
        console.error('MP4 export failed:', err)
        alert('MP4 export failed: ' + err.message)
      } finally {
        setMp4Loading(false)
        setMp4Progress(0)
      }
    }
  }

  const handleCloseRating = () => {
    const exportType = pendingExport
    setMetalRating(null)
    if (exportType) {
      doExport(exportType)
    }
  }

  const handlePng = () => rateAndExport('png')
  const handlePdf = () => rateAndExport('pdf')
  const handleMp4 = () => rateAndExport('mp4')

  const busy = loading || pngLoading || pdfLoading || mp4Loading || ratingLoading
  const statusText = ratingLoading
    ? 'Rating...'
    : loading
    ? 'Exporting...'
    : pngLoading
    ? 'Saving PNG...'
    : pdfLoading
    ? 'Generating PDF...'
    : mp4Loading
    ? `Recording ${mp4Progress}%`
    : 'Download'

  return (
    <>
      <MetalRatingModal rating={metalRating} onClose={handleCloseRating} dm={dm} />
      <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className={`
          relative flex items-center justify-center gap-2 ${collapse >= 3 ? 'px-2 w-9' : collapse >= 1 ? 'px-2.5' : 'px-5'} py-2 rounded text-sm font-black uppercase transition-all duration-200 overflow-visible shrink-0
          ${busy ? 'cursor-wait' : 'hover:scale-105 active:scale-[0.98]'}
        `}
        style={busy ? {
          background: dm ? '#374151' : '#d1d5db',
          color: dm ? '#9ca3af' : '#6b7280',
          border: '1px solid #666',
        } : {
          background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
          color: '#fff',
          border: '1px solid rgba(192,192,208,0.6)',
          boxShadow: '0 0 15px rgba(120,80,210,0.7), inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 3px rgba(0,0,0,0.4)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          letterSpacing: '2px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {collapse < 3 && <span className="download-label">{statusText}</span>}
        {collapse < 3 && mp4Loading && (
          <div className={`w-12 h-1.5 rounded-full overflow-hidden ${dm ? 'bg-gray-600' : 'bg-gray-400'}`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${dm ? 'bg-gray-300' : 'bg-white'}`}
              style={{ width: `${mp4Progress}%` }}
            />
          </div>
        )}
        {collapse < 3 && !mp4Loading && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
        {/* Capcom-style anime shimmer overlay */}
        {!busy && (
          <div className="chrome-shimmer-container">
            <div className="chrome-anime-shimmer" />
          </div>
        )}
      </button>

      {/* Chrome shimmer styles */}
      <style>{`
        /* Chrome shimmer container */
        .chrome-shimmer-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          border-radius: inherit;
          pointer-events: none;
        }
        /* Capcom-style diagonal shimmer sweep */
        .chrome-anime-shimmer {
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
            rgba(255,255,255,0.4) 48%,
            rgba(255,255,255,0.7) 50%,
            rgba(255,255,255,0.4) 52%,
            rgba(255,255,255,0.1) 60%,
            transparent 70%,
            transparent 100%
          );
          animation: chromeShimmerSweep 6s ease-in-out infinite;
          filter: blur(1px);
        }
        @keyframes chromeShimmerSweep {
          0% { left: -100%; opacity: 0; }
          75% { left: -100%; opacity: 0; }
          78% { opacity: 1; }
          88% { left: 200%; opacity: 1; }
          90% { left: 200%; opacity: 0; }
          100% { left: 200%; opacity: 0; }
        }
      `}</style>

      {open && (
        <div className={`absolute right-0 top-full mt-1 rounded-lg shadow-lg py-1 w-56 z-50 ${dm ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'}`}>
          <button
            onClick={handlePng}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Image (.png)
          </button>
          <button
            onClick={handlePdf}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 15h6" />
              <path d="M9 11h6" />
            </svg>
            PDF (.pdf)
          </button>
          <button
            onClick={handleMp4}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Flat Video (.mp4)
          </button>
        </div>
      )}
    </div>
    </>
  )
}
