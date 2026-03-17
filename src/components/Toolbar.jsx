import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Textbox, Group, FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import DownloadButton from './DownloadButton'
import ColorPicker from './ColorPicker'
import { ActiveSelection } from 'fabric'
import { applyTiling, removeTiling, removeOrphanedTileClones } from '../utils/tiling'
import { PEN_SUB_TOOLS } from '../utils/penTool'

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
        const intensity = 1.0

        // Pass 1 – outer glow
        ctx.shadowColor = `rgba(100,160,255,${intensity})`
        ctx.shadowBlur = 35
        ctx.strokeStyle = `rgba(60,100,220,${intensity * 0.35})`
        ctx.lineWidth = 10
        ctx.beginPath()
        ctx.moveTo(bolt[0].x, bolt[0].y)
        for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i].x, bolt[i].y)
        ctx.stroke()

        // Pass 2 – mid core
        ctx.shadowColor = `rgba(130,190,255,${intensity})`
        ctx.shadowBlur = 20
        ctx.strokeStyle = `rgba(100,170,255,${intensity * 0.7})`
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(bolt[0].x, bolt[0].y)
        for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i].x, bolt[i].y)
        ctx.stroke()

        // Pass 3 – bright core
        ctx.shadowColor = `rgba(200,225,255,${intensity})`
        ctx.shadowBlur = 8
        ctx.strokeStyle = `rgba(230,240,255,${intensity})`
        ctx.lineWidth = 1.5
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

          const alpha = bolt.life
          ctx.shadowColor = `rgba(100,180,255,${alpha})`
          ctx.shadowBlur = 12
          ctx.strokeStyle = `rgba(150,200,255,${alpha * 0.6})`
          ctx.lineWidth = 2
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
          ctx.shadowBlur = 4
          ctx.strokeStyle = `rgba(220,240,255,${alpha * 0.8})`
          ctx.lineWidth = 0.8
          ctx.stroke()

          return true
        })
      }

      // Glow at mouth
      const glowGrad = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, 12)
      glowGrad.addColorStop(0, 'rgba(100,160,255,0.4)')
      glowGrad.addColorStop(0.5, 'rgba(130,190,255,0.2)')
      glowGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(mouthX, mouthY, 12, 0, Math.PI * 2)
      ctx.fill()

      // Glow at tip
      const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8)
      tipGrad.addColorStop(0, 'rgba(200,225,255,0.6)')
      tipGrad.addColorStop(0.5, 'rgba(100,160,255,0.3)')
      tipGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = tipGrad
      ctx.beginPath()
      ctx.arc(tipX, tipY, 8, 0, Math.PI * 2)
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

