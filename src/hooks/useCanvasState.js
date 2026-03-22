import { useState, useRef, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ActiveSelection, Group, cache } from 'fabric'
import { DEFAULT_CANVAS_W, DEFAULT_CANVAS_H } from '../constants/canvas'
import { findTilingMaster, refreshTileClones, removeTiling, removeOrphanedTileClones } from '../utils/tiling'

const PASTEBOARD = 300

const CUSTOM_PROPS = ['_dtoolId', '_dtoolAssetId', '_dtoolTokens', '_dtoolCurveAmount', '_dtoolVertical', '_dtoolOrigText', '_dtoolVAnchor', '_dtoolOverflow', '_dtoolLayerName', '_dtoolTileMode', '_dtoolTileClone', '_dtoolTileMasterId', '_dtoolTilePatternRect', '_dtoolExpandedTiles', '_dtoolTileSpacing', '_dtoolTileRandomRotation', '_dtoolMaskGroup', '_dtoolMaskShape', '_dtoolMaskedContent', '_dtoolMaskLinked', '_dtoolMaskImageUrl']

function patchMaskGroupRender(group) {
  if (!group._dtoolMaskGroup || group._dtoolMaskRenderPatched) return
  group._renderStroke = function () {}
  const origRender = group.render.bind(group)
  group.render = function (ctx) {
    origRender(ctx)
    if (!this.stroke || !this.strokeWidth || this.strokeWidth <= 0) return
    const shape = this.clipPath
    if (!shape) return
    ctx.save()
    this.transform(ctx)
    shape.transform(ctx)
    const savedFill = shape.fill
    const savedStroke = shape.stroke
    shape.fill = 'transparent'
    shape.stroke = null
    ctx.beginPath()
    shape._render(ctx)
    shape.fill = savedFill
    shape.stroke = savedStroke
    ctx.strokeStyle = this.stroke
    const sx = Math.abs(this.scaleX || 1)
    const sy = Math.abs(this.scaleY || 1)
    const avg = (sx + sy) / 2
    ctx.lineWidth = this.strokeWidth / avg
    ctx.lineCap = this.strokeLineCap || 'butt'
    ctx.lineJoin = this.strokeLineJoin || 'miter'
    if (this.strokeDashArray && this.strokeDashArray.length) {
      ctx.setLineDash(this.strokeDashArray.map(d => d / avg))
    } else {
      ctx.setLineDash([])
    }
    ctx.stroke()
    ctx.restore()
  }
  group._dtoolMaskRenderPatched = true
}

