import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ActiveSelection, FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import ColorPicker, { buildPatternFromImage, addRecentImageFill } from './ColorPicker'
import BloodFill from './BloodFill'
import { reconcileTokens } from '../utils/tokenizer'

const SHAPE_LABELS = {
  rect: 'Rectangle',
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  polygon: 'Polygon',
  path: 'Shape',
}

function getObjectLabel(obj) {
  if (obj._dtoolLayerName) return obj._dtoolLayerName
  const lt = (obj.type || '').toLowerCase()
  if (lt === 'textbox' || lt === 'i-text' || lt === 'text') {
    const t = (obj.text || '').substring(0, 24)
    return t || 'Empty Text'
  }
  if (lt === 'image') return 'Image'
  if (lt === 'group' && obj._dtoolMaskGroup) return 'Mask Group'
  if (lt === 'group') return 'Group'
  return SHAPE_LABELS[lt] || obj.type || 'Object'
}

function getMaskedChildLabel(obj) {
  if (obj._dtoolMaskShape) return 'Mask Shape'
  if (obj._dtoolMaskedContent || obj._dtoolMaskedImage) {
    const lt = (obj.type || '').toLowerCase()
    if (lt === 'image') return 'Masked Image'
    if (lt === 'group') return 'Masked Group'
    return 'Masked ' + (SHAPE_LABELS[lt] || 'Object')
  }
  return getObjectLabel(obj)
}