const ToolBtn = ({ children, onClick, disabled, active, title, style, dm = true }) => (
  <button
    className={`tb-btn flex flex-col items-center justify-center px-3 py-1 rounded text-xs gap-0.5 transition-colors
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

function ToolDropdown({ label, icon, children, dm, iconOnly }) {
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
        className={`tb-btn flex flex-col items-center justify-center ${iconOnly ? 'px-1.5 w-8' : 'px-2'} py-1 rounded text-xs gap-0.5 transition-colors cursor-pointer
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
          className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl border z-50 py-1 min-w-[160px] ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
          onClick={(e) => { if (e.target.closest('[data-drop-item]')) setOpen(false) }}
        >
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

function AlignPanel({ canvasState }) {
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
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-3 w-56 border ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
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

function TilePanel({ canvasState }) {
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
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-3 w-auto ${
          dm ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
        }`}>
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

const BRUSH_SHAPES = [
  { id: 'circle', label: 'Circle', icon: () => <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="currentColor"/></svg> },
  { id: 'square', label: 'Square', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" fill="currentColor" transform={`rotate(${-angle} 7 7)`}/></svg> },
  { id: 'diamond', label: 'Diamond', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,7 7,13 1,7" fill="currentColor" transform={`rotate(${-angle} 7 7)`}/></svg> },
  { id: 'wedge', label: 'Wedge', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><ellipse cx="7" cy="7" rx="6" ry="2" transform={`rotate(${-angle} 7 7)`} fill="currentColor"/></svg> },
]

function BlobBrushSettings({ canvasState }) {
  const {
    activeTool, setActiveTool,
    blobBrushSize, setBlobBrushSize,
    blobBrushColor, setBlobBrushColor,
    blobBrushShape, setBlobBrushShape,
    blobBrushAngle, setBlobBrushAngle,
    darkMode,
  } = canvasState
  const dm = !!darkMode
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const isActive = activeTool === 'blobBrush'

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative flex items-center" ref={panelRef}>
      <ToolBtn
        dm={dm}
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
      {isActive && (
        <button
          className={`ml-0.5 px-1 py-1 rounded transition-colors ${dm ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          onClick={() => setOpen(v => !v)}
          title="Brush Settings"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
        </button>
      )}
      {open && (
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-3 w-56 border ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
          <div className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Brush Settings</div>
          <div className="space-y-3">
            <div>
              <span className={`text-xs block mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Tip Shape</span>
              <div className="flex gap-1">
                {BRUSH_SHAPES.map(s => (
                  <button
                    key={s.id}
                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                      blobBrushShape === s.id
                        ? (dm ? 'bg-gray-600 text-white' : 'bg-gray-700 text-white')
                        : (dm ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600')
                    }`}
                    onClick={() => setBlobBrushShape(s.id)}
                    title={s.label}
                  >{s.icon(blobBrushAngle)}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Size</span>
                <span className={`text-xs tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{blobBrushSize}px</span>
              </div>
              <input
                type="range" min="4" max="100" value={blobBrushSize}
                onChange={(e) => setBlobBrushSize(Number(e.target.value))}
                className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${dm ? 'bg-gray-600 accent-blue-400' : 'bg-gray-200 accent-gray-600'}`}
              />
            </div>
            {blobBrushShape !== 'circle' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Angle</span>
                  <span className={`text-xs tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{blobBrushAngle}°</span>
                </div>
                <input
                  type="range" min="0" max="180" value={blobBrushAngle}
                  onChange={(e) => setBlobBrushAngle(Number(e.target.value))}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${dm ? 'bg-gray-600 accent-blue-400' : 'bg-gray-200 accent-gray-600'}`}
                />
              </div>
            )}
            <div>
              <span className={`text-xs block mb-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>Color</span>
              <ColorPicker
                value={blobBrushColor}
                onChange={setBlobBrushColor}
              />
            </div>
          </div>
        </div>
      )}
    </div>
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
  { id: '5x7',   label: '5 × 7',    wPx: 1500, hPx: 2100, unit: 'in', dpi: 300, desc: 'Portrait',        sizeHint: '5×7 in' },
  { id: '7x5',   label: '7 × 5',    wPx: 2100, hPx: 1500, unit: 'in', dpi: 300, desc: 'Landscape',       sizeHint: '7×5 in' },
  { id: '1x1',   label: '1 : 1',    wPx: 2160, hPx: 2160, unit: 'px', dpi: 72,  desc: 'Square',          sizeHint: '2160×2160' },
  { id: '9x16',  label: '9 : 16',   wPx: 2160, hPx: 3840, unit: 'px', dpi: 72,  desc: 'Story / Reel 4K', sizeHint: '2160×3840' },
  { id: '16x9',  label: '16 : 9',   wPx: 3840, hPx: 2160, unit: 'px', dpi: 72,  desc: 'Widescreen 4K',   sizeHint: '3840×2160' },
  { id: '4x5',   label: '4 : 5',    wPx: 2160, hPx: 2700, unit: 'px', dpi: 72,  desc: 'Instagram Post',  sizeHint: '2160×2700' },
  { id: '4x6',   label: '4 × 6',    wPx: 1200, hPx: 1800, unit: 'in', dpi: 300, desc: 'Photo',           sizeHint: '4×6 in' },
  { id: '6x4',   label: '6 × 4',    wPx: 1800, hPx: 1200, unit: 'in', dpi: 300, desc: 'Photo Landscape', sizeHint: '6×4 in' },
  { id: '3x2',   label: '3 : 2',    wPx: 1800, hPx: 1200, unit: 'in', dpi: 300, desc: 'Classic',         sizeHint: '6×4 in' },
  { id: '2x3',   label: '2 : 3',    wPx: 1200, hPx: 1800, unit: 'in', dpi: 300, desc: 'Classic Portrait', sizeHint: '4×6 in' },
  { id: '11x14', label: '11 × 14',  wPx: 3300, hPx: 4200, unit: 'in', dpi: 300, desc: 'Print',           sizeHint: '11×14 in' },
  { id: 'letter',label: 'Letter',   wPx: 2550, hPx: 3300, unit: 'in', dpi: 300, desc: '8.5×11 in',       sizeHint: '8.5×11 in' },
  { id: 'a4',    label: 'A4',       wPx: 2480, hPx: 3508, unit: 'mm', dpi: 300, desc: '210×297 mm',      sizeHint: '210×297 mm' },
]

function CanvasSizePicker({ canvasState }) {
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
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
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
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 w-72 max-h-[80vh] overflow-y-auto border ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
          <div className={`px-3 py-2 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Units &amp; Resolution</div>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`flex-1 border rounded px-2 py-1 text-xs focus:border-blue-400 outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
              >
                {UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.label} ({u.abbr})</option>
                ))}
              </select>
              <select
                value={dpi}
                onChange={(e) => setDpi(parseInt(e.target.value))}
                className={`w-[72px] border rounded px-1.5 py-1 text-xs focus:border-blue-400 outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
              >
                {DPI_OPTIONS.map(d => (
                  <option key={d} value={d}>{d} DPI</option>
                ))}
              </select>
            </div>

            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Custom Size</div>
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
                    className={`w-full border rounded px-2 py-1 text-xs tabular-nums focus:border-blue-400 outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
                  />
                  <span className={`text-[10px] shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
                </div>
              </div>
              <div className={`mt-3.5 ${dm ? 'text-gray-500' : 'text-gray-300'}`}>×</div>
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
                    className={`w-full border rounded px-2 py-1 text-xs tabular-nums focus:border-blue-400 outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
                  />
                  <span className={`text-[10px] shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{unitAbbr}</span>
                </div>
              </div>
            </div>
            <button
              onClick={applyCustom}
              className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${dm ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              Apply Size
            </button>
            <div className={`text-[9px] mt-1 text-center ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {Math.round(unitToPx(parseFloat(customW) || 0, unit, dpi))} × {Math.round(unitToPx(parseFloat(customH) || 0, unit, dpi))} px
            </div>
          </div>

          <div className="py-1">
            <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Presets</div>
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
                      ? (dm ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700')
                      : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  <div className="w-7 h-7 flex items-center justify-center shrink-0">
                    <div
                      className={`border-2 rounded-[2px] ${isActive ? (dm ? 'border-blue-400 bg-blue-900/50' : 'border-blue-500 bg-blue-100') : (dm ? 'border-gray-500 bg-gray-700' : 'border-gray-300 bg-gray-50')}`}
                      style={{ width: thumbW, height: thumbH }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className="text-[10px] text-gray-400">{preset.desc} · {sizeLabel}</div>
                  </div>
                  {isActive && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-blue-500 shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PrinterMarksPanel({ canvasState }) {
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
        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 w-80 max-h-[80vh] overflow-y-auto ${
          dm ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
        }`}>
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

function AiToolsDropdown({ canvasState, dm }) {
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

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const { generateImage } = await import('../utils/aiImageApi')
      const data = await generateImage({ prompt: prompt.trim() })
      const url = data.urls?.[0]
      if (url) {
        const canvas = canvasState?.canvasRef?.current
        if (canvas) {
          const { FabricImage } = await import('fabric')
          const { v4: uuidv4 } = await import('uuid')
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
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
          img.src = url
        }
        setPrompt('')
        setOpen(false)
      }
    } catch (err) {
      console.error('AI image gen failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative mr-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded text-xs font-bold transition-all hover:scale-105 shrink-0"
        style={{
          background: dm ? 'rgba(40,45,60,0.8)' : '#f1f5f9',
          border: dm ? '1px solid rgba(100,160,255,0.3)' : '1px solid #cbd5e1',
          color: dm ? '#8bb8ff' : '#2563eb',
        }}
        title="AI Tools"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="ai-tools-label">AI Tools</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-80 rounded-lg shadow-2xl z-50 p-3 flex flex-col gap-2"
          style={{
            background: dm ? '#1a1a2e' : '#ffffff',
            border: dm ? '1px solid rgba(100,160,255,0.3)' : '1px solid #e2e8f0',
          }}
        >
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
  } = canvasState

  const toolbarRef = useRef(null)
  const logoImgRef = useRef(null)
  const logoShimmerRef = useRef(null)
  const logoShimmer2Ref = useRef(null)
  const [logoDims, setLogoDims] = useState({ w: 0, h: 0 })
  const [collapse, setCollapse] = useState(0)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const musicRef = useRef(null)

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

  // Condense earlier so nav never overflows off the right edge
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      if (w >= 1280) setCollapse(0)
      else if (w >= 920) setCollapse(1)
      else if (w >= 600) setCollapse(2)
      else setCollapse(3)
    })
    ro.observe(el)
    return () => ro.disconnect()
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
        sweepEl(el, 50 + Math.random() * 30, 0.3 + Math.random() * 0.12)
        if (el2 && Math.random() < 0.3) {
          setTimeout(() => sweepEl(el2, 25 + Math.random() * 25, 0.25 + Math.random() * 0.1), 50 + Math.random() * 100)
        }
      }
      timer = setTimeout(triggerShimmer, 4000 + Math.random() * 8000)
    }
    timer = setTimeout(triggerShimmer, 2000 + Math.random() * 3000)
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
  const hasPlayable = canvas && canvas.getObjects().some(o => o._dtoolAnimated || o._dtoolMotionFill)
  const hasAudio = (canvasState.audioTracks || []).length > 0
  const hasContent = hasPlayable || hasAudio

  const playBtn = !hasContent ? (
    <ToolBtn dm={dm} active={false} title="No playable content" style={{ opacity: 0.4, pointerEvents: 'none' }}>{ic.play}<span>Play</span></ToolBtn>
  ) : (
    <ToolBtn dm={dm} onClick={() => setAutoplay(v => !v)} active={autoplay} title={autoplay ? 'Pause' : 'Play'}>
      {autoplay ? ic.play : ic.pause}<span>{autoplay ? 'Playing' : 'Paused'}</span>
    </ToolBtn>
  )

  const playDrop = !hasContent ? (
    <DropItem icon={ic.play} label="Play" disabled dm={dm} />
  ) : (
    <DropItem icon={autoplay ? ic.play : ic.pause} label={autoplay ? 'Pause' : 'Play'} onClick={() => setAutoplay(v => !v)} dm={dm} />
  )

  return (
    <div ref={toolbarRef} className={`relative z-20 h-[66px] border-b flex items-center px-2 pr-2 shrink-0 min-w-0 ${dm ? 'galaxy-header' : ''} ${collapse >= 1 ? 'tb-compact' : ''}`}
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

      {/* Left/center group — shrinkable, clips overflow */}
      <div className="flex items-center gap-1 overflow-hidden" style={{ flex: '1 1 0%', minWidth: 0 }}>

      {/* Logo with lightning + shimmer — always visible */}
      <div className="flex items-center gap-1.5 px-1 shrink-0 relative">
        <div className="relative" style={{ height: collapse >= 2 ? 44 : collapse >= 1 ? 51 : 53 }}>
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
                  background: 'linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,255,255,0.15) 38%, rgba(255,255,255,0.35) 44%, rgba(255,255,255,0.8) 48%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.8) 52%, rgba(255,255,255,0.35) 56%, rgba(255,255,255,0.15) 62%, transparent 70%, transparent 100%)',
                  transform: 'skewX(-15deg)', opacity: 0, filter: 'blur(1.5px)',
                }}
              />
              <div
                ref={logoShimmer2Ref}
                className="absolute pointer-events-none"
                style={{
                  top: '-20%', left: '-120%', width: '35%', height: '140%',
                  background: 'linear-gradient(105deg, transparent 0%, transparent 30%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0.28) 44%, rgba(255,255,255,0.65) 48%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.65) 52%, rgba(255,255,255,0.28) 56%, rgba(255,255,255,0.12) 62%, transparent 70%, transparent 100%)',
                  transform: 'skewX(-15deg)', opacity: 0, filter: 'blur(1.5px)',
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
        {collapse < 3 && <span>Undo</span>}
      </ToolBtn>
      <ToolBtn dm={dm} onClick={redo} disabled={redoStackRef.current.length === 0} title="Redo (Ctrl+Y)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H8a4 4 0 000 8h9"/><path d="M21 10l-4-4M21 10l-4 4"/></svg>
        {collapse < 3 && <span>Redo</span>}
      </ToolBtn>

      {/* ── Level 0: everything expanded ── */}
      {collapse === 0 && (
        <>
          <Div />
          <ToolBtn dm={dm} onClick={copySelected} disabled={!hasSelection} title="Copy (Ctrl+C)">{ic.copy}<span>Copy</span></ToolBtn>
          <ToolBtn dm={dm} onClick={pasteFromClipboard} title="Paste (Ctrl+V)">{ic.paste}<span>Paste</span></ToolBtn>
          <ToolBtn dm={dm} onClick={duplicateSelected} disabled={!hasSelection} title="Duplicate (Ctrl+D)">{ic.dup}<span>Duplicate</span></ToolBtn>
          <Div />
          <ToolDropdown label="Arrange" icon={ic.arrange} dm={dm}>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>
          <AlignPanel canvasState={canvasState} />
          <TilePanel canvasState={canvasState} />
          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />
          <Div />
          <ToolBtn dm={dm} onClick={handleAddText} title="Add Text Box">{ic.text}<span>Text</span></ToolBtn>
          <ToolBtn dm={dm} onClick={deleteSelected} disabled={!hasSelection} title="Delete (Del)">{ic.del}<span>Delete</span></ToolBtn>
          <Div />
          <CanvasSizePicker canvasState={canvasState} />
          <PrinterMarksPanel canvasState={canvasState} />
          <Div />
          {playBtn}
        </>
      )}

      {/* ── Level 1: grouped dropdowns, icon-only buttons ── */}
      {collapse === 1 && (
        <>
          <Div />
          <ToolDropdown label="Edit" icon={ic.edit} dm={dm}>
            <DropItem icon={ic.copy} label="Copy" onClick={copySelected} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.paste} label="Paste" onClick={pasteFromClipboard} dm={dm} />
            <DropItem icon={ic.dup} label="Duplicate" onClick={duplicateSelected} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.text} label="Add Text" onClick={handleAddText} dm={dm} />
            <DropItem icon={ic.del} label="Delete" onClick={deleteSelected} disabled={!hasSelection} dm={dm} />
          </ToolDropdown>

          <ToolDropdown label="Arrange" icon={ic.arrange} dm={dm}>
            <DropItem icon={ic.fwd} label="Bring Forward" onClick={bringForward} disabled={!hasSelection} dm={dm} />
            <DropItem icon={ic.bwd} label="Send Backward" onClick={sendBackward} disabled={!hasSelection} dm={dm} />
            <DropSep dm={dm} />
            <DropItem icon={ic.grp} label="Group" onClick={groupSelected} disabled={!isMultiSelection} dm={dm} />
            <DropItem icon={ic.ungrp} label="Ungroup" onClick={ungroupSelected} disabled={!isGroup} dm={dm} />
            <DropItem icon={ic.mask} label="Mask" onClick={canvasState.createMask} disabled={!canMask} dm={dm} />
          </ToolDropdown>

          <AlignPanel canvasState={canvasState} />
          <TilePanel canvasState={canvasState} />

          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />

          <Div />
          <ToolDropdown label="Canvas" icon={ic.canvas} dm={dm}>
            {playDrop}
          </ToolDropdown>
          <CanvasSizePicker canvasState={canvasState} />
          <PrinterMarksPanel canvasState={canvasState} />
        </>
      )}

      {/* ── Level 2: single "More" dropdown ── */}
      {collapse === 2 && (
        <>
          <Div />
          <ToolBtn dm={dm} onClick={() => setActiveTool('select')} active={activeTool === 'select'} title="Select Tool (V)">{ic.select}<span>Select</span></ToolBtn>
          <BlobBrushSettings canvasState={canvasState} />
          <PenToolSettings canvasState={canvasState} />

          <Div />
          <ToolDropdown label="More" icon={ic.more} dm={dm}>
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
            <DropSep dm={dm} />
            <DropLabel dm={dm}>Canvas</DropLabel>
            {playDrop}
          </ToolDropdown>
          <CanvasSizePicker canvasState={canvasState} />
        </>
      )}

      {/* ── Level 3: ultra-compact — everything in one "Tools" dropdown ── */}
      {collapse >= 3 && (
        <>
          <Div />
          <ToolDropdown label="Tools" icon={ic.more} dm={dm} iconOnly>
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
            <DropSep dm={dm} />
            <DropLabel dm={dm}>Canvas</DropLabel>
            {playDrop}
          </ToolDropdown>
        </>
      )}

      {/* Music / Theme Song button - mysterious and enticing */}
      {collapse < 3 && <Div />}
      <button
        onClick={toggleMusic}
        className={`${collapse >= 3 ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center rounded-xl transition-all shrink-0 relative ${musicPlaying ? 'music-mystery' : 'hover:music-mystery'}`}
        title={musicPlaying ? 'Pause Theme Song' : '✨ Play Theme Song ✨'}
        style={{
          background: musicPlaying
            ? 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(168,85,247,0.5) 50%, rgba(139,92,246,0.4) 100%)'
            : dm
              ? 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(168,85,247,0.2) 50%, rgba(139,92,246,0.15) 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(168,85,247,0.12) 50%, rgba(139,92,246,0.08) 100%)',
          border: dm ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(168,85,247,0.3)',
          boxShadow: musicPlaying
            ? '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(139,92,246,0.3), inset 0 0 12px rgba(168,85,247,0.3)'
            : dm
              ? '0 0 10px rgba(168,85,247,0.2), inset 0 0 5px rgba(139,92,246,0.1)'
              : '0 1px 3px rgba(0,0,0,0.1)',
          color: musicPlaying ? '#e9d5ff' : dm ? '#c4b5fd' : '#7c3aed',
        }}
      >
        {/* Mysterious swirl icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {musicPlaying ? (
            <>
              {/* Animated sound waves when playing */}
              <path d="M12 3v18" strokeWidth="2" />
              <path d="M8 8v8" strokeWidth="2" />
              <path d="M16 8v8" strokeWidth="2" />
              <path d="M4 10v4" strokeWidth="2" />
              <path d="M20 10v4" strokeWidth="2" />
            </>
          ) : (
            <>
              {/* Mysterious crystal/gem with sparkle */}
              <path d="M12 2l3 7h-6l3-7z" fill="currentColor" fillOpacity="0.3" />
              <path d="M9 9l3 13 3-13" />
              <path d="M6 9h12" />
              <circle cx="17" cy="5" r="1" fill="currentColor" />
              <circle cx="7" cy="7" r="0.5" fill="currentColor" />
              <path d="M19 8l1-1M20 11h1" strokeWidth="1" />
            </>
          )}
        </svg>
        {/* Glowing indicator */}
        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{
          background: musicPlaying
            ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
            : 'linear-gradient(135deg, #6b21a8 0%, #581c87 100%)',
          boxShadow: musicPlaying
            ? '0 0 12px rgba(168,85,247,0.9), 0 0 24px rgba(139,92,246,0.6)'
            : '0 0 6px rgba(168,85,247,0.4)',
          border: '1px solid rgba(233,213,255,0.3)',
        }}>
          {musicPlaying ? (
            <svg width="7" height="7" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="7" height="7" viewBox="0 0 24 24" fill="white">
              <polygon points="6,4 18,12 6,20" />
            </svg>
          )}
        </div>
      </button>

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
        onClick={() => setShowLogoutConfirm(true)}
        className={`${collapse >= 3 ? 'px-2 w-9' : collapse >= 1 ? 'px-2.5' : 'px-5'} py-2 rounded text-sm font-bold transition-all shrink-0 flex items-center justify-center gap-2 ${collapse >= 1 ? 'ml-1' : 'ml-3'} relative overflow-hidden hover:scale-105`}
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
        {collapse < 3 && <span className="logout-label" style={{ position: 'relative', zIndex: 1 }}>Logout</span>}
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
                Heads up, shredder!
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-relaxed" style={{ color: dm ? '#94a3b8' : '#475569' }}>
                Your current session will be cleared and any unsaved designs will vanish into the void.
              </p>
              <p className="text-xs mt-3 font-medium" style={{ color: dm ? '#f59e0b' : '#d97706' }}>
                Download anything you wanna keep before you bail.
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
                Cancel
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
                Peace Out
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