export function useCanvasState() {
  const canvasRef = useRef(null)
  const clipboardRef = useRef(null)
  const [fabricCanvas, setFabricCanvas] = useState(null)
  const [selectedObject, setSelectedObject] = useState(null)
  const [canvasObjects, setCanvasObjects] = useState([])
  const [zoom, setZoom] = useState(1)
  const [assets, setAssets] = useState([])
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const [selectedMoment, setSelectedMoment] = useState(null)
  const [objectTokens, setObjectTokens] = useState({})
  const [textSelection, setTextSelection] = useState(null)
  const [bgColor, setBgColorState] = useState('#ffffff')
  const [activeTool, setActiveTool] = useState('select')
  const [blobBrushSize, setBlobBrushSize] = useState(20)
  const [blobBrushColor, setBlobBrushColor] = useState('#8B0000')
  const [blobBrushShape, setBlobBrushShape] = useState('circle')
  const [blobBrushAngle, setBlobBrushAngle] = useState(45)
  const [autoplay, setAutoplay] = useState(true)
  const [canvasW, setCanvasW] = useState(DEFAULT_CANVAS_W)
  const [canvasH, setCanvasH] = useState(DEFAULT_CANVAS_H)
  const [penSubTool, setPenSubTool] = useState('pen')
  const [penStrokeColor, setPenStrokeColor] = useState('#8B0000')
  const [penFillColor, setPenFillColor] = useState('transparent')
  const [penStrokeWidth, setPenStrokeWidth] = useState(2)
  const [penDashArray, setPenDashArray] = useState([])
  const [penLineCap, setPenLineCap] = useState('butt')
  const [penLineJoin, setPenLineJoin] = useState('miter')
  const [penOpacity, setPenOpacity] = useState(1)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('dtool-dark-mode') !== 'false' } catch { return true }
  })

  const [canvasUnit, setCanvasUnit] = useState('in')
  const [canvasDpi, setCanvasDpi] = useState(100)
  const [showCheckerboard, setShowCheckerboard] = useState(false)
  const [bloodRain, setBloodRain] = useState(false)
  const [laserSmoke, setLaserSmoke] = useState(false)

  const [printerMarks, setPrinterMarks] = useState({
    bleedLine: false,
    cutLine: false,
    safeArea: false,
    cropMarks: false,
    registrationMarks: false,
    colorBars: false,
    gridLines: false,
    bleedTop: 9,
    bleedRight: 9,
    bleedBottom: 9,
    bleedLeft: 9,
    safeTop: 9,
    safeRight: 9,
    safeBottom: 9,
    safeLeft: 9,
  })

  const fitToViewRef = useRef(null)
  const createMaskRef = useRef(null)
  const removeMaskRef = useRef(null)
  const syncMaskClipPathRef = useRef(null)

  const addAsset = useCallback((file, dataUrl, thumbnail, source) => {
    const id = uuidv4()
    setAssets(prev => [...prev, { id, file, dataUrl, thumbnail: thumbnail || null, filename: file.name, source: source || 'internal' }])
    return id
  }, [])

  const removeAsset = useCallback((assetId) => {
    setAssets(prev => prev.filter(a => a.id !== assetId))
  }, [])

  const refreshObjects = useCallback(() => {
    if (!canvasRef.current) return
    const objs = canvasRef.current.getObjects().map(o => ({
      id: o._dtoolId,
      type: o.type,
      text: o.text || o.get?.('text'),
    }))
    setCanvasObjects(objs)
  }, [])

  const saveUndoState = useCallback(() => {
    if (!canvasRef.current) return
    const json = canvasRef.current.toJSON(CUSTOM_PROPS)
    undoStackRef.current = [...undoStackRef.current.slice(-30), json]
    redoStackRef.current = []
    setHistoryVersion(v => v + 1)
  }, [])

  const applyBgFill = useCallback((fill) => {
    const c = canvasRef.current
    if (!c) return
    if (!fill || fill === '' || fill === 'transparent') {
      c.backgroundColor = 'transparent'
      setBgColorState('')
    } else {
      c.backgroundColor = fill
      setBgColorState(fill)
    }
    c.renderAll()
  }, [])

  const setBgColor = useCallback((color) => {
    saveUndoState()
    applyBgFill(color)
  }, [saveUndoState, applyBgFill])

  const getSelectedIds = () => {
    const canvas = canvasRef.current
    if (!canvas) return []
    const active = canvas.getActiveObject()
    if (!active) return []
    if (active._objects) return active._objects.map(o => o._dtoolId).filter(Boolean)
    return active._dtoolId ? [active._dtoolId] : []
  }

  const reselectByIds = (ids) => {
    const canvas = canvasRef.current
    if (!canvas || ids.length === 0) return
    const objs = canvas.getObjects().filter(o => ids.includes(o._dtoolId))
    if (objs.length === 0) return
    if (objs.length === 1) {
      canvas.setActiveObject(objs[0])
    } else {
      canvas.setActiveObject(new ActiveSelection(objs, { canvas }))
    }
    setSelectedObject(canvas.getActiveObject())
    canvas.renderAll()
  }

  const undo = useCallback(() => {
    if (!canvasRef.current || undoStackRef.current.length === 0) return
    const ids = getSelectedIds()
    const current = canvasRef.current.toJSON(CUSTOM_PROPS)
    redoStackRef.current = [...redoStackRef.current, current]
    const prev = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setHistoryVersion(v => v + 1)
    canvasRef.current.loadFromJSON(prev).then(() => {
      cache.clearFontCache()
      canvasRef.current.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
          obj._forceClearCache = true
          obj.dirty = true
        }
        if (obj._dtoolTileClone) {
          obj.selectable = false
          obj.evented = false
          obj.hasControls = false
          obj.hasBorders = false
        }
        if (obj._dtoolMaskGroup) patchMaskGroupRender(obj)
      })
      canvasRef.current.renderAll()
      refreshObjects()
      reselectByIds(ids)
      setBgColorState(canvasRef.current.backgroundColor === 'transparent' ? '' : (canvasRef.current.backgroundColor || ''))
    })
  }, [refreshObjects])

  const redo = useCallback(() => {
    if (!canvasRef.current || redoStackRef.current.length === 0) return
    const ids = getSelectedIds()
    const current = canvasRef.current.toJSON(CUSTOM_PROPS)
    undoStackRef.current = [...undoStackRef.current, current]
    const next = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    setHistoryVersion(v => v + 1)
    canvasRef.current.loadFromJSON(next).then(() => {
      cache.clearFontCache()
      canvasRef.current.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
          obj._forceClearCache = true
          obj.dirty = true
        }
        if (obj._dtoolTileClone) {
          obj.selectable = false
          obj.evented = false
          obj.hasControls = false
          obj.hasBorders = false
        }
        if (obj._dtoolMaskGroup) patchMaskGroupRender(obj)
      })
      canvasRef.current.renderAll()
      refreshObjects()
      reselectByIds(ids)
      setBgColorState(canvasRef.current.backgroundColor === 'transparent' ? '' : (canvasRef.current.backgroundColor || ''))
    })
  }, [refreshObjects])

  const getTokensForObject = useCallback((objectId) => {
    return objectTokens[objectId] || null
  }, [objectTokens])

  const setTokensForObject = useCallback((objectId, tokens) => {
    setObjectTokens(prev => ({ ...prev, [objectId]: tokens }))
    if (canvasRef.current) {
      const obj = canvasRef.current.getObjects().find(o => o._dtoolId === objectId)
      if (obj) {
        obj._dtoolTokens = tokens
        canvasRef.current.renderAll()
      }
    }
  }, [])

  const copySelected = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    obj.clone(['_dtoolId', '_dtoolAssetId', '_dtoolTokens']).then(cloned => {
      clipboardRef.current = cloned
    })
  }, [])

  const pasteFromClipboard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !clipboardRef.current) return
    clipboardRef.current.clone(['_dtoolId', '_dtoolAssetId', '_dtoolTokens']).then(cloned => {
      saveUndoState()
      canvas.discardActiveObject()
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        _dtoolId: uuidv4(),
        evented: true,
      })
      if (cloned._objects) {
        cloned.canvas = canvas
        cloned._objects?.forEach(o => {
          o._dtoolId = uuidv4()
          canvas.add(o)
        })
        cloned.setCoords()
      } else {
        canvas.add(cloned)
      }
      clipboardRef.current.set({
        left: (clipboardRef.current.left || 0) + 20,
        top: (clipboardRef.current.top || 0) + 20,
      })
      canvas.setActiveObject(cloned)
      canvas.requestRenderAll()
      refreshObjects()
    })
  }, [saveUndoState, refreshObjects])

  const cutSelected = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj || obj._dtoolTileClone) return
    saveUndoState()
    obj.clone(['_dtoolId', '_dtoolAssetId', '_dtoolTokens']).then(cloned => {
      clipboardRef.current = cloned
    })
    if (obj._objects) {
      obj._objects.filter(o => !o._dtoolTileClone).forEach(o => canvas.remove(o))
    } else {
      canvas.remove(obj)
    }
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const duplicateSelected = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    obj.clone(['_dtoolId', '_dtoolAssetId', '_dtoolTokens']).then(cloned => {
      saveUndoState()
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        _dtoolId: uuidv4(),
        evented: true,
      })
      if (cloned._objects) {
        cloned.canvas = canvas
        cloned._objects.forEach(o => {
          o._dtoolId = uuidv4()
          canvas.add(o)
        })
        cloned.setCoords()
      } else {
        canvas.add(cloned)
      }
      canvas.setActiveObject(cloned)
      canvas.requestRenderAll()
      refreshObjects()
    })
  }, [saveUndoState, refreshObjects])

  const selectAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    const objs = canvas.getObjects().filter(o => !o._dtoolTileClone)
    if (objs.length === 0) return
    if (objs.length === 1) {
      canvas.setActiveObject(objs[0])
    } else {
      const sel = new ActiveSelection(objs, { canvas })
      canvas.setActiveObject(sel)
    }
    canvas.requestRenderAll()
  }, [])

  const deselectAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }, [])

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    if (obj._dtoolTileClone) return

    if (obj._dtoolMaskShape && obj.group && obj.group._dtoolMaskGroup) {
      if (removeMaskRef.current) removeMaskRef.current(obj.group)
      return
    }

    saveUndoState()

    const parentGroup = obj.group || null
    let tileMaster = parentGroup ? findTilingMaster(parentGroup) : findTilingMaster(obj)

    if (parentGroup && !(obj instanceof ActiveSelection)) {
      parentGroup.remove(obj)
      if (parentGroup._objects && parentGroup._objects.length === 0) {
        canvas.remove(parentGroup)
      } else {
        parentGroup.setDirty()
        parentGroup.setCoords()
      }
    } else if (obj instanceof ActiveSelection && obj._objects) {
      const members = [...obj._objects].filter(o => !o._dtoolTileClone)
      const affectedGroups = new Set()
      for (const o of members) {
        if (o.group && o.group !== obj) {
          const g = o.group
          if (!tileMaster) tileMaster = findTilingMaster(g)
          g.remove(o)
          affectedGroups.add(g)
        } else {
          if (!tileMaster) tileMaster = findTilingMaster(o)
          canvas.remove(o)
        }
      }
      for (const g of affectedGroups) {
        if (g._objects && g._objects.length === 0) {
          canvas.remove(g)
        } else {
          g.setDirty()
          g.setCoords()
        }
      }
    } else {
      canvas.remove(obj)
    }

    canvas.discardActiveObject()
    canvas.requestRenderAll()

    if (tileMaster) {
      if (canvas.getObjects().includes(tileMaster)) {
        refreshTileClones(canvas, tileMaster, canvasW, canvasH, PASTEBOARD)
      } else if (tileMaster._dtoolId) {
        removeTiling(canvas, tileMaster._dtoolId)
      }
    }
    removeOrphanedTileClones(canvas)
    refreshObjects()
  }, [saveUndoState, refreshObjects, canvasW, canvasH])

  const groupSelected = useCallback(() => {
    const canvas = canvasRef.current
    const active = canvas?.getActiveObject()
    if (!active || !active._objects || active._objects.length < 2) return
    saveUndoState()
    const objs = [...active._objects]
    canvas.discardActiveObject()
    for (const o of objs) canvas.remove(o)
    const group = new Group(objs, { _dtoolId: uuidv4() })
    canvas.add(group)
    canvas.setActiveObject(group)
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const ungroupSelected = useCallback(() => {
    const canvas = canvasRef.current
    const active = canvas?.getActiveObject()
    if (!active || active.type !== 'group') return
    saveUndoState()
    const items = active.removeAll()
    canvas.remove(active)
    const restored = []
    for (const item of items) {
      item._dtoolId = item._dtoolId || uuidv4()
      canvas.add(item)
      restored.push(item)
    }
    if (restored.length > 1) {
      const sel = new ActiveSelection(restored, { canvas })
      canvas.setActiveObject(sel)
    } else if (restored.length === 1) {
      canvas.setActiveObject(restored[0])
    }
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const nudgeSelected = useCallback((dx, dy) => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    obj.set({
      left: (obj.left || 0) + dx,
      top: (obj.top || 0) + dy,
    })
    obj.setCoords()
    if (obj._dtoolMaskShape && obj.group && obj.group._dtoolMaskGroup) {
      if (syncMaskClipPathRef.current) syncMaskClipPathRef.current(obj.group, obj)
    }
    canvas.requestRenderAll()
  }, [])

  const bringForward = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    saveUndoState()
    canvas.bringObjectForward(obj)
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const bringToFront = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    saveUndoState()
    canvas.bringObjectToFront(obj)
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const sendBackward = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    saveUndoState()
    canvas.sendObjectBackwards(obj)
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const sendToBack = useCallback(() => {
    const canvas = canvasRef.current
    const obj = canvas?.getActiveObject()
    if (!obj) return
    saveUndoState()
    canvas.sendObjectToBack(obj)
    canvas.requestRenderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const getAlignTargets = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const active = canvas.getActiveObject()
    if (!active) return null
    const objects = active._objects?.length > 1
      ? active._objects
      : [active]
    return { objects, group: active._objects?.length > 1 ? active : null, canvasW, canvasH }
  }, [canvasW, canvasH])

  const alignObjects = useCallback((direction, mode = 'canvas') => {
    const info = getAlignTargets()
    if (!info) return
    saveUndoState()
    const canvas = canvasRef.current
    const { objects, group, canvasW: cw, canvasH: ch } = info

    let refLeft = 0, refTop = 0, refW = cw, refH = ch
    if (mode === 'selection' && group) {
      const allBounds = objects.map(o => o.getBoundingRect())
      refLeft = Math.min(...allBounds.map(b => b.left))
      refTop = Math.min(...allBounds.map(b => b.top))
      refW = Math.max(...allBounds.map(b => b.left + b.width)) - refLeft
      refH = Math.max(...allBounds.map(b => b.top + b.height)) - refTop
    }

    const applyAlign = (obj) => {
      const bound = obj.getBoundingRect()
      switch (direction) {
        case 'left':    obj.set('left', obj.left + (refLeft - bound.left)); break
        case 'right':   obj.set('left', obj.left + (refLeft + refW - bound.left - bound.width)); break
        case 'centerH': obj.set('left', obj.left + (refLeft + refW / 2 - bound.left - bound.width / 2)); break
        case 'top':     obj.set('top', obj.top + (refTop - bound.top)); break
        case 'bottom':  obj.set('top', obj.top + (refTop + refH - bound.top - bound.height)); break
        case 'centerV': obj.set('top', obj.top + (refTop + refH / 2 - bound.top - bound.height / 2)); break
      }
      obj.setCoords()
    }

    if (group) {
      const objs = [...objects]
      canvas.discardActiveObject()
      objs.forEach(applyAlign)
      const sel = new ActiveSelection(objs, { canvas })
      canvas.setActiveObject(sel)
    } else {
      objects.forEach(applyAlign)
    }
    canvas.renderAll()
  }, [getAlignTargets, saveUndoState])

  const distributeObjects = useCallback((axis) => {
    const info = getAlignTargets()
    if (!info || !info.group || info.objects.length < 3) return
    saveUndoState()
    const canvas = canvasRef.current
    const objs = [...info.objects]
    canvas.discardActiveObject()

    const bounds = objs.map(o => {
      const br = o.getBoundingRect()
      return { obj: o, left: br.left, top: br.top, width: br.width, height: br.height }
    })

    if (axis === 'horizontal') {
      bounds.sort((a, b) => a.left - b.left)
      const first = bounds[0]
      const last = bounds[bounds.length - 1]
      const totalSpan = (last.left + last.width) - first.left
      const totalObjWidth = bounds.reduce((s, b) => s + b.width, 0)
      const gap = (totalSpan - totalObjWidth) / (bounds.length - 1)
      let cursor = first.left + first.width + gap
      for (let i = 1; i < bounds.length - 1; i++) {
        bounds[i].obj.set('left', (bounds[i].obj.left || 0) + (cursor - bounds[i].left))
        bounds[i].obj.setCoords()
        cursor += bounds[i].width + gap
      }
    } else {
      bounds.sort((a, b) => a.top - b.top)
      const first = bounds[0]
      const last = bounds[bounds.length - 1]
      const totalSpan = (last.top + last.height) - first.top
      const totalObjHeight = bounds.reduce((s, b) => s + b.height, 0)
      const gap = (totalSpan - totalObjHeight) / (bounds.length - 1)
      let cursor = first.top + first.height + gap
      for (let i = 1; i < bounds.length - 1; i++) {
        bounds[i].obj.set('top', (bounds[i].obj.top || 0) + (cursor - bounds[i].top))
        bounds[i].obj.setCoords()
        cursor += bounds[i].height + gap
      }
    }
    const sel = new ActiveSelection(objs, { canvas })
    canvas.setActiveObject(sel)
    canvas.renderAll()
  }, [getAlignTargets, saveUndoState])

  return {
    canvasRef,
    clipboardRef,
    fabricCanvas,
    setFabricCanvas,
    selectedObject,
    setSelectedObject,
    canvasObjects,
    setCanvasObjects,
    zoom,
    setZoom,
    assets,
    setAssets,
    addAsset,
    removeAsset,
    refreshObjects,
    saveUndoState,
    undo,
    redo,
    undoStackRef,
    redoStackRef,
    historyVersion,
    selectedMoment,
    setSelectedMoment,
    objectTokens,
    getTokensForObject,
    setTokensForObject,
    textSelection,
    setTextSelection,
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
    bringToFront,
    sendBackward,
    sendToBack,
    alignObjects,
    distributeObjects,
    bgColor,
    setBgColor,
    applyBgFill,
    activeTool,
    setActiveTool,
    blobBrushSize,
    setBlobBrushSize,
    blobBrushColor,
    setBlobBrushColor,
    blobBrushShape,
    setBlobBrushShape,
    blobBrushAngle,
    setBlobBrushAngle,
    autoplay,
    setAutoplay,
    penSubTool,
    setPenSubTool,
    penStrokeColor,
    setPenStrokeColor,
    penFillColor,
    setPenFillColor,
    penStrokeWidth,
    setPenStrokeWidth,
    penDashArray,
    setPenDashArray,
    penLineCap,
    setPenLineCap,
    penLineJoin,
    setPenLineJoin,
    penOpacity,
    setPenOpacity,
    canvasW,
    canvasH,
    setCanvasW,
    setCanvasH,
    darkMode,
    setDarkMode,
    canvasUnit,
    setCanvasUnit,
    canvasDpi,
    setCanvasDpi,
    showCheckerboard,
    setShowCheckerboard,
    printerMarks,
    setPrinterMarks,
    fitToViewRef,
    fitToView: () => { if (fitToViewRef.current) fitToViewRef.current() },
    createMaskRef,
    createMask: () => { if (createMaskRef.current) createMaskRef.current() },
    removeMaskRef,
    removeMaskFromGroup: (group) => { if (removeMaskRef.current) removeMaskRef.current(group) },
    syncMaskClipPathRef,
    syncMaskClipPath: (group, child) => { if (syncMaskClipPathRef.current) syncMaskClipPathRef.current(group, child) },
    bloodRain,
    setBloodRain,
    laserSmoke,
    setLaserSmoke,
  }
}
