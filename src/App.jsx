import React, { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import Toolbar from './components/Toolbar'
import IconSidebar from './components/IconSidebar'
import LayersPanel from './components/LayersPanel'
import ShapesPanel from './components/ShapesPanel'
import IconsPanel from './components/IconsPanel'
import LobstersPanel from './components/LobstersPanel'
import AiToolsPanel from './components/AiToolsPanel'
import CanvasArea from './components/CanvasArea'
import RightSidebar from './components/RightSidebar'
import AgentChat from './components/AgentChat'
import FloatingPenToolbar from './components/FloatingPenToolbar'
import { useCanvasState } from './hooks/useCanvasState'

const ZOOM_PRESETS = [
  { label: '25%',  value: 0.25 },
  { label: '50%',  value: 0.5 },
  { label: '75%',  value: 0.75 },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
  { label: '400%', value: 4 },
]

function BottomBarZoom({ zoom, setZoom, fitToView, dm }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pct = Math.round(zoom * 100)

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button
          className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold ${
            dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          onClick={() => setZoom(z => Math.max(0.1, +(z - 0.1).toFixed(2)))}
        >&minus;</button>
        <button
          onClick={() => setOpen(v => !v)}
          className={`px-1.5 py-0.5 rounded text-xs tabular-nums font-medium transition-colors ${
            open
              ? (dm ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800')
              : (dm ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')
          }`}
          title="Zoom presets"
        >
          {pct}%
          <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" className={`inline-block ml-1 transition-transform ${open ? 'rotate-180' : ''}`}>
            <polygon points="2,7 8,7 5,3" />
          </svg>
        </button>
        <button
          className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold ${
            dm ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          onClick={() => setZoom(z => Math.min(4, +(z + 0.1).toFixed(2)))}
        >+</button>
        <button
          className={`px-2 py-0.5 text-xs rounded ${
            dm ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
          onClick={() => { fitToView(); setOpen(false) }}
        >Fit</button>
      </div>

      {open && (
        <div className={`absolute bottom-full right-0 mb-1 rounded-lg shadow-xl border py-1 min-w-[150px] ${
          dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => { fitToView(); setOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
              dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>Fit to View</span>
            <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Ctrl+0</span>
          </button>
          <div className={`my-1 border-t ${dm ? 'border-gray-700' : 'border-gray-100'}`} />
          {ZOOM_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => { setZoom(p.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                Math.abs(zoom - p.value) < 0.01
                  ? (dm ? 'bg-blue-900/30 text-blue-300 font-medium' : 'bg-blue-50 text-blue-600 font-medium')
                  : (dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className={`my-1 border-t ${dm ? 'border-gray-700' : 'border-gray-100'}`} />
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <button
              onClick={() => setZoom(Math.max(0.1, +(zoom - 0.1).toFixed(2)))}
              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="6" x2="10" y2="6" /></svg>
            </button>
            <input
              type="range"
              min={10}
              max={400}
              step={5}
              value={pct}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${
                dm ? 'accent-blue-400 bg-gray-600' : 'accent-blue-500 bg-gray-200'
              }`}
            />
            <button
              onClick={() => setZoom(Math.min(4, +(zoom + 0.1).toFixed(2)))}
              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="6" x2="10" y2="6" /><line x1="6" y1="2" x2="6" y2="10" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const canvasState = useCanvasState()
  const {
    canvasRef,
    zoom,
    setZoom,
    saveUndoState,
    refreshObjects,
    undo,
    redo,
    copySelected,
    pasteFromClipboard,
    cutSelected,
    duplicateSelected,
    selectAll,
    deselectAll,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    nudgeSelected,
    bringForward,
    sendBackward,
    activeTool,
    setActiveTool,
  } = canvasState

  const { darkMode, setDarkMode } = canvasState

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-dark', '')
    } else {
      document.documentElement.removeAttribute('data-dark')
    }
  }, [darkMode])

  const toggleDarkMode = useCallback((e) => {
    const rect = e?.currentTarget?.getBoundingClientRect?.()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : 0
    document.documentElement.style.setProperty('--ripple-x', `${x}px`)
    document.documentElement.style.setProperty('--ripple-y', `${y}px`)

    const apply = () => {
      setDarkMode(prev => {
        const next = !prev
        try { localStorage.setItem('dtool-dark-mode', String(next)) } catch {}
        return next
      })
    }

    if (document.startViewTransition) {
      document.startViewTransition(() => { flushSync(apply) })
    } else {
      apply()
    }
  }, [setDarkMode])

  const [activePanel, setActivePanel] = useState(null)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  const handleSelectPanel = (panelId) => {
    setActivePanel(panelId)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (canvas.getActiveObject()?.isEditing) return

      const ctrl = e.ctrlKey || e.metaKey
      const shift = e.shiftKey
      const key = e.key.toLowerCase()

      // Ctrl+C  Copy
      if (ctrl && key === 'c') {
        e.preventDefault()
        copySelected()
        return
      }
      // Ctrl+V  Paste
      if (ctrl && key === 'v') {
        e.preventDefault()
        pasteFromClipboard()
        return
      }
      // Ctrl+X  Cut
      if (ctrl && key === 'x') {
        e.preventDefault()
        cutSelected()
        return
      }
      // Ctrl+D  Duplicate
      if (ctrl && key === 'd') {
        e.preventDefault()
        duplicateSelected()
        return
      }
      // Ctrl+A  Select All
      if (ctrl && key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }
      // Ctrl+Z  Undo
      if (ctrl && !shift && key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      // Ctrl+Shift+Z or Ctrl+Y  Redo
      if ((ctrl && shift && key === 'z') || (ctrl && key === 'y')) {
        e.preventDefault()
        redo()
        return
      }
      if (ctrl && !shift && key === 'g') {
        e.preventDefault()
        groupSelected()
        return
      }
      if (ctrl && shift && key === 'g') {
        e.preventDefault()
        ungroupSelected()
        return
      }
      // Ctrl+]  Bring Forward
      if (ctrl && e.key === ']') {
        e.preventDefault()
        bringForward()
        return
      }
      // Ctrl+[  Send Backward
      if (ctrl && e.key === '[') {
        e.preventDefault()
        sendBackward()
        return
      }
      // Ctrl+=  Zoom In
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))
        return
      }
      // Ctrl+-  Zoom Out
      if (ctrl && e.key === '-') {
        e.preventDefault()
        setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(1)))
        return
      }
      // Ctrl+0  Reset Zoom
      if (ctrl && e.key === '0') {
        e.preventDefault()
        canvasState.fitToView()
        return
      }
      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && canvas.getActiveObject()) {
        e.preventDefault()
        deleteSelected()
        return
      }
      // Escape  Deselect / exit tool
      if (e.key === 'Escape') {
        e.preventDefault()
        setActiveTool('select')
        deselectAll()
        return
      }
      // V  Select tool
      if (!ctrl && key === 'v') {
        setActiveTool('select')
        return
      }
      // B  Blob brush
      if (!ctrl && key === 'b') {
        setActiveTool('blobBrush')
        return
      }
      // P  Pen tool
      if (!ctrl && key === 'p') {
        setActiveTool('pen')
        return
      }
      // Arrow keys  Nudge (Shift = 10px, normal = 1px)
      const nudgeAmount = shift ? 10 : 1
      if (e.key === 'ArrowLeft' && canvas.getActiveObject()) {
        e.preventDefault()
        nudgeSelected(-nudgeAmount, 0)
        return
      }
      if (e.key === 'ArrowRight' && canvas.getActiveObject()) {
        e.preventDefault()
        nudgeSelected(nudgeAmount, 0)
        return
      }
      if (e.key === 'ArrowUp' && canvas.getActiveObject()) {
        e.preventDefault()
        nudgeSelected(0, -nudgeAmount)
        return
      }
      if (e.key === 'ArrowDown' && canvas.getActiveObject()) {
        e.preventDefault()
        nudgeSelected(0, nudgeAmount)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    canvasRef, undo, redo,
    copySelected, pasteFromClipboard, cutSelected, duplicateSelected,
    selectAll, deselectAll, deleteSelected, groupSelected, ungroupSelected, nudgeSelected,
    bringForward, sendBackward, setZoom, setActiveTool,
  ])

  return (
    <div className={`h-screen w-screen flex flex-col select-none overflow-hidden ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <Toolbar canvasState={canvasState} onToggleDarkMode={toggleDarkMode} />
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar activePanel={activePanel} onSelectPanel={handleSelectPanel} darkMode={darkMode} />
        {activePanel === 'images' && (
          <ShapesPanel canvasState={canvasState} />
        )}
        {activePanel === 'icons' && (
          <IconsPanel canvasState={canvasState} />
        )}
        {activePanel === 'layers' && (
          <LayersPanel canvasState={canvasState} />
        )}
        {activePanel === 'lobsters' && (
          <LobstersPanel canvasState={canvasState} />
        )}
        {activePanel === 'ai-tools' && (
          <AiToolsPanel canvasState={canvasState} darkMode={darkMode} />
        )}
        <CanvasArea canvasState={canvasState} />
        <FloatingPenToolbar canvasState={canvasState} />
        {rightSidebarOpen && (
          <RightSidebar
            canvasState={canvasState}
            onClose={() => setRightSidebarOpen(false)}
          />
        )}
      </div>
      <AgentChat canvasState={canvasState} />
      <div className={`h-8 border-t flex items-center justify-between px-4 shrink-0 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {canvasRef.current ? `${canvasRef.current.getObjects().length} object(s)` : ''}
          </span>
          <button
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              canvasState.showCheckerboard
                ? (darkMode ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-700 text-white hover:bg-gray-600')
                : (darkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700')
            }`}
            onClick={() => canvasState.setShowCheckerboard(v => !v)}
            title={canvasState.showCheckerboard ? 'Hide transparency grid' : 'Show transparency grid'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect width="14" height="14" rx="2" fill={darkMode ? '#374151' : '#ffffff'} stroke={canvasState.showCheckerboard ? '#1DEFFF' : (darkMode ? '#4b5563' : '#d1d5db')} strokeWidth="1" />
              <rect x="1" y="1" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="7" y="1" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="4" y="4" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="10" y="4" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="1" y="7" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="7" y="7" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="4" y="10" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
              <rect x="10" y="10" width="3" height="3" fill={darkMode ? '#4b5563' : '#cccccc'} />
            </svg>
            Transparency
          </button>
        </div>
        <div className="flex items-center gap-2">
          <BottomBarZoom
            zoom={zoom}
            setZoom={setZoom}
            fitToView={() => canvasState.fitToView()}
            dm={!!darkMode}
          />
          {!rightSidebarOpen && (
            <button
              className={`ml-2 px-2 py-0.5 text-xs rounded ${
                darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setRightSidebarOpen(true)}
            >Properties</button>
          )}
        </div>
      </div>
    </div>
  )
}
