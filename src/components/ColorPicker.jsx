import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Gradient, Pattern } from 'fabric'

export const COMMON_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#FF0000', '#FF6600', '#FFCC00', '#FFFF00', '#99CC00', '#00CC00',
  '#00CCCC', '#0066FF', '#0000FF', '#6600CC', '#CC00CC', '#FF0066',
  '#FFD4D4', '#FFE8CC', '#FFFACC', '#D4FFD4', '#CCF2FF', '#D4D4FF',
]

let _recentColors = []
export function addRecentColor(color) {
  if (!color || color === 'transparent') return
  const hex = color.toUpperCase()
  _recentColors = [hex, ..._recentColors.filter(c => c !== hex)].slice(0, 16)
}
export function getRecentColors() { return _recentColors }

let _recentImageFills = []
export function addRecentImageFill(dataUrl) {
  if (!dataUrl) return
  _recentImageFills = [dataUrl, ..._recentImageFills.filter(u => u !== dataUrl)].slice(0, 12)
}
export function getRecentImageFills() { return _recentImageFills }

export function hexToHsv(hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s, v }
}

export function hsvToHex(h, s, v) {
  h = ((h % 360) + 360) % 360
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  let r, g, b
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function hueToHex(h) { return hsvToHex(h, 1, 1) }

function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const CHECKER_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23ccc'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23ccc'/%3E%3Crect x='4' width='4' height='4' fill='%23fff'/%3E%3Crect y='4' width='4' height='4' fill='%23fff'/%3E%3C/svg%3E")`

const MiniSwatch = ({ color, active, onClick, isDark }) => (
  <button
    className={`w-[18px] h-[18px] rounded-sm border cursor-pointer shrink-0 ${active ? 'border-gray-500 ring-1 ring-gray-400' : `${isDark ? 'border-gray-600' : 'border-gray-200'} hover:border-gray-400`}`}
    style={{ backgroundColor: color }}
    onClick={onClick}
    title={color}
  />
)

const ANGLE_PRESETS = [0, 45, 90, 135, 180, 225, 270, 315]

function buildGradientCSS(stops, angle) {
  const parts = stops
    .sort((a, b) => a.offset - b.offset)
    .map(s => {
      const a = s.opacity ?? 1
      const color = s.color === 'transparent' ? `rgba(0,0,0,0)` : hexToRgba(s.color, a)
      return `${color} ${(s.offset * 100).toFixed(1)}%`
    })
  return `linear-gradient(${angle}deg, ${parts.join(', ')})`
}

function buildFabricGradient(stops, angle, width, height) {
  const rad = (angle - 90) * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const w = width || 100
  const h = height || 100

  const halfDiag = Math.sqrt(w * w + h * h) / 2
  const dx = cos * halfDiag
  const dy = sin * halfDiag

  const x1 = w / 2 - dx
  const y1 = h / 2 - dy
  const x2 = w / 2 + dx
  const y2 = h / 2 + dy

  const colorStops = stops
    .sort((a, b) => a.offset - b.offset)
    .map(s => {
      const a = s.opacity ?? 1
      const color = s.color === 'transparent'
        ? `rgba(0,0,0,0)`
        : hexToRgba(s.color, a)
      return { offset: s.offset, color }
    })

  return new Gradient({
    type: 'linear',
    coords: { x1, y1, x2, y2 },
    colorStops,
  })
}

function GradientEditor({ stops, angle, onChange, onAngleChange, isDark }) {
  const barRef = useRef(null)
  const [selectedStop, setSelectedStop] = useState(0)
  const [draggingStop, setDraggingStop] = useState(-1)
  const [editingStopColor, setEditingStopColor] = useState(false)
  const [stopHsv, setStopHsv] = useState(() => hexToHsv(stops[0]?.color || '#000000'))
  const stopSvRef = useRef(null)
  const stopHueRef = useRef(null)
  const draggingStopSV = useRef(false)
  const draggingStopHue = useRef(false)
  const draggingStopAlpha = useRef(false)
  const stopAlphaRef = useRef(null)

  useEffect(() => {
    if (selectedStop >= 0 && selectedStop < stops.length) {
      const s = stops[selectedStop]
      if (s.color && s.color !== 'transparent') {
        setStopHsv(hexToHsv(s.color))
      }
    }
  }, [selectedStop])

  const moveStop = useCallback((e) => {
    if (draggingStop < 0 || !barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newStops = [...stops]
    newStops[draggingStop] = { ...newStops[draggingStop], offset }
    onChange(newStops)
  }, [draggingStop, stops, onChange])

  const finishStopDrag = useCallback(() => {
    setDraggingStop(-1)
    draggingStopSV.current = false
    draggingStopHue.current = false
    draggingStopAlpha.current = false
  }, [])

  const handleStopSV = useCallback((e) => {
    if (!stopSvRef.current) return
    const rect = stopSvRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    const newHsv = { ...stopHsv, s, v }
    setStopHsv(newHsv)
    const hex = hsvToHex(newHsv.h, s, v)
    if (selectedStop >= 0 && selectedStop < stops.length) {
      const newStops = [...stops]
      newStops[selectedStop] = { ...newStops[selectedStop], color: hex }
      onChange(newStops)
    }
  }, [stopHsv, selectedStop, stops, onChange])

  const handleStopHue = useCallback((e) => {
    if (!stopHueRef.current) return
    const rect = stopHueRef.current.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    const newHsv = { ...stopHsv, h }
    setStopHsv(newHsv)
    const hex = hsvToHex(h, newHsv.s, newHsv.v)
    if (selectedStop >= 0 && selectedStop < stops.length) {
      const newStops = [...stops]
      newStops[selectedStop] = { ...newStops[selectedStop], color: hex }
      onChange(newStops)
    }
  }, [stopHsv, selectedStop, stops, onChange])

  const handleStopAlpha = useCallback((e) => {
    if (!stopAlphaRef.current) return
    const rect = stopAlphaRef.current.getBoundingClientRect()
    const alpha = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (selectedStop >= 0 && selectedStop < stops.length) {
      const newStops = [...stops]
      newStops[selectedStop] = { ...newStops[selectedStop], opacity: Math.round(alpha * 100) / 100 }
      onChange(newStops)
    }
  }, [selectedStop, stops, onChange])

  useEffect(() => {
    const onMove = (e) => {
      if (draggingStop >= 0) moveStop(e)
      if (draggingStopSV.current) handleStopSV(e)
      if (draggingStopHue.current) handleStopHue(e)
      if (draggingStopAlpha.current) handleStopAlpha(e)
    }
    const onUp = () => finishStopDrag()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [moveStop, finishStopDrag, handleStopSV, handleStopHue, handleStopAlpha])

  const addStop = (e) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const offset = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newStops = [...stops, { offset, color: '#888888', opacity: 1 }]
    onChange(newStops)
    setSelectedStop(newStops.length - 1)
  }

  const removeStop = (idx) => {
    if (stops.length <= 2) return
    const newStops = stops.filter((_, i) => i !== idx)
    onChange(newStops)
    setSelectedStop(Math.min(selectedStop, newStops.length - 1))
  }

  const currentStop = stops[selectedStop] || stops[0]
  const currentAlpha = currentStop?.opacity ?? 1
  const currentColor = currentStop?.color || '#000000'
  const isTransparent = currentColor === 'transparent'

  return (
    <div className="space-y-2">
      <div
        className="w-full h-6 rounded relative cursor-pointer"
        style={{
          backgroundImage: `${buildGradientCSS(stops, 90)}, ${CHECKER_BG}`,
          backgroundSize: '100% 100%, 8px 8px',
        }}
        ref={barRef}
        onDoubleClick={addStop}
      >
        {stops.map((stop, i) => (
          <div
            key={i}
            className="absolute top-0 w-0 h-full"
            style={{ left: `${stop.offset * 100}%` }}
          >
            <button
              className={`absolute -translate-x-1/2 -top-0.5 w-3 h-7 rounded-sm border-2 cursor-grab active:cursor-grabbing transition-shadow ${
                selectedStop === i ? 'border-blue-500 shadow-md z-10' : 'border-white shadow z-0'
              }`}
              style={{
                backgroundImage: CHECKER_BG,
                backgroundSize: '6px 6px',
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                setSelectedStop(i)
                setDraggingStop(i)
                if (stop.color && stop.color !== 'transparent') {
                  setStopHsv(hexToHsv(stop.color))
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingStopColor(v => !v)
              }}
            >
              <span
                className="absolute inset-0 rounded-[1px]"
                style={{
                  backgroundColor: isTransparent ? 'transparent' : hexToRgba(stop.color, stop.opacity ?? 1),
                }}
              />
            </button>
          </div>
        ))}
      </div>

      <div className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-0.5`}>Double-click bar to add stop. Select stop to edit.</div>

      {selectedStop >= 0 && selectedStop < stops.length && (
        <div className={`space-y-2 ${isDark ? 'bg-gray-700/40' : 'bg-gray-50'} rounded-lg p-2`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Stop {selectedStop + 1}</span>
            <div className="flex items-center gap-1">
              <button
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  isTransparent
                    ? (isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                    : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200')
                }`}
                onClick={() => {
                  const newStops = [...stops]
                  if (isTransparent) {
                    newStops[selectedStop] = { ...newStops[selectedStop], color: '#000000', opacity: 1 }
                  } else {
                    newStops[selectedStop] = { ...newStops[selectedStop], color: 'transparent', opacity: 0 }
                  }
                  onChange(newStops)
                }}
                title="Toggle transparent"
              >
                transparent
              </button>
              {stops.length > 2 && (
                <button
                  className={`${isDark ? 'text-gray-500' : 'text-gray-400'} hover:text-red-500 transition-colors`}
                  onClick={() => removeStop(selectedStop)}
                  title="Remove this stop"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {!isTransparent && (
            <>
              <div
                ref={stopSvRef}
                className="w-full h-[90px] rounded cursor-crosshair relative select-none"
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToHex(stopHsv.h)})`,
                }}
                onPointerDown={(e) => { draggingStopSV.current = true; handleStopSV(e); e.preventDefault() }}
              >
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${stopHsv.s * 100}% - 6px)`,
                    top: `calc(${(1 - stopHsv.v) * 100}% - 6px)`,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                  }}
                />
              </div>

              <div
                ref={stopHueRef}
                className="w-full h-2.5 rounded-full cursor-pointer relative select-none"
                style={{
                  background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                }}
                onPointerDown={(e) => { draggingStopHue.current = true; handleStopHue(e); e.preventDefault() }}
              >
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${stopHsv.h / 360 * 100}% - 6px)`,
                    top: '-1px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                  }}
                />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Opacity</span>
              <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} tabular-nums`}>{Math.round(currentAlpha * 100)}%</span>
            </div>
            <div
              ref={stopAlphaRef}
              className="w-full h-2.5 rounded-full cursor-pointer relative select-none"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(0,0,0,0), ${isTransparent ? '#000' : currentColor}), ${CHECKER_BG}`,
                backgroundSize: '100% 100%, 6px 6px',
              }}
              onPointerDown={(e) => { draggingStopAlpha.current = true; handleStopAlpha(e); e.preventDefault() }}
            >
              <div
                className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
                style={{
                  left: `calc(${currentAlpha * 100}% - 6px)`,
                  top: '-1px',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} shrink-0`}>Pos</span>
            <input
              type="number"
              min={0} max={100} step={1}
              value={Math.round(currentStop.offset * 100)}
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                const newStops = [...stops]
                newStops[selectedStop] = { ...newStops[selectedStop], offset: v / 100 }
                onChange(newStops)
              }}
              className={`w-12 border ${isDark ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-200'} rounded px-1.5 py-0.5 text-[11px] text-right tabular-nums focus:border-gray-400 outline-none`}
            />
            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>%</span>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Angle</span>
          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} tabular-nums`}>{angle}°</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="range"
            min={0} max={360} step={1}
            value={angle}
            onChange={(e) => onAngleChange(parseInt(e.target.value))}
            className={`flex-1 h-1.5 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded-lg appearance-none cursor-pointer accent-gray-600`}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {ANGLE_PRESETS.map(a => (
            <button
              key={a}
              className={`w-7 h-6 rounded text-[9px] border transition-colors flex items-center justify-center ${
                angle === a
                  ? (isDark ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-200 border-gray-400 text-gray-700')
                  : (isDark ? 'border-gray-600 text-gray-500 hover:bg-gray-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50')
              }`}
              onClick={() => onAngleChange(a)}
              title={`${a}°`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <line
                  x1="5" y1="5"
                  x2={5 + 4 * Math.cos((a - 90) * Math.PI / 180)}
                  y2={5 + 4 * Math.sin((a - 90) * Math.PI / 180)}
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-[3px]">
        {[
          { label: 'Black → White', stops: [{ offset: 0, color: '#000000', opacity: 1 }, { offset: 1, color: '#FFFFFF', opacity: 1 }] },
          { label: 'White → Transparent', stops: [{ offset: 0, color: '#FFFFFF', opacity: 1 }, { offset: 1, color: '#FFFFFF', opacity: 0 }] },
          { label: 'Black → Transparent', stops: [{ offset: 0, color: '#000000', opacity: 1 }, { offset: 1, color: '#000000', opacity: 0 }] },
          { label: 'Sunset', stops: [{ offset: 0, color: '#FF6600', opacity: 1 }, { offset: 0.5, color: '#FF0066', opacity: 1 }, { offset: 1, color: '#6600CC', opacity: 1 }] },
          { label: 'Ocean', stops: [{ offset: 0, color: '#00CCCC', opacity: 1 }, { offset: 1, color: '#0000FF', opacity: 1 }] },
          { label: 'Forest', stops: [{ offset: 0, color: '#99CC00', opacity: 1 }, { offset: 1, color: '#006600', opacity: 1 }] },
        ].map(preset => (
          <button
            key={preset.label}
            className={`w-[30px] h-[18px] rounded-sm border ${isDark ? 'border-gray-600' : 'border-gray-200'} hover:border-gray-400 cursor-pointer`}
            style={{ background: buildGradientCSS(preset.stops, angle) }}
            onClick={() => onChange(preset.stops)}
            title={preset.label}
          />
        ))}
      </div>
    </div>
  )
}

function ImageFillEditor({ imageUrl, fillMode, onFillModeChange, onClear, onPickImage, onImageDrop, recentFills, onSelectRecent, isDark }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const types = e.dataTransfer?.types || []
    if (types.includes('Files') ||
        types.includes('application/dtool-image-fill') ||
        types.includes('application/dtool-motion-fill')) {
      setDragOver(true)
    }
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (onImageDrop) onImageDrop(e)
  }

  return (
    <div
      className="space-y-2"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {imageUrl ? (
        <>
          <div
            className={`w-full h-[100px] rounded border overflow-hidden transition-all ${
              dragOver ? 'border-blue-500 ring-2 ring-blue-200' : (isDark ? 'border-gray-600' : 'border-gray-200')
            }`}
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: fillMode === 'tile' ? '40px 40px' : 'cover',
              backgroundRepeat: fillMode === 'tile' ? 'repeat' : 'no-repeat',
              backgroundPosition: 'center',
            }}
          >
            {dragOver && (
              <div className="w-full h-full bg-blue-500 bg-opacity-20 flex items-center justify-center">
                <span className={`text-[11px] font-medium ${isDark ? 'text-blue-300 bg-gray-700 bg-opacity-90' : 'text-blue-700 bg-white bg-opacity-90'} px-2 py-1 rounded shadow-sm`}>Drop to replace</span>
              </div>
            )}
          </div>
          <div className={`flex items-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-md p-0.5`}>
            <button
              className={`flex-1 text-[10px] font-medium py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${
                fillMode === 'tile'
                  ? (isDark ? 'bg-gray-800 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
              }`}
              onClick={() => onFillModeChange('tile')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1" y="1" width="6" height="6" rx="0.5" />
                <rect x="9" y="1" width="6" height="6" rx="0.5" />
                <rect x="1" y="9" width="6" height="6" rx="0.5" />
                <rect x="9" y="9" width="6" height="6" rx="0.5" />
              </svg>
              Tile
            </button>
            <button
              className={`flex-1 text-[10px] font-medium py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${
                fillMode === 'fill'
                  ? (isDark ? 'bg-gray-800 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                  : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
              }`}
              onClick={() => onFillModeChange('fill')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1" y="1" width="14" height="14" rx="1" />
                <rect x="3" y="3" width="10" height="10" rx="0.5" fill="currentColor" opacity="0.15" />
              </svg>
              Fill
            </button>
          </div>
          <div className="flex gap-1">
            <button
              className={`flex-1 py-1.5 rounded text-[10px] border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} transition-colors`}
              onClick={onPickImage}
            >
              Replace Image
            </button>
            <button
              className={`flex-1 py-1.5 rounded text-[10px] border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800' : 'border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'} transition-colors`}
              onClick={onClear}
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <button
            className={`w-full h-[80px] rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
              dragOver
                ? (isDark ? 'border-blue-400 bg-blue-900/30 text-blue-300' : 'border-blue-500 bg-blue-50 text-blue-600')
                : (isDark ? 'border-gray-500 text-gray-500 hover:border-gray-400 hover:text-gray-400' : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500')
            }`}
            onClick={onPickImage}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-[10px]">{dragOver ? 'Drop image here' : 'Click to choose or drag & drop an image'}</span>
          </button>
        </div>
      )}
      {recentFills && recentFills.length > 0 && (
        <div>
          <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Saved Fills</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {recentFills.map((url, i) => (
              <button
                key={i}
                className={`w-[36px] h-[36px] rounded border overflow-hidden transition-all hover:border-gray-500 hover:shadow-sm ${
                  url === imageUrl ? 'border-blue-500 ring-1 ring-blue-300' : (isDark ? 'border-gray-600' : 'border-gray-200')
                }`}
                onClick={() => onSelectRecent(url)}
                title="Apply saved image fill"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        Drag & drop an image here or onto the color swatch.
      </div>
    </div>
  )
}

export function buildPatternFromImage(imgElement, mode, objWidth, objHeight) {
  const iw = imgElement.naturalWidth || imgElement.width
  const ih = imgElement.naturalHeight || imgElement.height
  const ow = objWidth || 100
  const oh = objHeight || 100

  if (mode === 'fill') {
    const patCanvas = document.createElement('canvas')
    patCanvas.width = ow
    patCanvas.height = oh
    const pctx = patCanvas.getContext('2d')
    const scale = Math.max(ow / iw, oh / ih)
    const sw = iw * scale
    const sh = ih * scale
    pctx.drawImage(imgElement, (ow - sw) / 2, (oh - sh) / 2, sw, sh)
    return new Pattern({
      source: patCanvas,
      repeat: 'no-repeat',
    })
  }

  const tileCanvas = document.createElement('canvas')
  const maxTileFraction = 0.3
  const maxTileDim = Math.max(Math.min(ow, oh) * maxTileFraction, 30)
  const fitScale = Math.min(ow / iw, oh / ih, 1)
  const capScale = Math.min(maxTileDim / iw, maxTileDim / ih)
  const scale = Math.min(fitScale, capScale)
  tileCanvas.width = Math.max(Math.round(iw * scale), 4)
  tileCanvas.height = Math.max(Math.round(ih * scale), 4)
  const tctx = tileCanvas.getContext('2d')
  tctx.drawImage(imgElement, 0, 0, tileCanvas.width, tileCanvas.height)
  return new Pattern({
    source: tileCanvas,
    repeat: 'repeat',
  })
}

export { buildFabricGradient }

export default function ColorPicker({ value, onChange, allowNoColor = false, startGesture, popoverDirection = 'down', enableGradient = false, gradientTarget, onImageFill, onMotionFill, motionFillActive = false, maskImageUrl = null, dm }) {
  const noop = () => {}
  const gestureStart = startGesture || noop
  const isDark = !!dm

  const isPatternValue = value && typeof value === 'object' && value instanceof Pattern
  const isGradientValue = !isPatternValue && value && typeof value === 'object' && value.type === 'linear'
  const isNoColor = !isGradientValue && !isPatternValue && (!value || value === '' || value === 'transparent')
  const safeHex = isNoColor || isGradientValue || isPatternValue ? '#000000' : (value?.startsWith?.('#') ? value : '#000000')
  const [open, setOpen] = useState(false)
  const initTab = maskImageUrl ? 'image' : isPatternValue ? 'image' : isGradientValue ? 'gradient' : 'solid'
  const [tab, setTab] = useState(initTab)
  const [imageFillUrl, setImageFillUrl] = useState(() => {
    let url = null
    if (maskImageUrl) {
      url = maskImageUrl
    } else if (isPatternValue && value.source) {
      try {
        if (value.source instanceof HTMLCanvasElement) url = value.source.toDataURL()
        else if (value.source instanceof HTMLImageElement && value.source.src) url = value.source.src
      } catch (_) {}
    }
    if (url) addRecentImageFill(url)
    return url
  })
  const [imageFillMode, setImageFillMode] = useState(() => {
    if (maskImageUrl) return 'fill'
    if (isPatternValue && value.repeat !== 'no-repeat') return 'tile'
    return 'fill'
  })
  const [swatchDragOver, setSwatchDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [hsv, setHsv] = useState(() => hexToHsv(safeHex))
  const [popoverSide, setPopoverSide] = useState('below')
  const [fixedPos, setFixedPos] = useState(null)
  const popoverRef = useRef(null)
  const swatchBtnRef = useRef(null)
  const svRef = useRef(null)
  const hueRef = useRef(null)
  const draggingSV = useRef(false)
  const draggingHue = useRef(false)

  const [gradStops, setGradStops] = useState(() => {
    if (isGradientValue && value.colorStops) {
      return value.colorStops.map(s => {
        const parsed = parseColorToStopData(s.color)
        return { offset: s.offset, color: parsed.hex, opacity: parsed.alpha }
      })
    }
    return [
      { offset: 0, color: isNoColor ? '#000000' : safeHex, opacity: 1 },
      { offset: 1, color: '#FFFFFF', opacity: 1 },
    ]
  })
  const [gradAngle, setGradAngle] = useState(() => {
    if (isGradientValue && value.coords) {
      const dx = (value.coords.x2 ?? 0) - (value.coords.x1 ?? 0)
      const dy = (value.coords.y2 ?? 0) - (value.coords.y1 ?? 0)
      const rad = Math.atan2(dy, dx)
      return Math.round(((rad * 180 / Math.PI) + 90 + 360) % 360)
    }
    return 90
  })

  useEffect(() => {
    if (maskImageUrl) {
      setImageFillUrl(maskImageUrl)
      setImageFillMode('fill')
    } else if (isPatternValue && value.source) {
      try {
        if (value.source instanceof HTMLCanvasElement) setImageFillUrl(value.source.toDataURL())
        else if (value.source instanceof HTMLImageElement && value.source.src) setImageFillUrl(value.source.src)
      } catch (_) {}
      setImageFillMode(value.repeat === 'no-repeat' ? 'fill' : 'tile')
    } else if (!isPatternValue) {
      if (!imageFillUrl) setImageFillMode('tile')
    }
  }, [value, maskImageUrl])

  useEffect(() => {
    if (!open) return
    if (!isGradientValue && !isPatternValue) {
      const newHsv = hexToHsv(isNoColor ? '#000000' : safeHex)
      setHsv(newHsv)
    }
    if (imageFillUrl) setTab('image')
    else if (isPatternValue) setTab('image')
    else if (isGradientValue) setTab('gradient')
    else setTab('solid')
    const el = swatchBtnRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const popW = 228
      if (rect.left >= popW) {
        setPopoverSide('left')
        setFixedPos({ top: rect.top, right: window.innerWidth - rect.left + 8 })
      } else {
        setPopoverSide('below')
        setFixedPos(null)
      }
    }
  }, [open])

  const popoverPanelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      const inWrapper = popoverRef.current && popoverRef.current.contains(e.target)
      const inPanel = popoverPanelRef.current && popoverPanelRef.current.contains(e.target)
      if (!inWrapper && !inPanel) {
        if (tab === 'solid') addRecentColor(hsvToHex(hsv.h, hsv.s, hsv.v))
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, hsv, tab])

  const liveColor = useCallback((hex) => {
    gestureStart()
    onChange(hex)
  }, [gestureStart, onChange])

  const commitColor = useCallback((hex) => {
    gestureStart()
    addRecentColor(hex)
    onChange(hex)
  }, [gestureStart, onChange])

  const handleSVPointer = useCallback((e) => {
    const rect = svRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    const newHsv = { ...hsv, s, v }
    setHsv(newHsv)
    liveColor(hsvToHex(newHsv.h, s, v))
  }, [hsv, liveColor])

  const handleHuePointer = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    const newHsv = { ...hsv, h }
    setHsv(newHsv)
    liveColor(hsvToHex(h, newHsv.s, newHsv.v))
  }, [hsv, liveColor])

  const finishDrag = useCallback(() => {
    if (draggingSV.current || draggingHue.current) {
      addRecentColor(hsvToHex(hsv.h, hsv.s, hsv.v))
    }
    draggingSV.current = false
    draggingHue.current = false
  }, [hsv])

  useEffect(() => {
    const onMove = (e) => {
      if (draggingSV.current) handleSVPointer(e)
      else if (draggingHue.current) handleHuePointer(e)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finishDrag)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', finishDrag) }
  }, [handleSVPointer, handleHuePointer, finishDrag])

  const handleEyedropper = async () => {
    if (!window.EyeDropper) return
    try {
      const dropper = new window.EyeDropper()
      const result = await dropper.open()
      if (result?.sRGBHex) {
        const hex = result.sRGBHex.toUpperCase()
        setHsv(hexToHsv(hex))
        commitColor(hex)
      }
    } catch (_) { /* user cancelled */ }
  }

  const applyGradient = useCallback((stops, angle) => {
    gestureStart()
    const target = gradientTarget
    if (!target) return
    const w = target.width || 100
    const h = target.height || 100
    const grad = buildFabricGradient(stops, angle, w, h)
    onChange(grad)
  }, [gestureStart, onChange, gradientTarget])

  const handleGradStopsChange = useCallback((newStops) => {
    setGradStops(newStops)
    applyGradient(newStops, gradAngle)
  }, [gradAngle, applyGradient])

  const handleGradAngleChange = useCallback((newAngle) => {
    setGradAngle(newAngle)
    applyGradient(gradStops, newAngle)
  }, [gradStops, applyGradient])

  const loadImageAsFill = useCallback((dataUrl) => {
    setImageFillUrl(dataUrl)
    setTab('image')
    setOpen(true)
    addRecentImageFill(dataUrl)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (onImageFill) {
        onImageFill(img, imageFillMode, dataUrl)
      }
    }
    img.src = dataUrl
  }, [onImageFill, imageFillMode])

  const handleSwatchDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setSwatchDragOver(false)

    const dt = e.dataTransfer
    const imageFillData = dt?.getData('application/dtool-image-fill')
    if (imageFillData) {
      loadImageAsFill(imageFillData)
      return
    }

    const motionFillUrl = dt?.getData('application/dtool-motion-fill')
    if (motionFillUrl && onMotionFill) {
      fetch(motionFillUrl)
        .then(r => r.blob())
        .then(blob => {
          const ext = motionFillUrl.split('.').pop().split('?')[0].toLowerCase()
          const mime = ext === 'webm' ? 'video/webm' : 'video/mp4'
          const file = new File([blob], `motion.${ext}`, { type: mime })
          onMotionFill(file)
        })
        .catch(() => {})
      return
    }

    const files = dt?.files
    if (!files || files.length === 0) return
    const file = files[0]
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    const isVideo = t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.webm')
    const isGif = t === 'image/gif' || n.endsWith('.gif')
    const isAnimWebP = t === 'image/webp' || n.endsWith('.webp')
    if (isVideo || isGif || isAnimWebP) {
      if (onMotionFill) onMotionFill(file)
      return
    }
    if (!t.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      loadImageAsFill(ev.target.result)
    }
    reader.readAsDataURL(file)
  }, [loadImageAsFill, onMotionFill])

  const handleSwatchDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setSwatchDragOver(true)
  }, [])

  const handleSwatchDragLeave = useCallback((e) => {
    e.preventDefault()
    setSwatchDragOver(false)
  }, [])

  const handleFileSelect = useCallback((e) => {
    const file = e.target?.files?.[0]
    if (!file) return
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    const isVideo = t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.webm')
    const isGif = t === 'image/gif' || n.endsWith('.gif')
    const isAnimWebP = t === 'image/webp' || n.endsWith('.webp')
    if (isVideo || isGif || isAnimWebP) {
      if (onMotionFill) onMotionFill(file)
      e.target.value = ''
      return
    }
    if (!t.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      loadImageAsFill(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [loadImageAsFill, onMotionFill])

  const handleImageFillModeChange = useCallback((mode) => {
    setImageFillMode(mode)
    if (imageFillUrl && onImageFill) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        onImageFill(img, mode, imageFillUrl)
      }
      img.src = imageFillUrl
    }
  }, [imageFillUrl, onImageFill])

  const handleCanvasObjectDrop = useCallback((detail) => {
    const { dataUrl } = detail
    if (!dataUrl) return
    gestureStart()
    const mode = 'fill'
    setImageFillUrl(dataUrl)
    setImageFillMode(mode)
    setTab('image')
    setOpen(true)
    addRecentImageFill(dataUrl)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (onImageFill) onImageFill(img, mode, dataUrl)
    }
    img.src = dataUrl
  }, [onImageFill, gestureStart])

  useEffect(() => {
    const el = swatchBtnRef.current
    if (!el) return
    const handler = (e) => handleCanvasObjectDrop(e.detail)
    el.addEventListener('dtool-fill-drop', handler)
    return () => el.removeEventListener('dtool-fill-drop', handler)
  }, [handleCanvasObjectDrop])

  const handleClearImageFill = useCallback(() => {
    setImageFillUrl(null)
    setTab('solid')
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
    onChange(hex)
  }, [hsv, onChange])

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const displayHex = isNoColor ? '' : isGradientValue ? 'gradient' : isPatternValue ? 'image' : (value || '').replace('#', '').toUpperCase()

  const swatchStyle = isGradientValue
    ? { backgroundImage: buildGradientCSS(gradStops, gradAngle) }
    : isPatternValue ? {} : isNoColor ? {} : { backgroundColor: value }

  return (
    <div className="relative" ref={popoverRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,.mp4,.webm,.gif,.webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="flex items-center gap-2">
        <button
          ref={swatchBtnRef}
          {...(onImageFill ? { 'data-dtool-fill-drop': 'true' } : {})}
          className={`w-[30px] h-[30px] rounded border cursor-pointer block relative overflow-hidden shrink-0 transition-all ${
            swatchDragOver
              ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
              : (isDark ? 'border-gray-600' : 'border-gray-200')
          }`}
          onClick={() => setOpen(!open)}
          onDrop={handleSwatchDrop}
          onDragOver={handleSwatchDragOver}
          onDragLeave={handleSwatchDragLeave}
        >
          {isNoColor ? (
            <>
              <span className="absolute inset-0 bg-white" />
              <span className="absolute inset-0" style={{
                background: 'linear-gradient(to top right, transparent calc(50% - 1px), #EF4444 calc(50% - 1px), #EF4444 calc(50% + 1px), transparent calc(50% + 1px))',
              }} />
            </>
          ) : isPatternValue || imageFillUrl ? (
            <span className="absolute inset-0.5 rounded-sm" style={{
              backgroundImage: imageFillUrl ? `url(${imageFillUrl})` : undefined,
              backgroundSize: imageFillMode === 'tile' ? '12px 12px' : 'cover',
              backgroundRepeat: imageFillMode === 'tile' ? 'repeat' : 'no-repeat',
              backgroundPosition: 'center',
            }} />
          ) : (
            <span className="absolute inset-0.5 rounded-sm" style={swatchStyle} />
          )}
          {motionFillActive && !swatchDragOver && (
            <span className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white" opacity="0.9"><polygon points="6,3 20,12 6,21" /></svg>
            </span>
          )}
          {swatchDragOver && (
            <span className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          )}
        </button>
        <input
          type="text"
          value={displayHex}
          placeholder={isNoColor ? (allowNoColor ? 'none' : '') : ''}
          readOnly={isGradientValue}
          onFocus={() => { gestureStart(); setOpen(true) }}
          onChange={(e) => {
            if (isGradientValue) return
            const v = e.target.value.replace('#', '')
            if (v.length <= 6) {
              const color = v ? '#' + v : (allowNoColor ? '' : '#000000')
              if (v.length === 6) {
                setHsv(hexToHsv(color))
                addRecentColor(color)
              }
              onChange(color)
            }
          }}
          className={`flex-1 min-w-0 border ${isDark ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-200'} rounded px-2 py-1.5 text-sm font-mono focus:border-gray-400 outline-none`}
          maxLength={isGradientValue ? undefined : 6}
        />
        {window.EyeDropper && tab === 'solid' && (
          <button
            className={`w-[30px] h-[30px] rounded border ${isDark ? 'border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'} flex items-center justify-center shrink-0 transition-colors`}
            onClick={handleEyedropper}
            title="Eyedropper"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 22l1-1h3l9-9" />
              <path d="M3 21v-3l9-9" />
              <path d="M14.5 5.5L18.5 9.5" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L16 11l-4-4 5.5-5.5z" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div
          ref={popoverPanelRef}
          className={`${popoverSide === 'left' ? 'fixed' : 'absolute'} z-50 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-600' : 'border-gray-200'} rounded-lg shadow-lg p-2.5 w-[220px] overflow-visible`}
          style={{
            zIndex: 9999,
            ...(popoverSide === 'left' && fixedPos
              ? { top: fixedPos.top, right: fixedPos.right }
              : { left: 0, ...(popoverDirection === 'up' ? { bottom: '38px' } : { top: '38px' }) }
            ),
            ...(enableGradient && (tab === 'gradient' || tab === 'image') ? { width: 240 } : {}),
          }}
        >
          <button
            className={`absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full ${isDark ? 'bg-gray-800 border-gray-500' : 'bg-white border-gray-300'} border shadow-sm flex items-center justify-center ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} hover:border-gray-400 transition-colors z-10`}
            onClick={() => { if (tab === 'solid') addRecentColor(hsvToHex(hsv.h, hsv.s, hsv.v)); setOpen(false) }}
            title="Close"
          >
            <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>

          {enableGradient && (
            <div className={`flex items-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-md p-0.5 mb-2`}>
              <button
                className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${tab === 'solid' ? (isDark ? 'bg-gray-800 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}
                onClick={() => {
                  setTab('solid')
                  if (!isNoColor && !isGradientValue && !isPatternValue) {
                    onChange(value)
                  } else {
                    const hex = hsvToHex(hsv.h, hsv.s, hsv.v)
                    onChange(hex)
                  }
                }}
              >
                Solid
              </button>
              <button
                className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${tab === 'gradient' ? (isDark ? 'bg-gray-800 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}
                onClick={() => {
                  setTab('gradient')
                  applyGradient(gradStops, gradAngle)
                }}
              >
                Gradient
              </button>
              <button
                className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${tab === 'image' ? (isDark ? 'bg-gray-800 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}
                onClick={() => {
                  setTab('image')
                }}
              >
                Image
              </button>
            </div>
          )}

          {tab === 'solid' && (
            <>
              <div
                ref={svRef}
                className="w-full h-[130px] rounded cursor-crosshair relative mb-2 select-none"
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToHex(hsv.h)})`,
                }}
                onPointerDown={(e) => { draggingSV.current = true; handleSVPointer(e); e.preventDefault() }}
              >
                <div
                  className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${hsv.s * 100}% - 7px)`,
                    top: `calc(${(1 - hsv.v) * 100}% - 7px)`,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>

              <div
                ref={hueRef}
                className="w-full h-3 rounded-full cursor-pointer relative mb-2.5 select-none"
                style={{
                  background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                }}
                onPointerDown={(e) => { draggingHue.current = true; handleHuePointer(e); e.preventDefault() }}
              >
                <div
                  className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none"
                  style={{
                    left: `calc(${hsv.h / 360 * 100}% - 7px)`,
                    top: '-1px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-[3px] mb-1.5">
                {allowNoColor && (
                  <button
                    className={`w-[18px] h-[18px] rounded-sm border cursor-pointer relative overflow-hidden shrink-0 ${isNoColor ? 'border-gray-500 ring-1 ring-gray-400' : `${isDark ? 'border-gray-600' : 'border-gray-200'} hover:border-gray-400`}`}
                    onClick={() => { gestureStart(); onChange(''); setOpen(false) }}
                    title="No color"
                  >
                    <span className="absolute inset-0 bg-white" />
                    <span className="absolute inset-0" style={{
                      background: 'linear-gradient(to top right, transparent calc(50% - 1px), #EF4444 calc(50% - 1px), #EF4444 calc(50% + 1px), transparent calc(50% + 1px))',
                    }} />
                  </button>
                )}
                {COMMON_COLORS.map(c => (
                  <MiniSwatch
                    key={c}
                    color={c}
                    active={!isNoColor && !isGradientValue && value?.toUpperCase?.() === c}
                    onClick={() => { commitColor(c); setHsv(hexToHsv(c)) }}
                    isDark={isDark}
                  />
                ))}
              </div>

              {_recentColors.length > 0 && (
                <div className="mb-1">
                  <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Recent</span>
                  <div className="flex flex-wrap gap-[3px] mt-0.5" style={{ maxWidth: 8 * 18 + 7 * 3 + 'px' }}>
                    {_recentColors.map(c => (
                      <MiniSwatch
                        key={c}
                        color={c}
                        active={!isNoColor && !isGradientValue && value?.toUpperCase?.() === c}
                        onClick={() => { commitColor(c); setHsv(hexToHsv(c)) }}
                        isDark={isDark}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'gradient' && enableGradient && (
            <GradientEditor
              stops={gradStops}
              angle={gradAngle}
              onChange={handleGradStopsChange}
              onAngleChange={handleGradAngleChange}
              isDark={isDark}
            />
          )}

          {tab === 'image' && enableGradient && (
            <ImageFillEditor
              imageUrl={imageFillUrl}
              fillMode={imageFillMode}
              onFillModeChange={handleImageFillModeChange}
              onClear={handleClearImageFill}
              onPickImage={handlePickImage}
              onImageDrop={handleSwatchDrop}
              recentFills={getRecentImageFills()}
              onSelectRecent={loadImageAsFill}
              isDark={isDark}
            />
          )}
        </div>
      )}
    </div>
  )
}

function parseColorToStopData(colorStr) {
  if (!colorStr || colorStr === 'transparent') return { hex: '#000000', alpha: 0 }
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0')
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0')
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0')
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
    return { hex: `#${r}${g}${b}`.toUpperCase(), alpha: a }
  }
  if (colorStr.startsWith('#')) return { hex: colorStr.toUpperCase(), alpha: 1 }
  return { hex: '#000000', alpha: 1 }
}