function MaskThumbnail({ group, onSelect, onRemoveMask, dm }) {
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs || !group) return
    const ctx = cvs.getContext('2d')
    const SIZE = 20
    cvs.width = SIZE
    cvs.height = SIZE
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, SIZE, SIZE)

    const maskChild = (group._objects || []).find(c => c._dtoolMaskShape)
    if (!maskChild) return

    const w = maskChild.width || 0
    const h = maskChild.height || 0
    const sx = maskChild.scaleX || 1
    const sy = maskChild.scaleY || 1
    const vw = w * sx
    const vh = h * sy
    if (!vw || !vh) return

    const fitScale = Math.min((SIZE - 4) / vw, (SIZE - 4) / vh)

    ctx.save()
    ctx.translate(SIZE / 2, SIZE / 2)
    if (maskChild.angle) ctx.rotate((maskChild.angle * Math.PI) / 180)
    ctx.scale(fitScale * sx, fitScale * sy)

    ctx.fillStyle = '#ffffff'

    const t = (maskChild.type || '').toLowerCase()
    if (t === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, maskChild.radius || 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (t === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(0, 0, maskChild.rx || 0, maskChild.ry || 0, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (t === 'path' && maskChild.path) {
      const pathStr = maskChild.path.map(seg => seg.join(' ')).join(' ')
      const p2d = new Path2D(pathStr)
      ctx.translate(-w / 2, -h / 2)
      ctx.fill(p2d)
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h)
    }
    ctx.restore()
  }, [group, group?._objects])

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <canvas
        ref={canvasRef}
        width={20}
        height={20}
        className="shrink-0 rounded-sm cursor-pointer"
        style={{
          border: hovered ? '1px solid rgba(59,130,246,0.7)' : '1px solid rgba(128,128,128,0.3)',
          imageRendering: 'auto',
        }}
        title="Click to select mask group"
        onClick={(e) => { e.stopPropagation(); onSelect?.() }}
      />
      {hovered && onRemoveMask && (
        <button
          className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white ${
            dm ? 'bg-red-500 hover:bg-red-400' : 'bg-red-500 hover:bg-red-600'
          }`}
          style={{ fontSize: 8, lineHeight: 1 }}
          onClick={(e) => { e.stopPropagation(); onRemoveMask() }}
          title="Remove mask (keeps image)"
        >
          ×
        </button>
      )}
    </div>
  )
}

function TypeIcon({ type, obj }) {
  if (type === 'textbox' || type === 'i-text' || type === 'text') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3" /><path d="M12 4v16" /><path d="M8 20h8" />
      </svg>
    )
  }
  if (type === 'image') {
    if (obj?._dtoolAnimated || obj?._dtoolMediaType) {
      return <MotionIcon />
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    )
  }
  if (type === 'circle' || type === 'ellipse') {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
  }
  if (type === 'triangle') {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,3 2,21 22,21" /></svg>
  }
  if (type === 'group' && obj?._dtoolMaskGroup) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="12" cy="12" r="5" />
        <path d="M21 15l-5-5L5 21" strokeOpacity="0.5" />
      </svg>
    )
  }
  if (type === 'group') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="14" width="8" height="8" rx="1" />
        <path d="M6 14v-2h2M18 10v2h-2" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
    </svg>
  )
}

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function LockIcon({ locked }) {
  if (locked) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </svg>
  )
}

function AudioIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function MotionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a1 1 0 001-1V9H3v10a1 1 0 001 1z" />
      <path d="M3 9h18V7H3v2z" />
      <path d="M7 7l2-4h2l-2 4" />
      <path d="M13 7l2-4h2l-2 4" />
    </svg>
  )
}

function BgLayerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </svg>
  )
}

function lockObject(obj, locked) {
  obj.set({
    lockMovementX: locked,
    lockMovementY: locked,
    lockRotation: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    hasControls: !locked,
  })
}

function fillObjectToCanvas(obj, cw, ch) {
  const ow = obj.width || 100
  const oh = obj.height || 100
  if (obj._dtoolTileMode && obj._dtoolTileMode !== 'none') return
  const scale = Math.max(cw / ow, ch / oh)
  obj.set({
    left: cw / 2,
    top: ch / 2,
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale,
  })
  obj.setCoords()
}

export function addObjectToBackground(canvas, obj, canvasW, canvasH) {
  obj._dtoolBgLayer = true
  if (!obj._dtoolId) obj._dtoolId = uuidv4()
  if (!obj._dtoolTileMode || obj._dtoolTileMode === 'none') {
    fillObjectToCanvas(obj, canvasW, canvasH)
  }
  lockObject(obj, true)

  const bgCount = canvas.getObjects().filter(o => o._dtoolBgLayer).length
  canvas.insertAt(bgCount, obj)
  obj.setCoords()
}

function DropIndicatorLine({ dm }) {
  return (
    <div className="relative h-0 w-full z-10 pointer-events-none">
      <div className={`absolute left-2 right-2 border-t-2 ${dm ? 'border-blue-400' : 'border-blue-500'}`} style={{ top: -1 }}>
        <div className={`absolute -left-1 -top-[5px] w-[8px] h-[8px] rounded-full ${dm ? 'bg-blue-400' : 'bg-blue-500'}`} />
      </div>
    </div>
  )
}

export default function LayersPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, canvasObjects, selectedObject, setSelectedObject, saveUndoState, refreshObjects, bgColor, setBgColor, applyBgFill, setTokensForObject,
    audioTracks, playAudioTrack, pauseAudioTrack, stopAudioTrack, setAudioVolume, canvasW, canvasH, addAsset, bloodRain } = canvasState
  const [dragIdx, setDragIdx] = useState(null)
  const [dropSlot, setDropSlot] = useState(null) // { slot: number } — insertion point between/around items
  const [, forceUpdate] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef(null)
  const clickTimerRef = useRef(null)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const panelRef = useRef(null)

  const [bgExpanded, setBgExpanded] = useState(true)
  const [bgDragOver, setBgDragOver] = useState(false)

  const isTextType = (o) => {
    const t = (o.type || '').toLowerCase()
    return t === 'textbox' || t === 'i-text' || t === 'text'
  }

  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const canvas = canvasRef.current
  void canvasObjects // trigger re-render when canvas objects change
  const allCanvasObjs = canvas ? canvas.getObjects().filter(o => !o._dtoolTileClone && !o._dtoolTilePatternRect) : []
  const bgObjects = allCanvasObjs.filter(o => o._dtoolBgLayer).reverse()
  const objects = allCanvasObjs.filter(o => !o._dtoolBgLayer).slice().reverse()

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const syncCanvasSelection = useCallback((ids) => {
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => ids.has(o._dtoolId))
    if (objs.length === 0) {
      canvas.discardActiveObject()
      setSelectedObject(null)
    } else if (objs.length === 1) {
      canvas.setActiveObject(objs[0])
      setSelectedObject(objs[0])
    } else {
      const sel = new ActiveSelection(objs, { canvas })
      canvas.setActiveObject(sel)
      setSelectedObject(sel)
    }
    canvas.renderAll()
  }, [canvas, setSelectedObject])

  const handleSelect = (obj) => {
    if (!canvas) return
    const id = obj._dtoolId
    const newIds = new Set([id])
    setSelectedIds(newIds)
    if (obj.group && obj.group.type === 'group') {
      obj.group.interactive = true
      obj.group.subTargetCheck = true
    }
    if (obj.type === 'group') {
      obj.interactive = false
      obj.subTargetCheck = false
    }
    canvas.setActiveObject(obj)
    canvas.renderAll()
    setSelectedObject(obj)
  }

  const handleRowClick = (obj, objKey, e) => {
    const id = obj._dtoolId
    if (e.ctrlKey || e.metaKey) {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
      if (obj.lockMovementX && !obj._dtoolBgLayer) return
      const newIds = new Set(selectedIds)
      if (newIds.has(id)) newIds.delete(id)
      else newIds.add(id)
      setSelectedIds(newIds)
      syncCanvasSelection(newIds)
      return
    }
    if (e.shiftKey && selectedIds.size > 0) {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
      const allIds = objects.map(o => o._dtoolId)
      const lastSelected = [...selectedIds].pop()
      const lastIdx = allIds.indexOf(lastSelected)
      const curIdx = allIds.indexOf(id)
      if (lastIdx >= 0 && curIdx >= 0) {
        const from = Math.min(lastIdx, curIdx)
        const to = Math.max(lastIdx, curIdx)
        const newIds = new Set(selectedIds)
        for (let j = from; j <= to; j++) {
          const o = objects[j]
          if (!o.lockMovementX) newIds.add(allIds[j])
        }
        setSelectedIds(newIds)
        syncCanvasSelection(newIds)
      }
      return
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      setEditingId(objKey)
      setEditValue(isTextType(obj) ? (obj.text || '') : (obj._dtoolLayerName || ''))
      setTimeout(() => editInputRef.current?.select(), 0)
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        handleSelect(obj)
      }, 250)
    }
  }

  const handleDeleteSelected = useCallback(() => {
    if (!canvas || selectedIds.size === 0) return
    saveUndoState()
    const objs = canvas.getObjects().filter(o => selectedIds.has(o._dtoolId))
    canvas.discardActiveObject()
    objs.forEach(o => canvas.remove(o))
    canvas.renderAll()
    setSelectedIds(new Set())
    setSelectedObject(null)
    refreshObjects()
  }, [canvas, selectedIds, saveUndoState, setSelectedObject, refreshObjects])

  useEffect(() => {
    if (!selectedObject) {
      setSelectedIds(new Set())
    } else if (selectedObject.type === 'activeselection' && selectedObject._objects) {
      setSelectedIds(new Set(selectedObject._objects.map(o => o._dtoolId).filter(Boolean)))
    } else if (selectedObject._dtoolId) {
      setSelectedIds(new Set([selectedObject._dtoolId]))
    }
  }, [selectedObject])

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const handleKeyDown = (e) => {
      if (editingId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault()
          e.stopPropagation()
          handleDeleteSelected()
        }
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [editingId, selectedIds, handleDeleteSelected])

  const toggleVisibility = (e, obj) => {
    e.stopPropagation()
    if (!canvas) return
    obj.set('visible', !obj.visible)
    canvas.renderAll()
    forceUpdate(n => n + 1)
  }

  const toggleLock = (e, obj) => {
    e.stopPropagation()
    if (!canvas) return
    const locked = !obj.lockMovementX
    lockObject(obj, locked)
    obj.set({ selectable: true, evented: true })
    canvas.renderAll()
    if (locked && selectedObject === obj) {
      canvas.discardActiveObject()
      canvas.renderAll()
      setSelectedObject(null)
    }
    forceUpdate(n => n + 1)
  }

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }

  const handleRowDragOver = (e, idx) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const slot = e.clientY < midY ? idx : idx + 1
    if (slot !== dropSlot?.slot) setDropSlot({ slot })
  }

  const handleListDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (objects.length === 0 && dragIdx == null) return
    const lastSlot = objects.length
    if (dropSlot?.slot !== lastSlot) setDropSlot({ slot: lastSlot })
  }

  const executeReorder = (slot) => {
    if (dragIdx === null || !canvas) return
    let targetSlot = slot
    if (targetSlot === dragIdx || targetSlot === dragIdx + 1) return

    saveUndoState()
    const nonBg = allCanvasObjs.filter(o => !o._dtoolBgLayer)
    const panelFrom = dragIdx
    const canvasFrom = nonBg.length - 1 - panelFrom

    const obj = nonBg[canvasFrom]
    if (!obj) return

    if (targetSlot > dragIdx) targetSlot -= 1

    const canvasTo = nonBg.length - 1 - targetSlot
    const bgCount = canvas.getObjects().filter(o => o._dtoolBgLayer).length

    obj._dtoolReordering = true
    canvas.remove(obj)
    delete obj._dtoolReordering
    const maxIdx = canvas.getObjects().length
    const insertIdx = Math.max(bgCount, Math.min(bgCount + canvasTo, maxIdx))
    canvas.insertAt(insertIdx, obj)

    canvas.renderAll()
    refreshObjects()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (dropSlot !== null && dragIdx !== null) {
      executeReorder(dropSlot.slot)
    }
    setDragIdx(null)
    setDropSlot(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDropSlot(null)
    setBgDragOver(false)
  }

  const handleBgDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setBgDragOver(true)
    setDropSlot(null)
  }

  const handleBgDragLeave = () => {
    setBgDragOver(false)
  }

  const moveObjectToBackground = useCallback((obj) => {
    if (!canvas) return
    saveUndoState()
    obj._dtoolReordering = true
    canvas.remove(obj)
    delete obj._dtoolReordering
    obj._dtoolBgLayer = true
    if (!obj._dtoolTileMode || obj._dtoolTileMode === 'none') {
      fillObjectToCanvas(obj, canvasW, canvasH)
    }
    lockObject(obj, true)
    const bgCount = canvas.getObjects().filter(o => o._dtoolBgLayer).length
    canvas.insertAt(bgCount, obj)
    obj.setCoords()
    canvas.discardActiveObject()
    canvas.renderAll()
    refreshObjects()
    setSelectedObject(null)
    setBgExpanded(true)
  }, [canvas, canvasW, canvasH, saveUndoState, refreshObjects, setSelectedObject])

  const handleBgDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setBgDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          const assetId = addAsset ? addAsset(file, dataUrl) : null
          const imgEl = new window.Image()
          imgEl.onload = () => {
            if (!canvas) return
            saveUndoState()
            const fabricImg = new FabricImage(imgEl, {
              _dtoolId: uuidv4(),
              _dtoolAssetId: assetId,
              objectCaching: false,
            })
            addObjectToBackground(canvas, fabricImg, canvasW, canvasH)
            canvas.renderAll()
            refreshObjects()
            setBgExpanded(true)
          }
          imgEl.src = dataUrl
        }
        reader.readAsDataURL(file)
        return
      }
    }

    if (dragIdx !== null && canvas) {
      const nonBg = allCanvasObjs.filter(o => !o._dtoolBgLayer)
      const fromCanvasIdx = nonBg.length - 1 - dragIdx
      const obj = nonBg[fromCanvasIdx]
      if (obj) moveObjectToBackground(obj)
    }
    setDragIdx(null)
    setDropSlot(null)
  }, [dragIdx, canvas, allCanvasObjs, canvasW, canvasH, saveUndoState, refreshObjects, addAsset, moveObjectToBackground])

  const removeFromBackground = useCallback((obj) => {
    if (!canvas) return
    saveUndoState()
    delete obj._dtoolBgLayer
    lockObject(obj, false)
    obj.set({ selectable: true, evented: true })
    obj._dtoolReordering = true
    canvas.remove(obj)
    delete obj._dtoolReordering
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.renderAll()
    refreshObjects()
    setSelectedObject(obj)
  }, [canvas, saveUndoState, refreshObjects, setSelectedObject])

  const bgUndoSaved = useRef(false)
  const bgStartGesture = useCallback(() => {
    if (!bgUndoSaved.current) {
      saveUndoState()
      bgUndoSaved.current = true
      setTimeout(() => { bgUndoSaved.current = false }, 500)
    }
  }, [saveUndoState])

  const bgGradientTarget = { width: canvasW || 500, height: canvasH || 700 }

  const handleBgImageFill = useCallback((imgElement, mode, dataUrl) => {
    bgStartGesture()
    addRecentImageFill(dataUrl)
    const pattern = buildPatternFromImage(imgElement, mode, canvasW || 500, canvasH || 700)
    applyBgFill(pattern)
  }, [bgStartGesture, applyBgFill, canvasW, canvasH])

  const handleBgChange = useCallback((val) => {
    applyBgFill(val)
  }, [applyBgFill])

  return (
    <div ref={panelRef} tabIndex={-1} className={`w-64 border-r flex flex-col shrink-0 relative z-10 outline-none ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>Layers</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {objects.length === 0 && bgObjects.length === 0 ? (
          <div className="p-3">
            <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>No objects on canvas</p>
          </div>
        ) : (
          <div className="py-0.5 pb-6" onDragOver={handleListDragOver} onDrop={handleDrop}>
            {objects.map((obj, i) => {
              const isGroup = obj.type === 'group'
              const isExpanded = isGroup && expandedGroups.has(obj._dtoolId)
              const isSelected = selectedIds.has(obj._dtoolId) || selectedObject === obj || (selectedObject?.type === 'activeselection' && selectedObject?._objects?.includes(obj))
              const isHidden = obj.visible === false
              const isLocked = obj.lockMovementX === true
              const showSlotAbove = dragIdx !== null && dropSlot?.slot === i && i !== dragIdx && i !== dragIdx + 1

              const renderRow = (rowObj, rowKey, depth = 0, topIdx = null, parentObj = null) => {
                const rSelected = selectedIds.has(rowObj._dtoolId) || selectedObject === rowObj || (selectedObject?.type === 'activeselection' && selectedObject?._objects?.includes(rowObj))
                const rHidden = rowObj.visible === false
                const rLocked = rowObj.lockMovementX === true
                const rIsGroup = rowObj.type === 'group'
                const rExpanded = rIsGroup && expandedGroups.has(rowObj._dtoolId)

                return (
                  <div
                    key={rowKey}
                    className={`
                      flex items-center gap-1.5 py-1.5 cursor-pointer text-xs transition-colors
                      ${rSelected ? (dm ? 'bg-gray-600 text-gray-100' : 'bg-gray-200 text-gray-800') : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}
                      ${dragIdx === (topIdx ?? i) && depth === 0 ? 'opacity-40' : ''}
                      ${rHidden ? 'opacity-40' : ''}
                    `}
                    style={{ paddingLeft: 8 + depth * 16, paddingRight: 8 }}
                    onClick={(e) => handleRowClick(rowObj, rowKey, e)}
                    draggable={depth === 0}
                    onDragStart={depth === 0 ? (e) => handleDragStart(e, topIdx ?? i) : undefined}
                    onDragOver={depth === 0 ? (e) => handleRowDragOver(e, topIdx ?? i) : undefined}
                    onDragEnd={depth === 0 ? handleDragEnd : undefined}
                  >
                    {depth === 0 && (
                      <span className={`cursor-grab shrink-0 ${dm ? 'text-gray-500 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'}`} title="Drag to reorder">
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                          <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
                          <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                          <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
                        </svg>
                      </span>
                    )}

                    {rIsGroup && (
                      <button
                        className={`shrink-0 transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                        onClick={(e) => { e.stopPropagation(); toggleGroupExpand(rowObj._dtoolId) }}
                        title={rExpanded ? 'Collapse' : 'Expand'}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transform: rExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                          <polygon points="2,1 8,5 2,9" />
                        </svg>
                      </button>
                    )}

                    <button
                      className={`shrink-0 transition-colors ${dm ? 'text-gray-500 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'}`}
                      onClick={(e) => toggleVisibility(e, rowObj)}
                      title={rHidden ? 'Show' : 'Hide'}
                    >
                      <EyeIcon visible={!rHidden} />
                    </button>

                    <button
                      className={`shrink-0 transition-colors ${rLocked ? 'text-red-400 hover:text-red-600' : (dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-300 hover:text-gray-500')}`}
                      onClick={(e) => toggleLock(e, rowObj)}
                      title={rLocked ? 'Unlock' : 'Lock'}
                    >
                      <LockIcon locked={rLocked} />
                    </button>

                    <span className={`shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      <TypeIcon type={rowObj.type} obj={rowObj} />
                    </span>

                    {editingId === rowKey ? (
                      <input
                        ref={editInputRef}
                        className={`flex-1 min-w-0 text-xs border rounded px-1 py-0 outline-none ${dm ? 'bg-gray-700 border-gray-600 text-gray-100 focus:border-gray-500' : 'bg-white border-gray-300 focus:border-gray-500'}`}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          const trimmed = editValue.trim()
                          if (isTextType(rowObj)) {
                            if (trimmed && trimmed !== rowObj.text) {
                              saveUndoState()
                              const hasFixedHeight = rowObj._dtoolOverflow === 'shrink' || rowObj._dtoolOverflow === 'clip'
                              const savedH = hasFixedHeight ? rowObj.height : null
                              rowObj.set('text', trimmed)
                              if (rowObj._dtoolTokens && rowObj._dtoolTokens.length > 0) {
                                const reconciled = reconcileTokens(rowObj._dtoolTokens, trimmed)
                                rowObj._dtoolTokens = reconciled
                                if (rowObj._dtoolId) setTokensForObject(rowObj._dtoolId, reconciled)
                              }
                              rowObj.dirty = true
                              rowObj.initDimensions?.()
                              if (savedH !== null) rowObj.height = savedH
                              rowObj.setCoords()
                              canvas?.renderAll()
                              refreshObjects()
                            }
                          } else {
                            rowObj._dtoolLayerName = trimmed || undefined
                          }
                          setEditingId(null)
                          forceUpdate(n => n + 1)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur()
                          if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="truncate flex-1 min-w-0">
                        {parentObj?._dtoolMaskGroup ? getMaskedChildLabel(rowObj) : getObjectLabel(rowObj)}
                      </span>
                    )}

                    {rowObj._dtoolMaskGroup && (
                      <MaskThumbnail
                        group={rowObj}
                        dm={dm}
                        onSelect={() => handleSelect(rowObj)}
                        onRemoveMask={() => {
                          if (canvasState.removeMaskFromGroup) canvasState.removeMaskFromGroup(rowObj)
                        }}
                      />
                    )}

                    {i === 0 && depth === 0 && (
                      <span className={`text-[9px] shrink-0 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>top</span>
                    )}
                  </div>
                )
              }

              return (
                <React.Fragment key={obj._dtoolId || i}>
                  {showSlotAbove && <DropIndicatorLine dm={dm} />}
                  {renderRow(obj, obj._dtoolId || i, 0, i)}
                  {isGroup && isExpanded && (obj.getObjects?.() || []).slice().reverse()
                    .filter(child => !(obj._dtoolMaskGroup && child._dtoolMaskShape))
                    .map((child, ci) =>
                      renderRow(child, `${obj._dtoolId}-child-${ci}`, 1, i, obj)
                    )}
                </React.Fragment>
              )
            })}
            {dragIdx !== null && dropSlot?.slot === objects.length && dropSlot.slot !== dragIdx && dropSlot.slot !== dragIdx + 1 && (
              <DropIndicatorLine dm={dm} />
            )}
          </div>
        )}
      </div>

      {audioTracks && audioTracks.length > 0 && (
        <div className={`border-t px-2 py-1.5 shrink-0 ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-1 mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <AudioIcon />
            <span>Audio</span>
          </div>
          {audioTracks.map(track => (
            <div
              key={track.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                track.playing
                  ? (dm ? 'bg-blue-900/30' : 'bg-blue-50')
                  : (dm ? 'hover:bg-gray-700/60' : 'hover:bg-gray-50')
              }`}
            >
              <button
                onClick={() => track.playing ? pauseAudioTrack(track.id) : playAudioTrack(track.id)}
                className={`w-5 h-5 flex items-center justify-center rounded-full shrink-0 transition-colors ${
                  track.playing
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : (dm ? 'bg-gray-600 text-gray-400 hover:bg-gray-500' : 'bg-gray-200 text-gray-500 hover:bg-gray-300')
                }`}
                title={track.playing ? 'Pause' : 'Play'}
              >
                {track.playing ? (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="8,4 20,12 8,20" />
                  </svg>
                )}
              </button>
              <span className={`shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}><AudioIcon /></span>
              <span className={`truncate flex-1 min-w-0 text-[11px] ${
                track.playing
                  ? (dm ? 'text-blue-300 font-medium' : 'text-blue-700 font-medium')
                  : (dm ? 'text-gray-300' : 'text-gray-600')
              }`}>
                {track.name || 'Audio'}
              </span>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={track.volume}
                onChange={(e) => setAudioVolume(track.id, parseFloat(e.target.value))}
                className={`w-12 h-1 shrink-0 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                title={`Volume: ${Math.round(track.volume * 100)}%`}
              />
              <button
                onClick={() => stopAudioTrack(track.id)}
                className={`w-4 h-4 flex items-center justify-center transition-colors shrink-0 ${dm ? 'text-gray-500 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
                title="Remove"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
                  <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Background layer section */}
      <div
        className={`border-t shrink-0 transition-colors ${
          bgDragOver
            ? (dm ? 'ring-2 ring-inset ring-blue-500 bg-blue-900/20' : 'ring-2 ring-inset ring-blue-400 bg-blue-50/50')
            : ''
        } ${dm ? 'border-gray-700' : 'border-gray-200'}`}
        onDragOver={handleBgDragOver}
        onDragLeave={handleBgDragLeave}
        onDrop={handleBgDrop}
      >
        <div
          className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer ${dm ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setBgExpanded(!bgExpanded)}
        >
          <button
            className={`shrink-0 transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={(e) => { e.stopPropagation(); setBgExpanded(!bgExpanded) }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ transform: bgExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <polygon points="2,1 8,5 2,9" />
            </svg>
          </button>
          <BgLayerIcon />
          <span className="font-medium text-xs">Background</span>
          {bgObjects.length > 0 && (
            <span className={`text-[9px] ml-auto ${dm ? 'text-gray-500' : 'text-gray-300'}`}>{bgObjects.length}</span>
          )}
        </div>

        {bgExpanded && (
          <div className="pb-1.5">
            <div className="px-3 pb-1.5">
              <ColorPicker
                value={bgColor || ''}
                onChange={handleBgChange}
                allowNoColor={true}
                popoverDirection="up"
                startGesture={bgStartGesture}
                enableGradient={true}
                gradientTarget={bgGradientTarget}
                onImageFill={handleBgImageFill}
                dm={dm}
              />
            </div>

            {bgObjects.map((obj, bi) => {
              const isSelected = selectedIds.has(obj._dtoolId) || selectedObject === obj
              const isHidden = obj.visible === false
              const isLocked = obj.lockMovementX === true
              return (
                <div
                  key={obj._dtoolId || `bg-${bi}`}
                  className={`
                    flex items-center gap-1.5 py-1 cursor-pointer text-xs transition-colors
                    ${isSelected ? (dm ? 'bg-gray-600 text-gray-100' : 'bg-gray-200 text-gray-800') : (dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}
                    ${isHidden ? 'opacity-40' : ''}
                  `}
                  style={{ paddingLeft: 24, paddingRight: 8 }}
                  onClick={(e) => { e.stopPropagation(); handleSelect(obj) }}
                >
                  <button
                    className={`shrink-0 transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
                    onClick={(e) => toggleVisibility(e, obj)}
                    title={isHidden ? 'Show' : 'Hide'}
                  >
                    <EyeIcon visible={!isHidden} />
                  </button>

                  <button
                    className={`shrink-0 transition-colors ${isLocked ? 'text-orange-400 hover:text-orange-600' : (dm ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500')}`}
                    onClick={(e) => toggleLock(e, obj)}
                    title={isLocked ? 'Unlock' : 'Lock'}
                  >
                    <LockIcon locked={isLocked} />
                  </button>

                  <span className={`shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                    <TypeIcon type={obj.type} obj={obj} />
                  </span>

                  <span className="truncate flex-1 min-w-0">
                    {getObjectLabel(obj)}
                  </span>

                  <button
                    className={`shrink-0 transition-colors ${dm ? 'text-gray-600 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
                    onClick={(e) => { e.stopPropagation(); removeFromBackground(obj) }}
                    title="Move to layers"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              )
            })}

            {bgObjects.length === 0 && (
              <div className={`px-3 py-1 text-[10px] ${dm ? 'text-gray-500' : 'text-gray-300'}`}>
                Drag images or objects here
              </div>
            )}
          </div>
        )}
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
