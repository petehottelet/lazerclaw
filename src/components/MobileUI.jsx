import React, { useState, useRef, useEffect, useCallback } from 'react'

// ─── Mobile Header ───────────────────────────────────────────────────────────
// Thin top bar: logo · undo/redo · zoom · dark mode · download
export function MobileHeader({ canvasState, onToggleDarkMode }) {
  const { canvasRef, zoom, setZoom, undo, redo, darkMode } = canvasState
  const dm = !!darkMode

  return (
    <div
      className="flex items-center justify-between px-2 shrink-0"
      style={{
        height: 44,
        background: dm
          ? 'linear-gradient(180deg, #1f2937 0%, #111827 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)',
        borderBottom: dm ? '1px solid rgba(100,160,255,0.15)' : '1px solid #e5e7eb',
      }}
    >
      {/* Logo */}
      <img
        src="/lazerclaw_logo.png"
        alt="LazerClaw"
        style={{ height: 28, objectFit: 'contain' }}
      />

      {/* Center: Undo / Redo */}
      <div className="flex items-center gap-1">
        <MobileIconBtn icon={ICONS.undo} label="Undo" onClick={undo} dm={dm} />
        <MobileIconBtn icon={ICONS.redo} label="Redo" onClick={redo} dm={dm} />
        <div className="w-px h-5 mx-1" style={{ background: dm ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
        <span
          className="text-[11px] font-medium px-1 min-w-[36px] text-center"
          style={{ color: dm ? '#9ca3af' : '#6b7280' }}
        >
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Right: dark mode + download placeholder */}
      <div className="flex items-center gap-1">
        <MobileIconBtn icon={ICONS.darkMode} label="Theme" onClick={onToggleDarkMode} dm={dm} />
      </div>
    </div>
  )
}

// ─── Mobile Bottom Nav Bar ───────────────────────────────────────────────────
// 6 tabs: Select · Text · Shapes · Layers · More · (Download CTA)
const NAV_ITEMS = [
  { id: 'select', label: 'Select', icon: ICONS.select },
  { id: 'text', label: 'Text', icon: ICONS.text },
  { id: 'images', label: 'Shapes', icon: ICONS.shapes },
  { id: 'layers', label: 'Layers', icon: ICONS.layers },
  { id: 'more', label: 'More', icon: ICONS.more },
]

export function MobileBottomNav({ activeTab, onTabChange, activeTool, darkMode, onAddText, canvasState }) {
  const dm = !!darkMode
  return (
    <div
      className="flex items-center justify-around shrink-0"
      style={{
        height: 56,
        background: dm
          ? 'linear-gradient(180deg, #111827 0%, #0f0f1a 100%)'
          : 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        borderTop: dm ? '1px solid rgba(100,160,255,0.15)' : '1px solid #e5e7eb',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.id === 'select'
          ? activeTool === 'select' && !activeTab
          : activeTab === item.id
        return (
          <button
            key={item.id}
            className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
            style={{
              color: isActive
                ? (dm ? '#60a5fa' : '#3b82f6')
                : (dm ? 'rgba(255,255,255,0.5)' : '#9ca3af'),
              background: isActive
                ? (dm ? 'rgba(96,165,250,0.12)' : 'rgba(59,130,246,0.08)')
                : 'transparent',
              minWidth: 52,
            }}
            onClick={() => {
              if (item.id === 'select') {
                onTabChange(null)
                if (canvasState.setActiveTool) canvasState.setActiveTool('select')
              } else if (item.id === 'text') {
                onTabChange(null)
                if (onAddText) onAddText()
              } else {
                onTabChange(activeTab === item.id ? null : item.id)
              }
            }}
          >
            <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </span>
            <span className="text-[9px] font-medium leading-none">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Mobile Bottom Sheet ─────────────────────────────────────────────────────
// Slide-up drawer for panels (Shapes, Layers, More, Properties)
export function MobileBottomSheet({ isOpen, onClose, title, children, darkMode, height }) {
  const dm = !!darkMode
  const sheetRef = useRef(null)
  const dragStartY = useRef(null)
  const [dragOffset, setDragOffset] = useState(0)

  const handleTouchStart = useCallback((e) => {
    dragStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (dragStartY.current == null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy > 0) {
      setDragOffset(dy)
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 80) {
      onClose()
    }
    setDragOffset(0)
    dragStartY.current = null
  }, [dragOffset, onClose])

  useEffect(() => {
    if (!isOpen) setDragOffset(0)
  }, [isOpen])

  const sheetHeight = height || '55vh'

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[8000]"
          style={{
            background: 'rgba(0,0,0,0.4)',
            opacity: dragOffset > 0 ? Math.max(0, 1 - dragOffset / 200) : 1,
            transition: dragOffset > 0 ? 'none' : 'opacity 0.2s',
          }}
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-[8001] flex flex-col"
        style={{
          maxHeight: sheetHeight,
          height: sheetHeight,
          background: dm
            ? 'linear-gradient(180deg, #1e1e2f 0%, #16162a 100%)'
            : '#ffffff',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
          transform: isOpen
            ? `translateY(${dragOffset}px)`
            : `translateY(100%)`,
          transition: dragOffset > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Drag handle + title */}
        <div
          className="flex flex-col items-center pt-2 pb-1 shrink-0 cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="rounded-full mb-2"
            style={{
              width: 36,
              height: 4,
              background: dm ? 'rgba(255,255,255,0.2)' : '#d1d5db',
            }}
          />
          {title && (
            <div className="flex items-center justify-between w-full px-4">
              <span
                className="text-sm font-semibold"
                style={{ color: dm ? '#e5e7eb' : '#1f2937' }}
              >
                {title}
              </span>
              <button
                className="p-1 rounded-lg"
                style={{ color: dm ? '#9ca3af' : '#6b7280' }}
                onClick={onClose}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </>
  )
}

// ─── Mobile Properties Sheet ─────────────────────────────────────────────────
// Auto-shows when an object is selected, with quick-access property controls
export function MobilePropertiesBar({ canvasState, darkMode }) {
  const dm = !!darkMode
  const { selectedObject, canvasRef, deleteSelected, duplicateSelected, bringForward, sendBackward, saveUndoState } = canvasState
  if (!selectedObject) return null

  const type = selectedObject.type || ''
  const isText = type === 'textbox' || type === 'i-text' || type === 'text'

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 shrink-0 overflow-x-auto"
      style={{
        background: dm ? '#1a1a2e' : '#f8fafc',
        borderTop: dm ? '1px solid rgba(100,160,255,0.15)' : '1px solid #e5e7eb',
        minHeight: 44,
        scrollbarWidth: 'none',
      }}
    >
      {isText && (
        <>
          <PropBtn icon={ICONS.bold} label="B" dm={dm} active={selectedObject.fontWeight === 'bold'}
            onClick={() => { saveUndoState(); selectedObject.set('fontWeight', selectedObject.fontWeight === 'bold' ? 'normal' : 'bold'); canvasRef.current?.requestRenderAll() }} />
          <PropBtn icon={ICONS.italic} label="I" dm={dm} active={selectedObject.fontStyle === 'italic'}
            onClick={() => { saveUndoState(); selectedObject.set('fontStyle', selectedObject.fontStyle === 'italic' ? 'normal' : 'italic'); canvasRef.current?.requestRenderAll() }} />
          <div className="w-px h-5 mx-0.5" style={{ background: dm ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
        </>
      )}
      <PropBtn icon={ICONS.duplicate} label="Dup" dm={dm}
        onClick={() => { if (duplicateSelected) duplicateSelected() }} />
      <PropBtn icon={ICONS.forward} label="Fwd" dm={dm}
        onClick={() => { if (bringForward) bringForward() }} />
      <PropBtn icon={ICONS.backward} label="Bwd" dm={dm}
        onClick={() => { if (sendBackward) sendBackward() }} />
      <div className="w-px h-5 mx-0.5" style={{ background: dm ? 'rgba(255,255,255,0.1)' : '#e5e7eb' }} />
      <PropBtn icon={ICONS.trash} label="Del" dm={dm} danger
        onClick={() => { if (deleteSelected) deleteSelected() }} />
    </div>
  )
}

// ─── "More" Panel Content ────────────────────────────────────────────────────
export function MorePanelContent({ canvasState, darkMode, onAction }) {
  const dm = !!darkMode
  const actions = [
    { id: 'icons', label: 'Icons', icon: ICONS.icons, desc: 'Material icons library' },
    { id: 'lobsters', label: 'Lobsters', icon: ICONS.lobster, desc: 'Stock lobster images' },
    { id: 'download', label: 'Download', icon: ICONS.download, desc: 'Export PNG, PDF, MP4' },
    { id: 'canvas-size', label: 'Canvas Size', icon: ICONS.canvasSize, desc: 'Change artboard dimensions' },
  ]

  return (
    <div className="p-3 flex flex-col gap-2">
      {actions.map(a => (
        <button
          key={a.id}
          className="flex items-center gap-3 p-3 rounded-xl transition-colors text-left w-full"
          style={{
            background: dm ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            border: dm ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e5e7eb',
            color: dm ? '#e5e7eb' : '#374151',
          }}
          onClick={() => onAction(a.id)}
        >
          <span style={{ color: dm ? '#60a5fa' : '#3b82f6', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {a.icon}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{a.label}</span>
            <span className="text-[11px]" style={{ color: dm ? '#6b7280' : '#9ca3af' }}>{a.desc}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Helper button components ────────────────────────────────────────────────

function MobileIconBtn({ icon, label, onClick, dm, active }) {
  return (
    <button
      className="flex items-center justify-center rounded-lg transition-colors"
      style={{
        width: 36,
        height: 36,
        color: active ? (dm ? '#60a5fa' : '#3b82f6') : (dm ? '#9ca3af' : '#6b7280'),
        background: active ? (dm ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.1)') : 'transparent',
      }}
      onClick={onClick}
      title={label}
    >
      {icon}
    </button>
  )
}

function PropBtn({ icon, label, onClick, dm, active, danger }) {
  return (
    <button
      className="flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors shrink-0"
      style={{
        minWidth: 44,
        height: 40,
        color: danger
          ? '#ef4444'
          : active
            ? (dm ? '#60a5fa' : '#3b82f6')
            : (dm ? '#d1d5db' : '#374151'),
        background: active
          ? (dm ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.08)')
          : 'transparent',
      }}
      onClick={onClick}
    >
      {icon || <span className="text-xs font-bold">{label}</span>}
      {label && icon && <span className="text-[8px] font-medium leading-none">{label}</span>}
    </button>
  )
}

// ─── SVG Icon constants ──────────────────────────────────────────────────────
const ICONS = {
  undo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  redo: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>,
  select: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>,
  text: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7V4h16v3" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /></svg>,
  shapes: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><circle cx="17.5" cy="6.5" r="3.5" /><path d="M14 14l3.5 7 3.5-7z" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>,
  layers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
  more: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>,
  icons: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2" /><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2" /></svg>,
  lobster: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 19c-3 0-5.5-1-7-3 1-1 2-3 2-5s-1-4-2-5c1.5-2 4-3 7-3s5.5 1 7 3c-1 1-2 3-2 5s1 4 2 5c-1.5 2-4 3-7 3z" /><circle cx="10" cy="10" r="1" fill="currentColor" /><circle cx="14" cy="10" r="1" fill="currentColor" /></svg>,
  download: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  canvasSize: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M3 9h18" /></svg>,
  darkMode: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>,
  bold: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>,
  italic: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>,
  duplicate: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  forward: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="12" height="12" rx="1" opacity="0.4" /><rect x="4" y="10" width="12" height="12" rx="1" /></svg>,
  backward: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="12" height="12" rx="1" opacity="0.4" /><rect x="8" y="2" width="12" height="12" rx="1" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
}
