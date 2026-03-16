import React, { useState, useRef, useCallback } from 'react'
import { PEN_SUB_TOOL_LIST } from './penSubToolList'

export default function FloatingPenToolbar({ canvasState }) {
  const {
    activeTool, setActiveTool,
    penSubTool, setPenSubTool,
    darkMode,
  } = canvasState
  const dm = !!darkMode

  const [pos, setPos] = useState({ x: 80, y: 120 })
  const dragRef = useRef(null)
  const panelRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return
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

  const handleClose = () => {
    setActiveTool('select')
  }

  if (activeTool !== 'pen') return null

  return (
    <div
      ref={panelRef}
      onMouseDown={onMouseDown}
      className="fixed z-[200] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className={`rounded-xl shadow-2xl w-48 overflow-hidden border ${
        dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
      }`}
        style={{ boxShadow: dm ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <div className={`flex items-center justify-between px-2.5 py-1.5 border-b cursor-move ${
          dm ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={dm ? 'text-gray-400' : 'text-gray-500'}>
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
            </svg>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Pen Tools</span>
          </div>
          <button
            onClick={handleClose}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              dm ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
            }`}
            title="Close pen tools"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>
        </div>

        <div className="px-1.5 py-1.5 space-y-0.5">
          {PEN_SUB_TOOL_LIST.map(tool => (
            <button
              key={tool.id}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${
                penSubTool === tool.id
                  ? (dm ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700')
                  : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50')
              }`}
              onClick={() => setPenSubTool(tool.id)}
              title={tool.desc}
            >
              <span className="shrink-0 w-5 h-5 flex items-center justify-center">{tool.icon}</span>
              <span className="text-[11px] font-medium truncate">{tool.label}</span>
            </button>
          ))}
        </div>

        <div className={`border-t px-2.5 py-1.5 ${dm ? 'border-gray-600' : 'border-gray-100'}`}>
          <div className={`text-[9px] leading-relaxed space-y-px ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <div><strong>Esc</strong> commit edits &nbsp; <strong>Drag</strong> curves</div>
            <div><strong>Anchor Pt: Drag</strong> create handles</div>
            <div><strong>Anchor Pt: Click handle</strong> break link</div>
          </div>
        </div>
      </div>
    </div>
  )
}
