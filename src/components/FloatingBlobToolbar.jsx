import React, { useState, useRef, useCallback, useEffect } from 'react'
import { hexToHsv, hsvToHex, hueToHex, addRecentColor, getRecentColors } from './ColorPicker'
import BloodFill from './BloodFill'

const BRUSH_SHAPES = [
  { id: 'circle', label: 'Circle', icon: () => <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="currentColor"/></svg> },
  { id: 'square', label: 'Square', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" fill="currentColor" transform={`rotate(${-angle} 7 7)`}/></svg> },
  { id: 'diamond', label: 'Diamond', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,7 7,13 1,7" fill="currentColor" transform={`rotate(${-angle} 7 7)`}/></svg> },
  { id: 'wedge', label: 'Wedge', icon: (angle) => <svg width="14" height="14" viewBox="0 0 14 14"><ellipse cx="7" cy="7" rx="6" ry="2" transform={`rotate(${-angle} 7 7)`} fill="currentColor"/></svg> },
]

const QUICK_COLORS = [
  '#FFFFFF', '#C0C0C0', '#808080', '#000000',
  '#FF0000', '#FF6600', '#FFCC00', '#FFFF00',
  '#00CC00', '#00CCCC', '#0066FF', '#0000FF',
  '#6600CC', '#CC00CC', '#FF0066', '#993300',
]

function InlineBlobColorPicker({ value, onChange, dm }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#FFFFFF'))
  const svRef = useRef(null)
  const hueRef = useRef(null)
  const draggingSV = useRef(false)
  const draggingHue = useRef(false)

  useEffect(() => {
    setHsv(hexToHsv(value || '#FFFFFF'))
  }, [value])

  const apply = useCallback((h, s, v) => {
    const hex = hsvToHex(h, s, v)
    onChange(hex)
  }, [onChange])

  const handleSV = useCallback((e) => {
    const rect = svRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    const next = { ...hsv, s, v }
    setHsv(next)
    apply(next.h, s, v)
  }, [hsv, apply])

  const handleHue = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    const next = { ...hsv, h }
    setHsv(next)
    apply(h, next.s, next.v)
  }, [hsv, apply])

  const finishDrag = useCallback(() => {
    if (draggingSV.current || draggingHue.current) {
      addRecentColor(hsvToHex(hsv.h, hsv.s, hsv.v))
    }
    draggingSV.current = false
    draggingHue.current = false
  }, [hsv])

  useEffect(() => {
    const onMove = (e) => {
      if (draggingSV.current) handleSV(e)
      else if (draggingHue.current) handleHue(e)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finishDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finishDrag)
    }
  }, [handleSV, handleHue, finishDrag])

  const handleEyedropper = async () => {
    if (!window.EyeDropper) return
    try {
      const dropper = new window.EyeDropper()
      const result = await dropper.open()
      if (result?.sRGBHex) {
        const hex = result.sRGBHex.toUpperCase()
        setHsv(hexToHsv(hex))
        addRecentColor(hex)
        onChange(hex)
      }
    } catch (_) {}
  }

  const recents = getRecentColors().slice(0, 8)

  return (
    <div className="space-y-2">
      {/* SV panel */}
      <div
        ref={svRef}
        className="relative w-full rounded-md overflow-hidden cursor-crosshair"
        style={{
          height: 110,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToHex(hsv.h)})`,
        }}
        onPointerDown={(e) => { e.preventDefault(); draggingSV.current = true; handleSV(e) }}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `calc(${hsv.s * 100}% - 7px)`,
            top: `calc(${(1 - hsv.v) * 100}% - 7px)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.4)',
            background: hsvToHex(hsv.h, hsv.s, hsv.v),
          }}
        />
      </div>

      {/* Hue bar */}
      <div
        ref={hueRef}
        className="relative w-full h-3 rounded-full cursor-pointer"
        style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
        onPointerDown={(e) => { e.preventDefault(); draggingHue.current = true; handleHue(e) }}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `calc(${(hsv.h / 360) * 100}% - 7px)`,
            top: -1,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.3)',
            background: hueToHex(hsv.h),
          }}
        />
      </div>

      {/* Quick swatches */}
      <div>
        <div className="flex flex-wrap gap-[3px]">
          {QUICK_COLORS.map(c => (
            <button
              key={c}
              className="w-[22px] h-[22px] rounded-sm border cursor-pointer transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: value?.toUpperCase() === c
                  ? (dm ? '#60a5fa' : '#3b82f6')
                  : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                boxShadow: value?.toUpperCase() === c ? `0 0 0 1.5px ${dm ? '#60a5fa' : '#3b82f6'}` : 'none',
              }}
              onClick={() => {
                setHsv(hexToHsv(c))
                addRecentColor(c)
                onChange(c)
              }}
            />
          ))}
        </div>
      </div>

      {/* Recent colors + eyedropper row */}
      {(recents.length > 0 || window.EyeDropper) && (
        <div className="flex items-center gap-1.5">
          {window.EyeDropper && (
            <button
              onClick={handleEyedropper}
              className={`w-[22px] h-[22px] rounded-sm flex items-center justify-center border transition-colors ${
                dm ? 'border-gray-600 hover:bg-gray-600 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-500'
              }`}
              title="Eyedropper"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 22l1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="M14.5 5.5l4 4" />
                <path d="M18.5 1.5a2.12 2.12 0 013 3l-3.5 3.5-4-4 3.5-3.5z" />
              </svg>
            </button>
          )}
          {recents.map(c => (
            <button
              key={c}
              className="w-[18px] h-[18px] rounded-sm border cursor-pointer transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
              onClick={() => {
                setHsv(hexToHsv(c))
                onChange(c)
              }}
              title={c}
            />
          ))}
        </div>
      )}

      {/* Hex input */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-6 h-6 rounded border shrink-0"
          style={{
            backgroundColor: value,
            borderColor: dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          }}
        />
        <input
          className={`flex-1 text-xs font-mono px-1.5 py-1 rounded border outline-none ${
            dm
              ? 'bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-400'
              : 'bg-white border-gray-200 text-gray-700 focus:border-blue-500'
          }`}
          value={(value || '').replace('#', '').toUpperCase()}
          onChange={(e) => {
            const raw = e.target.value.replace('#', '').slice(0, 6)
            if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
              const hex = '#' + raw.toUpperCase()
              setHsv(hexToHsv(hex))
              onChange(hex)
            }
          }}
          onBlur={(e) => {
            const raw = e.target.value.replace('#', '')
            if (/^[0-9A-Fa-f]{6}$/.test(raw)) addRecentColor('#' + raw.toUpperCase())
          }}
          maxLength={6}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

export default function FloatingBlobToolbar({ canvasState }) {
  const {
    activeTool, setActiveTool,
    blobBrushSize, setBlobBrushSize,
    blobBrushColor, setBlobBrushColor,
    blobBrushShape, setBlobBrushShape,
    blobBrushAngle, setBlobBrushAngle,
    darkMode,
    bloodRain,
  } = canvasState
  const dm = !!darkMode

  const [pos, setPos] = useState({ x: 80, y: 200 })
  const dragRef = useRef(null)
  const panelRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input')) return
    e.preventDefault()
    const rect = panelRef.current.getBoundingClientRect()
    dragRef.current = { offX: e.clientX - rect.left, offY: e.clientY - rect.top }

    const onMove = (ev) => {
      if (!dragRef.current) return
      setPos({
        x: Math.max(0, ev.clientX - dragRef.current.offX),
        y: Math.max(0, ev.clientY - dragRef.current.offY),
      })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  if (activeTool !== 'blobBrush') return null

  return (
    <div
      ref={panelRef}
      onMouseDown={onMouseDown}
      className="fixed z-[200] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className={`rounded-xl shadow-2xl w-52 overflow-hidden border relative ${
        dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
      }`}
        style={{ boxShadow: dm ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div className={`flex items-center justify-between px-2.5 py-1.5 border-b cursor-move ${
          dm ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={dm ? 'text-gray-400' : 'text-gray-500'}>
              <path d="M18.37 2.63a2.12 2.12 0 013 3L14 13l-4 1 1-4z" />
              <path d="M9 14c-2.5 2-4.5 4-4.5 6a2.5 2.5 0 005 0c0-2-1-3.5-2-5" />
            </svg>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Blob Brush</span>
          </div>
          <button
            onClick={() => setActiveTool('select')}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              dm ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
            }`}
            title="Close blob brush"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>
        </div>

        <div className="px-2.5 py-2 space-y-3">
          <div>
            <span className={`text-[10px] uppercase tracking-wider font-semibold block mb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Tip Shape</span>
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
            <span className={`text-[10px] uppercase tracking-wider font-semibold block mb-1.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Color</span>
            <InlineBlobColorPicker
              value={blobBrushColor}
              onChange={setBlobBrushColor}
              dm={dm}
            />
          </div>
        </div>
        {bloodRain && <BloodFill />}
      </div>
    </div>
  )
}
