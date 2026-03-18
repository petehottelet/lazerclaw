import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as FabricCanvas, Textbox, FabricImage, FabricObject, Path, ActiveSelection, Pattern, Group, Rect as FabricRect, cache, loadSVGFromString } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { reconcileTokens } from '../utils/tokenizer'
import { traceAlphaContours, simplifyRDP, contourToSmoothPath, expandStrokeToPath } from '../utils/contour'
import { refreshTileClones, removeTiling, findTilingMaster, expandTiling } from '../utils/tiling'
import { decodeGif, decodeAnimatedWebP, createFrameCanvas, drawFrameToCanvas, FrameAnimator, prepareVideoElement } from '../utils/motionMedia'
import { PEN_SUB_TOOLS, pointsToSVGPath, createFabricPath, dist, parseFabricPathToPoints, findClosestPointOnPath, splitBezierAt, drawPenOverlay } from '../utils/penTool'
import { DEFAULT_CANVAS_W, DEFAULT_CANVAS_H, CANVAS_W, CANVAS_H } from '../constants/canvas'
const PASTEBOARD = 300

FabricObject.ownDefaults.strokeUniform = true

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

const _origImageRender = FabricImage.prototype._render
FabricImage.prototype._render = function (ctx) {
  const sw = this.strokeWidth ?? 0
  const hasStroke = sw > 0 && this.stroke && this.stroke !== 'transparent'
  if (!hasStroke || !this._element) {
    return _origImageRender.call(this, ctx)
  }

  const el = this._element
  const w = this.width
  const h = this.height

  const off = document.createElement('canvas')
  off.width = w + sw * 2
  off.height = h + sw * 2
  const oc = off.getContext('2d')

  const steps = Math.max(16, Math.ceil(sw * 4))
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const dx = Math.cos(angle) * sw
    const dy = Math.sin(angle) * sw
    oc.drawImage(el, sw + dx, sw + dy, w, h)
  }

  oc.globalCompositeOperation = 'source-in'
  oc.fillStyle = this.stroke
  oc.fillRect(0, 0, off.width, off.height)

  oc.globalCompositeOperation = 'destination-out'
  oc.drawImage(el, sw, sw, w, h)

  ctx.drawImage(off, -w / 2 - sw, -h / 2 - sw, off.width, off.height)

  this._dtoolAlphaStroke = true
  _origImageRender.call(this, ctx)
  this._dtoolAlphaStroke = false
}

const _origImageRenderStroke = FabricImage.prototype._renderStroke
FabricImage.prototype._renderStroke = function (ctx) {
  if (this._dtoolAlphaStroke) return
  if (_origImageRenderStroke) _origImageRenderStroke.call(this, ctx)
}

const _origTextboxRender = Textbox.prototype._render
Textbox.prototype._render = function (ctx) {
  const anchor = this._dtoolVAnchor || 'top'
  const overflow = this._dtoolOverflow || 'wrap'
  const savedHeight = this.height

  let shrunkFrom = null
  if (overflow === 'shrink') {
    const naturalH = this.calcTextHeight()
    if (naturalH > savedHeight && savedHeight > 0) {
      const scale = savedHeight / naturalH
      shrunkFrom = this.fontSize
      this.fontSize = Math.max(4, Math.floor(shrunkFrom * scale))
      this._clearCache()
      this.initDimensions()
      this.height = savedHeight
    }
  }

  if (overflow === 'clip') {
    ctx.save()
    const w = this.width
    const h = this.height
    ctx.beginPath()
    ctx.rect(-w / 2, -h / 2, w, h)
    ctx.clip()
  }

  if (anchor !== 'top') {
    const textH = this.calcTextHeight()
    const boxH = this.height
    let dy = 0
    if (anchor === 'middle') dy = (boxH - textH) / 2
    else if (anchor === 'bottom') dy = boxH - textH
    if (dy > 0) {
      ctx.save()
      ctx.translate(0, dy)
    }
    _origTextboxRender.call(this, ctx)
    if (dy > 0) ctx.restore()
  } else {
    _origTextboxRender.call(this, ctx)
  }

  if (overflow === 'clip') {
    ctx.restore()
  }

  if (shrunkFrom !== null) {
    this.fontSize = shrunkFrom
    this._clearCache()
    this.initDimensions()
    this.height = savedHeight
  }
}

const SNAP_THRESHOLD = 5
const SNAP_COLOR = '#FF00FF'
const PASTEBOARD_COLOR = 'rgba(229, 231, 235, 0.65)'

function getEdges(obj) {
  const w = obj.getScaledWidth()
  const h = obj.getScaledHeight()
  const ox = obj.originX || 'left'
  const oy = obj.originY || 'top'
  let l = obj.left
  let t = obj.top
  if (ox === 'center') l -= w / 2
  else if (ox === 'right') l -= w
  if (oy === 'center') t -= h / 2
  else if (oy === 'bottom') t -= h
  return {
    left: l, top: t,
    right: l + w, bottom: t + h,
    centerX: l + w / 2, centerY: t + h / 2,
  }
}

function CtxItem({ label, shortcut, onClick, danger, dm }) {
  return (
    <button
      className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-4 transition-colors ${danger ? (dm ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50') : (dm ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {shortcut && <span className={`${dm ? 'text-gray-500' : 'text-gray-400'} text-[10px]`}>{shortcut}</span>}
    </button>
  )
}

function fabricPathToPath2D(obj, ctx) {
  ctx.save()
  const m = obj.calcTransformMatrix()
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
  const p2d = new Path2D(obj.path.map(s => s.join(' ')).join(' '))
  ctx.fillStyle = '#000'
  ctx.fill(p2d)
  ctx.restore()
}

function mergeOverlappingBlobs(fabricCanvas, newPathData, fillColor, newBounds) {
  const existing = fabricCanvas.getObjects().filter(obj =>
    obj.type === 'path' && obj.fill === fillColor &&
    (!obj.stroke || obj.stroke === 'transparent' || (obj.strokeWidth || 0) === 0)
  )
  if (existing.length === 0) return null

  const bbCandidates = existing.filter(obj => {
    const br = obj.getBoundingRect()
    return !(br.left + br.width < newBounds.left || br.left > newBounds.right ||
             br.top + br.height < newBounds.top || br.top > newBounds.bottom)
  })
  if (bbCandidates.length === 0) return null

  const newP2D = new Path2D(newPathData)
  const overlapping = bbCandidates.filter(obj => {
    const br = obj.getBoundingRect()
    const PAD = 4
    const oMinX = Math.floor(Math.min(br.left, newBounds.left)) - PAD
    const oMinY = Math.floor(Math.min(br.top, newBounds.top)) - PAD
    const oMaxX = Math.ceil(Math.max(br.left + br.width, newBounds.right)) + PAD
    const oMaxY = Math.ceil(Math.max(br.top + br.height, newBounds.bottom)) + PAD
    const ow = oMaxX - oMinX, oh = oMaxY - oMinY
    if (ow <= 0 || oh <= 0 || ow > 4000 || oh > 4000) return false
    const tc = document.createElement('canvas')
    tc.width = ow; tc.height = oh
    const tctx = tc.getContext('2d')
    tctx.translate(-oMinX, -oMinY)
    fabricPathToPath2D(obj, tctx)
    tctx.globalCompositeOperation = 'destination-in'
    tctx.fillStyle = '#000'
    tctx.fill(newP2D)
    const d = tctx.getImageData(0, 0, ow, oh).data
    for (let i = 3; i < d.length; i += 16) {
      if (d[i] > 64) return true
    }
    return false
  })
  if (overlapping.length === 0) return null

  const allB = [newBounds, ...overlapping.map(o => {
    const br = o.getBoundingRect()
    return { left: br.left, top: br.top, right: br.left + br.width, bottom: br.top + br.height }
  })]
  const PAD = 6
  const minX = Math.floor(Math.min(...allB.map(b => b.left))) - PAD
  const minY = Math.floor(Math.min(...allB.map(b => b.top))) - PAD
  const maxX = Math.ceil(Math.max(...allB.map(b => b.right))) + PAD
  const maxY = Math.ceil(Math.max(...allB.map(b => b.bottom))) + PAD
  const w = maxX - minX, h = maxY - minY
  if (w <= 0 || h <= 0 || w > 4000 || h > 4000) return null

  const off = document.createElement('canvas')
  off.width = w; off.height = h
  const ctx = off.getContext('2d')
  ctx.translate(-minX, -minY)
  for (const obj of overlapping) fabricPathToPath2D(obj, ctx)
  ctx.fillStyle = '#000'
  ctx.fill(newP2D)

  const imgData = ctx.getImageData(0, 0, w, h)
  const contours = traceAlphaContours(imgData.data, w, h)
  if (contours.length === 0) return null

  const paths = []
  for (const contour of contours) {
    if (contour.length < 3) continue
    const scene = contour.map(p => ({ x: p.x + minX, y: p.y + minY }))
    const simplified = simplifyRDP(scene, 1.5)
    if (simplified.length < 3) continue
    const sp = contourToSmoothPath(simplified)
    if (sp) paths.push(sp)
  }
  if (paths.length === 0) return null

  const mergedPath = paths.join(' ')
  return { pathData: mergedPath, toRemove: overlapping }
}

const WEDGE_ASPECT = 0.3

function generateBlobPath(rawPoints, radius, shape = 'circle', brushAngle = 45) {
  if (rawPoints.length === 0) return null

  const minDist = Math.max(1, radius / 8)
  const pts = [rawPoints[0]]
  for (let i = 1; i < rawPoints.length; i++) {
    const dx = rawPoints[i].x - pts[pts.length - 1].x
    const dy = rawPoints[i].y - pts[pts.length - 1].y
    if (Math.sqrt(dx * dx + dy * dy) >= minDist) pts.push(rawPoints[i])
  }

  const alpha = -brushAngle * Math.PI / 180

  const ca = Math.cos(alpha), sa = Math.sin(alpha)
  function rot(cx, cy, x, y) { const dx = x - cx, dy = y - cy; return { x: cx + dx * ca - dy * sa, y: cy + dx * sa + dy * ca } }

  if (pts.length === 1) {
    const p = pts[0], r = radius
    if (shape === 'square') {
      const c1 = rot(p.x, p.y, p.x - r, p.y - r), c2 = rot(p.x, p.y, p.x + r, p.y - r)
      const c3 = rot(p.x, p.y, p.x + r, p.y + r), c4 = rot(p.x, p.y, p.x - r, p.y + r)
      return `M ${c1.x} ${c1.y} L ${c2.x} ${c2.y} L ${c3.x} ${c3.y} L ${c4.x} ${c4.y} Z`
    }
    if (shape === 'diamond') {
      const d1 = rot(p.x, p.y, p.x, p.y - r), d2 = rot(p.x, p.y, p.x + r, p.y)
      const d3 = rot(p.x, p.y, p.x, p.y + r), d4 = rot(p.x, p.y, p.x - r, p.y)
      return `M ${d1.x} ${d1.y} L ${d2.x} ${d2.y} L ${d3.x} ${d3.y} L ${d4.x} ${d4.y} Z`
    }
    if (shape === 'wedge') {
      const a = r, b = r * WEDGE_ASPECT, ca = Math.cos(alpha), sa = Math.sin(alpha)
      const ep = []
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2
        ep.push({ x: p.x + a * Math.cos(t) * ca - b * Math.sin(t) * sa, y: p.y + a * Math.cos(t) * sa + b * Math.sin(t) * ca })
      }
      return contourToSmoothPath(ep)
    }
    return `M ${p.x} ${p.y - r} A ${r} ${r} 0 1 1 ${p.x} ${p.y + r} A ${r} ${r} 0 1 1 ${p.x} ${p.y - r} Z`
  }

  let smooth = [...pts]
  for (let pass = 0; pass < 2; pass++) {
    smooth = smooth.map((p, i) => {
      if (i === 0 || i === smooth.length - 1) return p
      return { x: (smooth[i - 1].x + p.x + smooth[i + 1].x) / 3, y: (smooth[i - 1].y + p.y + smooth[i + 1].y) / 3 }
    })
  }

  const normals = smooth.map((_, i) => {
    let dx, dy
    if (i === 0) { dx = smooth[1].x - smooth[0].x; dy = smooth[1].y - smooth[0].y }
    else if (i === smooth.length - 1) { dx = smooth[i].x - smooth[i - 1].x; dy = smooth[i].y - smooth[i - 1].y }
    else { dx = smooth[i + 1].x - smooth[i - 1].x; dy = smooth[i + 1].y - smooth[i - 1].y }
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    return { x: -dy / len, y: dx / len }
  })

  // Compensate for the inward bias introduced by centerline smoothing
  const R = radius * 1.06

  function getOffset(nAngle) {
    const diff = nAngle - alpha
    if (shape === 'wedge') {
      const a = R, b = R * WEDGE_ASPECT
      return Math.sqrt((a * Math.cos(diff)) ** 2 + (b * Math.sin(diff)) ** 2)
    }
    if (shape === 'square') return R * (Math.abs(Math.cos(diff)) + Math.abs(Math.sin(diff)))
    if (shape === 'diamond') return R * Math.max(Math.abs(Math.cos(diff)), Math.abs(Math.sin(diff)))
    return R
  }

  const left = smooth.map((p, i) => {
    const r = getOffset(Math.atan2(normals[i].y, normals[i].x))
    return { x: p.x + normals[i].x * r, y: p.y + normals[i].y * r }
  })
  const right = smooth.map((p, i) => {
    const r = getOffset(Math.atan2(normals[i].y, normals[i].x))
    return { x: p.x - normals[i].x * r, y: p.y - normals[i].y * r }
  })

  let endCap = [], startCap = []
  const CAP_STEPS = 8

  if (shape === 'circle') {
    const ec = smooth[smooth.length - 1], eA = Math.atan2(normals[normals.length - 1].y, normals[normals.length - 1].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = eA - (i / CAP_STEPS) * Math.PI; endCap.push({ x: ec.x + R * Math.cos(a), y: ec.y + R * Math.sin(a) }) }
    const sc = smooth[0], sA = Math.atan2(-normals[0].y, -normals[0].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = sA - (i / CAP_STEPS) * Math.PI; startCap.push({ x: sc.x + R * Math.cos(a), y: sc.y + R * Math.sin(a) }) }
  } else if (shape === 'diamond') {
    const ei = smooth.length - 1
    const eTx = smooth[ei].x - smooth[ei - 1].x, eTy = smooth[ei].y - smooth[ei - 1].y
    const eL = Math.sqrt(eTx * eTx + eTy * eTy) || 1
    const eTipOff = getOffset(Math.atan2(eTy / eL, eTx / eL))
    endCap = [{ x: smooth[ei].x + (eTx / eL) * eTipOff, y: smooth[ei].y + (eTy / eL) * eTipOff }]
    const sTx = smooth[0].x - smooth[1].x, sTy = smooth[0].y - smooth[1].y
    const sL = Math.sqrt(sTx * sTx + sTy * sTy) || 1
    const sTipOff = getOffset(Math.atan2(sTy / sL, sTx / sL))
    startCap = [{ x: smooth[0].x + (sTx / sL) * sTipOff, y: smooth[0].y + (sTy / sL) * sTipOff }]
  } else if (shape === 'square') {
    const ec = smooth[smooth.length - 1], eA = Math.atan2(normals[normals.length - 1].y, normals[normals.length - 1].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = eA - (i / CAP_STEPS) * Math.PI; const off = getOffset(a); endCap.push({ x: ec.x + off * Math.cos(a), y: ec.y + off * Math.sin(a) }) }
    const sc = smooth[0], sA = Math.atan2(-normals[0].y, -normals[0].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = sA - (i / CAP_STEPS) * Math.PI; const off = getOffset(a); startCap.push({ x: sc.x + off * Math.cos(a), y: sc.y + off * Math.sin(a) }) }
  } else if (shape === 'wedge') {
    const ec = smooth[smooth.length - 1], eA = Math.atan2(normals[normals.length - 1].y, normals[normals.length - 1].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = eA - (i / CAP_STEPS) * Math.PI; const off = getOffset(a); endCap.push({ x: ec.x + off * Math.cos(a), y: ec.y + off * Math.sin(a) }) }
    const sc = smooth[0], sA = Math.atan2(-normals[0].y, -normals[0].x)
    for (let i = 1; i < CAP_STEPS; i++) { const a = sA - (i / CAP_STEPS) * Math.PI; const off = getOffset(a); startCap.push({ x: sc.x + off * Math.cos(a), y: sc.y + off * Math.sin(a) }) }
  }

  const rightReversed = [...right].reverse()
  const outline = [...left, ...endCap, ...rightReversed, ...startCap]
  const n = outline.length

  let d = `M ${outline[0].x.toFixed(2)} ${outline[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = outline[(i - 1 + n) % n], p1 = outline[i]
    const p2 = outline[(i + 1) % n], p3 = outline[(i + 2) % n]
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d + ' Z'
}


export default function CanvasArea({ canvasState }) {
  const {
    canvasRef,
    setFabricCanvas,
    setSelectedObject,
    refreshObjects,
    saveUndoState,
    addAsset,
    zoom,
    selectedObject,
    setTextSelection,
    setTokensForObject,
    copySelected,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,
    deleteSelected,
    bringForward,
    bringToFront,
    sendBackward,
    sendToBack,
    activeTool,
    setActiveTool,
    blobBrushSize,
    blobBrushColor,
    blobBrushShape,
    blobBrushAngle,
    autoplay,
    addAudioTrack,
    playAudioTrack,
    stopAudioTrack,
    penSubTool,
    penStrokeColor,
    penFillColor,
    penStrokeWidth,
    canvasW,
    canvasH,
    setTimelineOpen,
    groupSelected,
    ungroupSelected,
  } = canvasState

  const outerRef = useRef(null)
  const containerRef = useRef(null)
  const canvasElRef = useRef(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [showTokenLabels, setShowTokenLabels] = useState(false)
  const showTokenLabelsRef = useRef(false)
  const mousePosRef = useRef({ x: -9999, y: -9999 })
  const animFrameRef = useRef(null)
  const pinchRef = useRef(null)

  // Pinch-to-zoom for mobile
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const getDistance = (t) => {
      const dx = t[0].clientX - t[1].clientX
      const dy = t[0].clientY - t[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchRef.current = { dist: getDistance(e.touches), zoom: canvasState.zoom }
      }
    }
    const onTouchMove = (e) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const newDist = getDistance(e.touches)
        const scale = newDist / pinchRef.current.dist
        const newZoom = Math.min(4, Math.max(0.1, +(pinchRef.current.zoom * scale).toFixed(2)))
        canvasState.setZoom(newZoom)
      }
    }
    const onTouchEnd = () => { pinchRef.current = null }
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [canvasState.zoom, canvasState.setZoom])

  const activeToolRef = useRef('select')
  const cropModeRef = useRef(null)
  const enterCropModeRef = useRef(null)

  const blobDrawingRef = useRef(false)
  const blobPointsRef = useRef([])
  const blobBrushSizeRef = useRef(20)
  const blobBrushColorRef = useRef('#000000')
  const blobBrushShapeRef = useRef('circle')
  const blobBrushAngleRef = useRef(45)

  const penStateRef = useRef({
    points: [],
    closed: false,
    dragging: false,
    dragPoint: null,
    dragStartPoint: null,
    hoveredPointIndex: -1,
    hoveredSegment: null,
    subTool: 'pen',
    selectedPointIndices: [],
    editingPath: null,
    editingFabricObj: null,
    dragHandleType: null,
    dragHandleIndex: -1,
  })
  const penSubToolRef = useRef('pen')
  const penStrokeColorRef = useRef('#000000')
  const penFillColorRef = useRef('transparent')
  const penStrokeWidthRef = useRef(2)
  const penDashArrayRef = useRef([])
  const penLineCapRef = useRef('butt')
  const penLineJoinRef = useRef('miter')
  const penOpacityRef = useRef(1)

  const canvasWRef = useRef(canvasW)
  const canvasHRef = useRef(canvasH)
  const darkModeRef = useRef(!!canvasState.darkMode)
  const printerMarksRef = useRef(canvasState.printerMarks)
  const checkerboardRef = useRef(false)
  canvasWRef.current = canvasW
  canvasHRef.current = canvasH
  darkModeRef.current = !!canvasState.darkMode
  printerMarksRef.current = canvasState.printerMarks
  checkerboardRef.current = !!canvasState.showCheckerboard

  useEffect(() => {
    canvasRef.current?.renderAll()
  }, [canvasState.printerMarks])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const lowerEl = c.lowerCanvasEl
    if (canvasState.showCheckerboard && lowerEl) {
      const isDark = !!canvasState.darkMode
      const light = isDark ? '#2d3748' : '#ffffff'
      const dark = isDark ? '#1a202c' : '#cccccc'
      lowerEl.style.backgroundColor = light
      lowerEl.style.backgroundImage = [
        `linear-gradient(45deg, ${dark} 25%, transparent 25%, transparent 75%, ${dark} 75%)`,
        `linear-gradient(45deg, ${dark} 25%, transparent 25%, transparent 75%, ${dark} 75%)`,
      ].join(', ')
      lowerEl.style.backgroundSize = '16px 16px'
      lowerEl.style.backgroundPosition = '0 0, 8px 8px'
    } else if (lowerEl) {
      lowerEl.style.backgroundColor = ''
      lowerEl.style.backgroundImage = ''
      lowerEl.style.backgroundSize = ''
      lowerEl.style.backgroundPosition = ''
    }
    c.renderAll()
    return () => {
      if (lowerEl) {
        lowerEl.style.backgroundColor = ''
        lowerEl.style.backgroundImage = ''
        lowerEl.style.backgroundSize = ''
        lowerEl.style.backgroundPosition = ''
      }
    }
  }, [canvasState.showCheckerboard, canvasState.darkMode])

  const totalW = canvasW + 2 * PASTEBOARD
  const totalH = canvasH + 2 * PASTEBOARD

  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return

    const c = new FabricCanvas(el, {
      width: totalW,
      height: totalH,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      uniformScaling: false,
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    })

    c.viewportTransform[4] = PASTEBOARD
    c.viewportTransform[5] = PASTEBOARD

    canvasRef.current = c
    window.__fabric_canvas = c
    setFabricCanvas(c)

    let enteredGroup = null
    const exitGroupIfNeeded = () => {
      if (!enteredGroup) return
      const active = c.getActiveObject()
      if (active && (active === enteredGroup || (active.group && active.group === enteredGroup))) return
      enteredGroup.interactive = false
      enteredGroup.subTargetCheck = false
      enteredGroup = null
      c.requestRenderAll()
    }
    const redirectCloneSelection = () => {
      const active = c.getActiveObject()
      if (!active) { setSelectedObject(null); return }
      if (active._dtoolTileClone && active._dtoolTileMasterId) {
        const master = c.getObjects().find(o => o._dtoolId === active._dtoolTileMasterId)
        if (master) {
          c.setActiveObject(master)
          setSelectedObject(master)
          return
        }
        c.discardActiveObject()
        setSelectedObject(null)
        return
      }
      if (active._objects) {
        const clones = active._objects.filter(o => o._dtoolTileClone)
        if (clones.length > 0) {
          const real = active._objects.filter(o => !o._dtoolTileClone)
          c.discardActiveObject()
          if (real.length === 0) { setSelectedObject(null); c.requestRenderAll(); return }
          if (real.length === 1) {
            c.setActiveObject(real[0])
            setSelectedObject(real[0])
          } else {
            const sel = new ActiveSelection(real, { canvas: c })
            c.setActiveObject(sel)
            setSelectedObject(sel)
          }
          c.requestRenderAll()
          return
        }
      }
      exitGroupIfNeeded()
      setSelectedObject(c.getActiveObject())
    }
    c.on('selection:created', redirectCloneSelection)
    c.on('selection:updated', redirectCloneSelection)
    let _cropHandleActive = false
    c.on('selection:cleared', () => {
      exitGroupIfNeeded()
      if (cropModeRef.current && !_cropHandleActive) {
        saveUndoState()
        exitCropMode(c, true)
        refreshObjects()
      }
      setSelectedObject(null)
    })
    c.on('mouse:dblclick', (opt) => {
      const target = opt.target
      if (target && target.type === 'group' && !target.interactive) {
        enteredGroup = target
        target.interactive = true
        target.subTargetCheck = true
        c.requestRenderAll()
        return
      }
      const isCroppable = target && (
        target.type === 'image' ||
        target._dtoolAnimated ||
        target._dtoolMediaType === 'video' ||
        target._dtoolMediaType === 'animImage'
      )
      if (isCroppable && !target._dtoolTileClone && !target._dtoolBgLayer) {
        enterCropMode(c, target)
      }
    })
    let removingTiles = false
    c.on('object:removed', (e) => {
      if (removingTiles) return
      const obj = e.target
      if (obj && obj._dtoolReordering) return
      if (obj && obj._dtoolMovingToGroup) { delete obj._dtoolMovingToGroup; return }
      const cleanupMotion = (o) => {
        if (o._dtoolBlobUrl) URL.revokeObjectURL(o._dtoolBlobUrl)
        if (o._dtoolMediaElement && o._dtoolMediaElement.tagName === 'VIDEO') {
          o._dtoolMediaElement.pause()
          o._dtoolMediaElement.src = ''
          if (o._dtoolVideoAudioTrackId) stopAudioTrack(o._dtoolVideoAudioTrackId)
        }
        if (o._objects) o._objects.forEach(cleanupMotion)
      }
      cleanupMotion(obj)
      if (obj && obj._dtoolMotionFill) {
        if (obj._dtoolMotionFillElement?.tagName === 'VIDEO') {
          obj._dtoolMotionFillElement.pause()
          obj._dtoolMotionFillElement.src = ''
        }
        if (obj._dtoolMotionFillBlobUrl) URL.revokeObjectURL(obj._dtoolMotionFillBlobUrl)
      }
      if (obj && obj._dtoolTileMode && obj._dtoolTileMode !== 'none' && obj._dtoolId && !obj._dtoolTileClone) {
        removingTiles = true
        try { removeTiling(c, obj._dtoolId) } finally { removingTiles = false }
      } else if (obj && !obj._dtoolTileClone) {
        const parentMaster = findTilingMaster(obj)
        if (parentMaster && c.getObjects().includes(parentMaster)) {
          refreshTileClones(c, parentMaster, canvasWRef.current, canvasHRef.current, PASTEBOARD)
        }
      }
    })
    let preDragState = null
    let highlightedDropTarget = null
    c.on('before:transform', () => {
      saveUndoState()
      const target = c.getActiveObject()
      if (target && !target._dtoolTileClone) {
        preDragState = { obj: target, left: target.left, top: target.top }
      }
    })
    c.on('object:modified', (e) => {
      const obj = e.target
      if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
        const sx = obj.scaleX || 1
        const sy = obj.scaleY || 1
        if (sx !== 1 || sy !== 1) {
          const newW = obj.width * sx
          const newH = obj.height * sy
          obj.set({ width: newW, height: newH, scaleX: 1, scaleY: 1 })
          obj.dirty = true
          obj._forceClearCache = true
          obj.initDimensions?.()
          if (obj._dtoolOverflow === 'shrink' || obj._dtoolOverflow === 'clip') {
            obj.height = newH
          }
          obj.setCoords()
          c.requestRenderAll()
        }
      }
      if (obj && obj._dtoolMaskShape && obj.group && obj.group._dtoolMaskGroup) {
        syncMaskClipPath(obj.group, obj)
      }
      const modMaster = findTilingMaster(obj)
      if (modMaster) {
        refreshTileClones(c, modMaster, canvasWRef.current, canvasHRef.current, PASTEBOARD)
      }
      refreshObjects()
    })
    c.on('text:changed', (e) => {
      const obj = e.target
      if (obj && obj._dtoolTokens && obj._dtoolTokens.length > 0) {
        obj._dtoolTokens = reconcileTokens(obj._dtoolTokens, obj.text || '')
      }
      const txtMaster = findTilingMaster(obj)
      if (txtMaster) {
        refreshTileClones(c, txtMaster, canvasWRef.current, canvasHRef.current, PASTEBOARD)
      }
      refreshObjects()
    })

    const readSel = (obj) => {
      if (!obj || !obj.isEditing) { setTextSelection(null); return }
      const s = obj.selectionStart ?? 0
      const e = obj.selectionEnd ?? 0
      if (s === e) { setTextSelection(null); return }
      const selText = (obj.text || '').substring(s, e)
      setTextSelection({ start: s, end: e, text: selText })
    }

    c.on('text:editing:entered', (e) => {
      const obj = e.target
      readSel(obj)
      const handler = () => readSel(obj)
      obj.__dtoolSelHandler = handler
      obj.on('selection:changed', handler)
    })

    c.on('text:editing:exited', (e) => {
      const obj = e.target
      if (obj.__dtoolSelHandler) {
        obj.off('selection:changed', obj.__dtoolSelHandler)
        delete obj.__dtoolSelHandler
      }
      if (obj && obj._dtoolTokens && obj._dtoolId) {
        const reconciled = reconcileTokens(obj._dtoolTokens, obj.text || '')
        setTokensForObject(obj._dtoolId, reconciled)
      }
      setTextSelection(null)
    })

    let snapLines = []
    let rotationSnap = null

    c.on('before:render', () => {
      if (c._dtoolExporting) return
      if (checkerboardRef.current) {
        c._dtoolSavedBg = c.backgroundColor
        c.backgroundColor = 'transparent'
      }
    })

    c.on('after:render', () => {
      if (c._dtoolExporting) return
      if (c._dtoolSavedBg !== undefined) {
        c.backgroundColor = c._dtoolSavedBg
        delete c._dtoolSavedBg
      }
      const ctx = c.contextContainer
      if (!ctx) return

      const cW = canvasWRef.current
      const cH = canvasHRef.current
      const z = c.getZoom() || 1
      const px = PASTEBOARD * z
      const py = PASTEBOARD * z
      const pw = cW * z
      const ph = cH * z
      const tW = cW + 2 * PASTEBOARD
      const tH = cH + 2 * PASTEBOARD
      const cw = tW * z
      const ch = tH * z

      ctx.save()

      const isDark = darkModeRef.current
      const showCB = checkerboardRef.current
      ctx.fillStyle = showCB
        ? (isDark ? '#1f2937' : '#e5e7eb')
        : (isDark ? '#1f2937' : PASTEBOARD_COLOR)

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(cw, 0)
      ctx.lineTo(cw, ch)
      ctx.lineTo(0, ch)
      ctx.closePath()
      ctx.moveTo(px, py)
      ctx.lineTo(px, py + ph)
      ctx.lineTo(px + pw, py + ph)
      ctx.lineTo(px + pw, py)
      ctx.closePath()
      ctx.clip('evenodd')
      ctx.fillRect(0, 0, cw, ch)

      ctx.restore()
      ctx.save()

      if (!isDark) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.lineWidth = 1
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
      }

      /* ── Printer marks overlay ── */
      const pm = printerMarksRef.current
      if (pm) {
        const bTop = (pm.bleedTop || 0) * z
        const bRight = (pm.bleedRight || 0) * z
        const bBottom = (pm.bleedBottom || 0) * z
        const bLeft = (pm.bleedLeft || 0) * z
        const markLen = 20 * z
        const markOff = 6 * z
        const thinLine = Math.max(1, 0.75 * z)

        if (pm.bleedLine) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255, 40, 40, 0.8)'
          ctx.lineWidth = thinLine
          ctx.setLineDash([4 * z, 3 * z])
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
          ctx.setLineDash([4 * z, 3 * z])
          ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
          ctx.setLineDash([])
          ctx.restore()
        }

        if (pm.safeArea) {
          const sTop = (pm.safeTop || 9) * z
          const sRight = (pm.safeRight || 9) * z
          const sBottom = (pm.safeBottom || 9) * z
          const sLeft = (pm.safeLeft || 9) * z
          ctx.save()
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
          ctx.lineWidth = thinLine
          ctx.setLineDash([6 * z, 3 * z])
          ctx.strokeRect(px + sLeft, py + sTop, pw - sLeft - sRight, ph - sTop - sBottom)
          ctx.setLineDash([])
          ctx.restore()
        }

        if (pm.cropMarks) {
          ctx.save()
          ctx.strokeStyle = isDark ? '#ffffff' : '#000000'
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
          ctx.strokeStyle = isDark ? '#ffffff' : '#000000'
          ctx.fillStyle = isDark ? '#ffffff' : '#000000'
          ctx.lineWidth = thinLine
          ctx.setLineDash([])
          const rr = 5 * z
          const regOff = markOff + markLen + 10 * z
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
            ctx.moveTo(rx - rr - 2 * z, ry)
            ctx.lineTo(rx + rr + 2 * z, ry)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(rx, ry - rr - 2 * z)
            ctx.lineTo(rx, ry + rr + 2 * z)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(rx, ry, 1.5 * z, 0, Math.PI * 2)
            ctx.fill()
          })
          ctx.restore()
        }

        if (pm.colorBars) {
          ctx.save()
          const barH = 8 * z
          const barW = 14 * z
          const gap = 2 * z
          const cmykColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#000000']
          const grays = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000']
          const allColors = [...cmykColors, ...grays]
          const totalBarW = allColors.length * (barW + gap) - gap
          const startX = px + (pw - totalBarW) / 2
          const barY = py + ph + markOff + 2 * z
          allColors.forEach((color, i) => {
            ctx.fillStyle = color
            ctx.fillRect(startX + i * (barW + gap), barY, barW, barH)
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'
            ctx.lineWidth = 0.5 * z
            ctx.strokeRect(startX + i * (barW + gap), barY, barW, barH)
          })
          ctx.restore()
        }

        if (pm.gridLines) {
          ctx.save()
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
          ctx.lineWidth = 0.5 * z
          ctx.setLineDash([])
          const gridStep = 50 * z
          for (let gx = px + gridStep; gx < px + pw; gx += gridStep) {
            ctx.beginPath()
            ctx.moveTo(gx, py)
            ctx.lineTo(gx, py + ph)
            ctx.stroke()
          }
          for (let gy = py + gridStep; gy < py + ph; gy += gridStep) {
            ctx.beginPath()
            ctx.moveTo(px, gy)
            ctx.lineTo(px + pw, gy)
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      if (snapLines.length > 0) {
        const vpt = c.viewportTransform
        ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
        ctx.strokeStyle = SNAP_COLOR
        ctx.lineWidth = 1 / z
        ctx.setLineDash([])
        snapLines.forEach(l => {
          ctx.beginPath()
          ctx.moveTo(l.x1, l.y1)
          ctx.lineTo(l.x2, l.y2)
          ctx.stroke()
        })
      }

      if (rotationSnap) {
        const vpt = c.viewportTransform
        ctx.save()
        ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
        const { cx: rcx, cy: rcy, angle: rAngle, w: rw, h: rh } = rotationSnap
        const rad = rAngle * Math.PI / 180
        const lineLen = Math.max(rw, rh) * 0.8

        ctx.strokeStyle = SNAP_COLOR
        ctx.lineWidth = 1 / z
        ctx.setLineDash([4 / z, 3 / z])

        ctx.beginPath()
        ctx.moveTo(rcx - Math.cos(rad) * lineLen, rcy - Math.sin(rad) * lineLen)
        ctx.lineTo(rcx + Math.cos(rad) * lineLen, rcy + Math.sin(rad) * lineLen)
        ctx.stroke()

        const perpRad = rad + Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(rcx - Math.cos(perpRad) * lineLen, rcy - Math.sin(perpRad) * lineLen)
        ctx.lineTo(rcx + Math.cos(perpRad) * lineLen, rcy + Math.sin(perpRad) * lineLen)
        ctx.stroke()

        ctx.setLineDash([])
        ctx.fillStyle = SNAP_COLOR
        ctx.font = `bold ${11 / z}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText(`${rAngle}°`, rcx, rcy - lineLen - 6 / z)
        ctx.restore()
      }

      ctx.restore()

      if (blobDrawingRef.current && blobPointsRef.current.length > 0) {
        const pts = blobPointsRef.current
        const vpt2 = c.viewportTransform
        const sh = blobBrushShapeRef.current
        const bsz = blobBrushSizeRef.current
        const bR = bsz / 2
        ctx.save()
        ctx.transform(vpt2[0], vpt2[1], vpt2[2], vpt2[3], vpt2[4], vpt2[5])
        ctx.fillStyle = blobBrushColorRef.current
        ctx.strokeStyle = blobBrushColorRef.current
        if (sh === 'wedge') {
          const bA = -blobBrushAngleRef.current * Math.PI / 180
          const ca = Math.cos(bA), sa = Math.sin(bA)
          const k = WEDGE_ASPECT
          const t11 = ca * ca + k * sa * sa, t12 = ca * sa * (1 - k)
          const t22 = sa * sa + k * ca * ca
          const ik = 1 / k
          const i11 = ca * ca + ik * sa * sa, i12 = ca * sa * (1 - ik)
          const i22 = sa * sa + ik * ca * ca
          ctx.transform(t11, t12, t12, t22, 0, 0)
          ctx.lineWidth = bsz
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          if (pts.length === 1) {
            const tx = i11 * pts[0].x + i12 * pts[0].y, ty = i12 * pts[0].x + i22 * pts[0].y
            ctx.beginPath(); ctx.arc(tx, ty, bR, 0, Math.PI * 2); ctx.fill()
          } else {
            let tx = i11 * pts[0].x + i12 * pts[0].y, ty = i12 * pts[0].x + i22 * pts[0].y
            ctx.beginPath(); ctx.moveTo(tx, ty)
            for (let i = 1; i < pts.length; i++) {
              tx = i11 * pts[i].x + i12 * pts[i].y; ty = i12 * pts[i].x + i22 * pts[i].y
              ctx.lineTo(tx, ty)
            }
            ctx.stroke()
          }
        } else if (sh === 'square' || sh === 'diamond') {
          const bA = -blobBrushAngleRef.current * Math.PI / 180
          const bca = Math.cos(bA), bsa = Math.sin(bA)
          const k = sh === 'square' ? 1 : (Math.SQRT2 / 2)
          const t11 = bca * bca + k * bsa * bsa, t12 = bca * bsa * (1 - k)
          const t22 = bsa * bsa + k * bca * bca
          const ik = 1 / k
          const i11 = bca * bca + ik * bsa * bsa, i12 = bca * bsa * (1 - ik)
          const i22 = bsa * bsa + ik * bca * bca
          ctx.save()
          ctx.transform(t11, t12, t12, t22, 0, 0)
          ctx.lineWidth = bsz
          ctx.lineCap = sh === 'square' ? 'butt' : 'round'
          ctx.lineJoin = sh === 'square' ? 'miter' : 'round'
          if (pts.length === 1) {
            const tx = i11 * pts[0].x + i12 * pts[0].y, ty = i12 * pts[0].x + i22 * pts[0].y
            ctx.beginPath()
            if (sh === 'square') { ctx.save(); ctx.translate(tx, ty); ctx.rotate(bA); ctx.rect(-bR, -bR, bsz, bsz); ctx.restore() }
            else { ctx.save(); ctx.translate(tx, ty); ctx.rotate(bA); ctx.moveTo(0, -bR); ctx.lineTo(bR, 0); ctx.lineTo(0, bR); ctx.lineTo(-bR, 0); ctx.closePath(); ctx.restore() }
            ctx.fill()
          } else {
            let tx = i11 * pts[0].x + i12 * pts[0].y, ty = i12 * pts[0].x + i22 * pts[0].y
            ctx.beginPath(); ctx.moveTo(tx, ty)
            for (let i = 1; i < pts.length; i++) {
              tx = i11 * pts[i].x + i12 * pts[i].y; ty = i12 * pts[i].x + i22 * pts[i].y
              ctx.lineTo(tx, ty)
            }
            ctx.stroke()
          }
          ctx.restore()
        } else {
          ctx.lineWidth = bsz
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          if (pts.length === 1) {
            ctx.beginPath()
            ctx.arc(pts[0].x, pts[0].y, bR, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      if (activeToolRef.current === 'blobBrush' && !blobDrawingRef.current) {
        const mp = mousePosRef.current
        if (mp.x > -9000) {
          const r = (blobBrushSizeRef.current / 2) * z
          const sh = blobBrushShapeRef.current
          ctx.save()
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          const bA = -blobBrushAngleRef.current * Math.PI / 180
          function drawCursorShape() {
            ctx.beginPath()
            if (sh === 'square') {
              ctx.save(); ctx.translate(mp.x, mp.y); ctx.rotate(bA)
              ctx.rect(-r, -r, r * 2, r * 2)
              ctx.restore()
            } else if (sh === 'diamond') {
              ctx.save(); ctx.translate(mp.x, mp.y); ctx.rotate(bA)
              ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath()
              ctx.restore()
            } else if (sh === 'wedge') {
              const cca = Math.cos(bA), ssa = Math.sin(bA), b = r * WEDGE_ASPECT
              for (let i = 0; i <= 24; i++) { const t = (i / 24) * Math.PI * 2; const x = mp.x + r * Math.cos(t) * cca - b * Math.sin(t) * ssa; const y = mp.y + r * Math.cos(t) * ssa + b * Math.sin(t) * cca; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) }
              ctx.closePath()
            } else ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2)
          }
          drawCursorShape()
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = blobBrushColorRef.current
          ctx.globalAlpha = 0.15
          drawCursorShape()
          ctx.fill()
          ctx.restore()
        }
      }

      if (activeToolRef.current === 'pen') {
        const vpt3 = c.viewportTransform
        drawPenOverlay(ctx, penStateRef.current, vpt3, z)

        if (!penStateRef.current.editingPath && !penStateRef.current.dragging) {
          const mp = mousePosRef.current
          if (mp.x > -9000) {
            ctx.save()
            ctx.strokeStyle = 'rgba(0,120,255,0.6)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 3])
            const crossSize = 8
            ctx.beginPath()
            ctx.moveTo(mp.x - crossSize, mp.y)
            ctx.lineTo(mp.x + crossSize, mp.y)
            ctx.moveTo(mp.x, mp.y - crossSize)
            ctx.lineTo(mp.x, mp.y + crossSize)
            ctx.stroke()
            ctx.restore()
          }
        }
      }

      const TOKEN_COLORS = [
        '#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0',
        '#00BCD4', '#FF5722', '#3F51B5', '#009688', '#795548',
      ]
      const vpt = c.viewportTransform
      const objs = c.getObjects()
      for (const obj of objs) {
        const tokens = obj._dtoolTokens
        if (!tokens || tokens.length === 0) continue
        if (obj.type !== 'textbox' && obj.type !== 'i-text' && obj.type !== 'text') continue
        if (obj.visible === false) continue

        ctx.save()
        const m = obj.calcTransformMatrix()
        const full = [
          vpt[0] * m[0] + vpt[2] * m[1],
          vpt[1] * m[0] + vpt[3] * m[1],
          vpt[0] * m[2] + vpt[2] * m[3],
          vpt[1] * m[2] + vpt[3] * m[3],
          vpt[0] * m[4] + vpt[2] * m[5] + vpt[4],
          vpt[1] * m[4] + vpt[3] * m[5] + vpt[5],
        ]
        ctx.transform(full[0], full[1], full[2], full[3], full[4], full[5])

        const objW = obj.width
        const objH = obj.height

        tokens.forEach((tok, ti) => {
          const color = TOKEN_COLORS[ti % TOKEN_COLORS.length]
          try {
            const lines = obj._textLines
            if (!lines) return
            let charIdx = 0
            const ranges = []
            for (let li = 0; li < lines.length; li++) {
              const lineChars = lines[li]
              const lineLen = lineChars.length
              const rawLineStart = charIdx
              const rawLineEnd = charIdx + lineLen

              const tokStart = tok.startIndex
              const tokEnd = tok.endIndex

              if (tokStart < rawLineEnd && tokEnd > rawLineStart) {
                const segStart = Math.max(tokStart, rawLineStart) - rawLineStart
                const segEnd = Math.min(tokEnd, rawLineEnd) - rawLineStart

                const startBound = obj.__charBounds?.[li]?.[segStart]
                const endBound = obj.__charBounds?.[li]?.[segEnd - 1]
                if (!startBound || !endBound) { charIdx = rawLineEnd + 1; continue }

                const lineOffset = obj._getLineLeftOffset?.(li) || 0
                const x1 = startBound.left + lineOffset
                const x2 = endBound.left + endBound.width + lineOffset

                const lineH = obj.getHeightOfLine(li)
                let yTop = 0
                for (let pi = 0; pi < li; pi++) yTop += obj.getHeightOfLine(pi)
                const yBot = yTop + lineH

                ranges.push({ x1, x2, yBot, li })
              }

              charIdx = rawLineEnd + 1
            }

            if (ranges.length === 0) return
            const scale = 1 / (obj.scaleX || 1)

            ranges.forEach(r => {
              const rx1 = r.x1 - objW / 2
              const rx2 = r.x2 - objW / 2
              const ry = r.yBot - objH / 2 - 2

              ctx.strokeStyle = color
              ctx.lineWidth = 1.5 * scale
              ctx.setLineDash([3 * scale, 2 * scale])
              ctx.beginPath()
              ctx.moveTo(rx1, ry)
              ctx.lineTo(rx2, ry)
              ctx.stroke()
              ctx.setLineDash([])
            })

            const last = ranges[ranges.length - 1]
            const lx = last.x1 - objW / 2
            const ly = last.yBot - objH / 2 + 2

            let drawLabel = showTokenLabelsRef.current
            if (!drawLabel) {
              const mp = mousePosRef.current
              for (const r of ranges) {
                const rx1 = r.x1 - objW / 2
                const rx2 = r.x2 - objW / 2
                const ryTop = r.yBot - objH / 2 - 20
                const ryBot = r.yBot - objH / 2 + 20
                const sx1 = full[0] * rx1 + full[2] * ryTop + full[4]
                const sy1 = full[1] * rx1 + full[3] * ryTop + full[5]
                const sx2 = full[0] * rx2 + full[2] * ryBot + full[4]
                const sy2 = full[1] * rx2 + full[3] * ryBot + full[5]
                const minX = Math.min(sx1, sx2) - 10
                const maxX = Math.max(sx1, sx2) + 10
                const minY = Math.min(sy1, sy2) - 10
                const maxY = Math.max(sy1, sy2) + 10
                if (mp.x >= minX && mp.x <= maxX && mp.y >= minY && mp.y <= maxY) {
                  drawLabel = true
                  break
                }
              }
            }

            if (!drawLabel) return

            const labelParts = tok.fieldPath?.split('.') || []
            const label = labelParts.length > 2
              ? labelParts.slice(-2).join('.')
              : tok.fieldPath || ''
            if (!label) return

            const fontSize = 9 * scale
            ctx.font = `600 ${fontSize}px system-ui, sans-serif`
            const tw = ctx.measureText(label).width
            const pad = 3 * scale
            const rh = fontSize + pad * 2
            const rw = tw + pad * 2

            ctx.fillStyle = color
            ctx.beginPath()
            ctx.roundRect(lx, ly, rw, rh, 2 * scale)
            ctx.fill()

            ctx.fillStyle = '#ffffff'
            ctx.fillText(label, lx + pad, ly + pad + fontSize * 0.85)
          } catch (_) {}
        })

        ctx.restore()
      }

      const active = c.getActiveObject()
      if (active && active._dtoolMaskGroup && active.interactive) {
        const vpt = c.viewportTransform
        ctx.save()
        ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])

        const children = active._objects || []
        for (const child of children) {
          if (!child._dtoolMaskedContent) continue

          const gm = active.calcTransformMatrix()
          const cm = child.calcTransformMatrix()
          const m = [
            gm[0] * cm[0] + gm[2] * cm[1],
            gm[1] * cm[0] + gm[3] * cm[1],
            gm[0] * cm[2] + gm[2] * cm[3],
            gm[1] * cm[2] + gm[3] * cm[3],
            gm[0] * cm[4] + gm[2] * cm[5] + gm[4],
            gm[1] * cm[4] + gm[3] * cm[5] + gm[5],
          ]
          const cw = child.getScaledWidth()
          const ch2 = child.getScaledHeight()
          const hw = cw / 2, hh = ch2 / 2
          const corners = [
            { x: -hw, y: -hh }, { x: hw, y: -hh },
            { x: hw, y: hh }, { x: -hw, y: hh },
          ].map(p => ({
            x: m[0] * p.x + m[2] * p.y + m[4],
            y: m[1] * p.x + m[3] * p.y + m[5],
          }))

          ctx.setLineDash([4 / z, 4 / z])
          ctx.strokeStyle = 'rgba(59,130,246,0.6)'
          ctx.lineWidth = 1.5 / z
          ctx.beginPath()
          ctx.moveTo(corners[0].x, corners[0].y)
          for (let ci = 1; ci < 4; ci++) ctx.lineTo(corners[ci].x, corners[ci].y)
          ctx.closePath()
          ctx.stroke()
          ctx.setLineDash([])

          const hs = 4 / z
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = 'rgba(59,130,246,0.8)'
          ctx.lineWidth = 1.2 / z
          for (const cr of corners) {
            ctx.fillRect(cr.x - hs, cr.y - hs, hs * 2, hs * 2)
            ctx.strokeRect(cr.x - hs, cr.y - hs, hs * 2, hs * 2)
          }
          const midpoints = corners.map((cr, ci) => ({
            x: (cr.x + corners[(ci + 1) % 4].x) / 2,
            y: (cr.y + corners[(ci + 1) % 4].y) / 2,
          }))
          for (const mp of midpoints) {
            ctx.fillRect(mp.x - hs * 0.7, mp.y - hs * 0.7, hs * 1.4, hs * 1.4)
            ctx.strokeRect(mp.x - hs * 0.7, mp.y - hs * 0.7, hs * 1.4, hs * 1.4)
          }
        }
        ctx.restore()
      }

      const cm = cropModeRef.current
      if (cm && cm.target && c.getObjects().includes(cm.target)) {
        const vpt = c.viewportTransform
        ctx.save()
        ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])

        const { cropL: cl, cropT: ct, cropW: cw2, cropH: ch2 } = cm
        const target = cm.target
        const tsx = target.scaleX || 1
        const tsy = target.scaleY || 1
        const tw = (target.width || 0) * tsx
        const th = (target.height || 0) * tsy
        let imgL = target.left, imgT = target.top
        if (target.originX === 'center') imgL -= tw / 2
        else if (target.originX === 'right') imgL -= tw
        if (target.originY === 'center') imgT -= th / 2
        else if (target.originY === 'bottom') imgT -= th

        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.beginPath()
        ctx.rect(imgL, imgT, tw, th)
        ctx.rect(cl, ct + ch2, cw2, -ch2)
        ctx.fill('evenodd')

        const cropBorderGrad = ctx.createLinearGradient(cl, ct, cl + cw2, ct + ch2)
        cropBorderGrad.addColorStop(0, '#2dd4bf')
        cropBorderGrad.addColorStop(0.5, '#0ea5e9')
        cropBorderGrad.addColorStop(1, '#2dd4bf')

        ctx.strokeStyle = cropBorderGrad
        ctx.lineWidth = 2 / z
        ctx.setLineDash([])
        ctx.strokeRect(cl, ct, cw2, ch2)

        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 0.5 / z
        for (let gi = 1; gi < 3; gi++) {
          ctx.beginPath()
          ctx.moveTo(cl + cw2 * gi / 3, ct)
          ctx.lineTo(cl + cw2 * gi / 3, ct + ch2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(cl, ct + ch2 * gi / 3)
          ctx.lineTo(cl + cw2, ct + ch2 * gi / 3)
          ctx.stroke()
        }

        const handles = getCropHandles(cm, z)
        for (const h of handles) {
          const hs = h.size
          const isCorner = h.id.length === 2 && !h.id.includes('m')
          if (isCorner) {
            const cornerLen = hs * 3
            const thick = 3.5 / z
            const cx = h.x, cy = h.y
            const dirX = h.id.includes('l') ? 1 : -1
            const dirY = h.id.includes('t') ? 1 : -1
            const hx = cx - (dirX > 0 ? thick / 2 : cornerLen - thick / 2)
            const vy = cy - (dirY > 0 ? thick / 2 : cornerLen - thick / 2)

            const hGrad = ctx.createLinearGradient(hx, cy, hx + cornerLen, cy)
            hGrad.addColorStop(0, dirX > 0 ? '#2dd4bf' : '#0ea5e9')
            hGrad.addColorStop(1, dirX > 0 ? '#0ea5e9' : '#2dd4bf')
            ctx.fillStyle = hGrad
            ctx.shadowColor = '#0ea5e9'
            ctx.shadowBlur = 6
            ctx.fillRect(hx, cy - thick / 2, cornerLen, thick)

            const vGrad = ctx.createLinearGradient(cx, vy, cx, vy + cornerLen)
            vGrad.addColorStop(0, dirY > 0 ? '#2dd4bf' : '#0ea5e9')
            vGrad.addColorStop(1, dirY > 0 ? '#0ea5e9' : '#2dd4bf')
            ctx.fillStyle = vGrad
            ctx.fillRect(cx - thick / 2, vy, thick, cornerLen)
            ctx.shadowBlur = 0
          } else {
            const midW = h.id === 'tm' || h.id === 'bm' ? hs * 2.2 : hs * 0.7
            const midH = h.id === 'ml' || h.id === 'mr' ? hs * 2.2 : hs * 0.7
            const mx = h.x - midW / 2, my = h.y - midH / 2
            const mGrad = ctx.createLinearGradient(mx, my, mx + midW, my + midH)
            mGrad.addColorStop(0, '#2dd4bf')
            mGrad.addColorStop(0.5, '#0ea5e9')
            mGrad.addColorStop(1, '#1e3a8a')
            ctx.fillStyle = mGrad
            ctx.shadowColor = '#0ea5e9'
            ctx.shadowBlur = 5
            ctx.beginPath()
            ctx.roundRect(mx, my, midW, midH, 2 / z)
            ctx.fill()
            ctx.shadowBlur = 0
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 0.5 / z
            ctx.stroke()
          }
        }

        ctx.restore()
      }
    })

    c.on('object:moving', (e) => {
      const obj = e.target
      if (!obj) { snapLines = []; return }

      if (preDragState && e.e) {
        const els = document.elementsFromPoint(e.e.clientX, e.e.clientY)
        const dropZone = els.find(el => el.dataset?.dtoolFillDrop === 'true')
        if (dropZone !== highlightedDropTarget) {
          if (highlightedDropTarget) {
            highlightedDropTarget.style.boxShadow = ''
            highlightedDropTarget.style.transform = ''
          }
          if (dropZone) {
            dropZone.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.7)'
            dropZone.style.transform = 'scale(1.15)'
          }
          highlightedDropTarget = dropZone
        }
      }

      const edges = getEdges(obj)
      const newLines = []

      const xTargets = [canvasWRef.current / 2, 0, canvasWRef.current]
      const yTargets = [canvasHRef.current / 2, 0, canvasHRef.current]

      const active = c.getActiveObject()
      const skipSet = active?._objects
        ? new Set(active._objects)
        : new Set([active])

      c.getObjects().forEach(other => {
        if (skipSet.has(other)) return
        const oe = getEdges(other)
        xTargets.push(oe.left, oe.centerX, oe.right)
        yTargets.push(oe.top, oe.centerY, oe.bottom)
      })

      let snappedX = false
      for (const val of [edges.centerX, edges.left, edges.right]) {
        if (snappedX) break
        for (const target of xTargets) {
          if (Math.abs(val - target) < SNAP_THRESHOLD) {
            obj.set('left', obj.left + (target - val))
            newLines.push({ x1: target, y1: -PASTEBOARD, x2: target, y2: canvasHRef.current + PASTEBOARD })
            snappedX = true
            break
          }
        }
      }

      let snappedY = false
      for (const val of [edges.centerY, edges.top, edges.bottom]) {
        if (snappedY) break
        for (const target of yTargets) {
          if (Math.abs(val - target) < SNAP_THRESHOLD) {
            obj.set('top', obj.top + (target - val))
            newLines.push({ x1: -PASTEBOARD, y1: target, x2: canvasWRef.current + PASTEBOARD, y2: target })
            snappedY = true
            break
          }
        }
      }

      snapLines = newLines

      if (obj && obj._dtoolMaskShape && obj.group && obj.group._dtoolMaskGroup) {
        syncMaskClipPath(obj.group, obj)
      }
    })

    const ROTATION_SNAP_ANGLES = [0, 90, 180, 270, 360]
    const ROTATION_SNAP_THRESHOLD = 3

    c.on('object:rotating', (e) => {
      const obj = e.target
      if (!obj) { rotationSnap = null; return }

      let angle = obj.angle % 360
      if (angle < 0) angle += 360

      let snapped = false
      for (const target of ROTATION_SNAP_ANGLES) {
        const normalTarget = target % 360
        if (Math.abs(angle - normalTarget) < ROTATION_SNAP_THRESHOLD ||
            Math.abs(angle - normalTarget + 360) < ROTATION_SNAP_THRESHOLD ||
            Math.abs(angle - normalTarget - 360) < ROTATION_SNAP_THRESHOLD) {
          obj.set('angle', normalTarget)
          const center = obj.getCenterPoint()
          const bw = obj.getScaledWidth()
          const bh = obj.getScaledHeight()
          rotationSnap = {
            cx: center.x,
            cy: center.y,
            angle: normalTarget,
            w: bw,
            h: bh,
          }
          snapped = true
          break
        }
      }
      if (!snapped) rotationSnap = null
    })

    c.on('mouse:up', (opt) => {
      let needsRender = false
      if (snapLines.length > 0) {
        snapLines = []
        needsRender = true
      }
      if (rotationSnap) {
        rotationSnap = null
        needsRender = true
      }

      if (highlightedDropTarget) {
        highlightedDropTarget.style.boxShadow = ''
        highlightedDropTarget.style.transform = ''
        highlightedDropTarget = null
      }

      if (preDragState && opt.e) {
        const els = document.elementsFromPoint(opt.e.clientX, opt.e.clientY)
        const dropZone = els.find(el => el.dataset?.dtoolFillDrop === 'true')
        if (dropZone) {
          const dragObj = preDragState.obj
          dragObj.set({ left: preDragState.left, top: preDragState.top })
          dragObj.setCoords()
          try {
            const dataUrl = dragObj.toDataURL({ format: 'png' })
            const tileMode = dragObj._dtoolTileMode || 'none'
            dropZone.dispatchEvent(new CustomEvent('dtool-fill-drop', {
              detail: { dataUrl, tileMode },
              bubbles: false,
            }))
          } catch (err) {
            console.warn('Failed to create tile fill from canvas object:', err)
          }
          needsRender = true
        }
        preDragState = null
      }

      if (needsRender) c.requestRenderAll()
    })

    function getScenePoint(evt) {
      const rect = (c.upperCanvasEl || el).getBoundingClientRect()
      const vpt = c.viewportTransform
      const cx = evt.clientX - rect.left
      const cy = evt.clientY - rect.top
      return { x: (cx - vpt[4]) / vpt[0], y: (cy - vpt[5]) / vpt[3] }
    }

    function enterCropMode(canvas, target) {
      if (cropModeRef.current) exitCropMode(canvas, false)

      const sx = target.scaleX || 1
      const sy = target.scaleY || 1
      const objW = (target.width || 0) * sx
      const objH = (target.height || 0) * sy

      let objCX = target.left, objCY = target.top
      if (target.originX === 'left') objCX += objW / 2
      else if (target.originX === 'right') objCX -= objW / 2
      if (target.originY === 'top') objCY += objH / 2
      else if (target.originY === 'bottom') objCY -= objH / 2

      let cropL, cropT, cropW, cropH
      let savedClipPath = null
      if (target.clipPath) {
        const cp = target.clipPath
        savedClipPath = cp
        const cpsx = cp.scaleX || 1
        const cpsy = cp.scaleY || 1
        cropW = (cp.width || 0) * cpsx * sx
        cropH = (cp.height || 0) * cpsy * sy
        const clipCX = objCX + (cp.left || 0) * sx
        const clipCY = objCY + (cp.top || 0) * sy
        cropL = clipCX - cropW / 2
        cropT = clipCY - cropH / 2
        target.set('clipPath', null)
        target.dirty = true
      } else {
        cropL = objCX - objW / 2
        cropT = objCY - objH / 2
        cropW = objW
        cropH = objH
      }

      target.set({
        hasControls: false,
        hasBorders: false,
        lockMovementX: false,
        lockMovementY: false,
        selectable: true,
      })
      target.setCoords()
      canvas.setActiveObject(target)

      cropModeRef.current = {
        target,
        cropL, cropT, cropW, cropH,
        origLeft: target.left,
        origTop: target.top,
        savedClipPath,
        dragging: null,
        handleDrag: null,
      }
      canvas.requestRenderAll()
    }
    enterCropModeRef.current = enterCropMode

    function exitCropMode(canvas, apply) {
      const cm = cropModeRef.current
      if (!cm) return
      const target = cm.target
      if (!canvas.getObjects().includes(target)) {
        cropModeRef.current = null
        return
      }

      if (apply) {
        const sx = target.scaleX || 1
        const sy = target.scaleY || 1
        const objW = (target.width || 0) * sx
        const objH = (target.height || 0) * sy

        let objCX = target.left, objCY = target.top
        if (target.originX === 'left') objCX += objW / 2
        else if (target.originX === 'right') objCX -= objW / 2
        if (target.originY === 'top') objCY += objH / 2
        else if (target.originY === 'bottom') objCY -= objH / 2

        const cropCX = cm.cropL + cm.cropW / 2
        const cropCY = cm.cropT + cm.cropH / 2

        const clipPath = new FabricRect({
          left: (cropCX - objCX) / sx,
          top: (cropCY - objCY) / sy,
          width: cm.cropW / sx,
          height: cm.cropH / sy,
          originX: 'center',
          originY: 'center',
          absolutePositioned: false,
        })
        target.set('clipPath', clipPath)
        target.dirty = true
      } else if (cm.savedClipPath) {
        target.set('clipPath', cm.savedClipPath)
        target.dirty = true
      }

      target.set({
        hasControls: true,
        hasBorders: true,
      })
      target.setCoords()

      cropModeRef.current = null
      canvas.defaultCursor = 'default'
      canvas.hoverCursor = 'move'
      canvas.requestRenderAll()
    }

    const CROP_HANDLE_SIZE = 8
    function getCropHandles(cm, z) {
      const { cropL: l, cropT: t, cropW: w, cropH: h } = cm
      const hs = CROP_HANDLE_SIZE / z
      return [
        { id: 'tl', x: l, y: t, cursor: 'nwse-resize' },
        { id: 'tr', x: l + w, y: t, cursor: 'nesw-resize' },
        { id: 'bl', x: l, y: t + h, cursor: 'nesw-resize' },
        { id: 'br', x: l + w, y: t + h, cursor: 'nwse-resize' },
        { id: 'tm', x: l + w / 2, y: t, cursor: 'ns-resize' },
        { id: 'bm', x: l + w / 2, y: t + h, cursor: 'ns-resize' },
        { id: 'ml', x: l, y: t + h / 2, cursor: 'ew-resize' },
        { id: 'mr', x: l + w, y: t + h / 2, cursor: 'ew-resize' },
      ].map(h => ({ ...h, size: hs }))
    }

    function hitTestCropHandle(cm, sceneX, sceneY, z) {
      const handles = getCropHandles(cm, z)
      const tolerance = CROP_HANDLE_SIZE / z * 1.5
      for (const h of handles) {
        if (Math.abs(sceneX - h.x) < tolerance && Math.abs(sceneY - h.y) < tolerance) return h
      }
      return null
    }

    c.on('mouse:down:before', (opt) => {
      _cropHandleActive = false
      const cm = cropModeRef.current
      if (!cm) return
      const p = getScenePoint(opt.e)
      const z = c.getZoom() || 1
      const handle = hitTestCropHandle(cm, p.x, p.y, z)
      if (handle) {
        _cropHandleActive = true
        return
      }
      const inCrop = p.x >= cm.cropL && p.x <= cm.cropL + cm.cropW &&
                     p.y >= cm.cropT && p.y <= cm.cropT + cm.cropH
      if (inCrop) {
        _cropHandleActive = true
      }
    })

    c.on('mouse:down', (opt) => {
      const cm = cropModeRef.current
      if (!cm) return
      const p = getScenePoint(opt.e)
      const z = c.getZoom() || 1

      const handle = hitTestCropHandle(cm, p.x, p.y, z)
      if (handle) {
        cm.handleDrag = {
          id: handle.id,
          startX: p.x, startY: p.y,
          origCropL: cm.cropL, origCropT: cm.cropT,
          origCropW: cm.cropW, origCropH: cm.cropH,
        }
        cm.target.lockMovementX = true
        cm.target.lockMovementY = true
        if (c.getActiveObject() !== cm.target) {
          c.setActiveObject(cm.target)
        }
        _cropHandleActive = false
        return
      }

      _cropHandleActive = false
      const inCrop = p.x >= cm.cropL && p.x <= cm.cropL + cm.cropW &&
                     p.y >= cm.cropT && p.y <= cm.cropT + cm.cropH
      if (!inCrop && opt.target !== cm.target) {
        saveUndoState()
        exitCropMode(c, true)
        refreshObjects()
      }
    })

    c.on('mouse:move', (opt) => {
      const cm = cropModeRef.current
      if (!cm) return

      const p = getScenePoint(opt.e)

      if (cm.handleDrag) {
        const hd = cm.handleDrag
        const dx = p.x - hd.startX
        const dy = p.y - hd.startY
        const MIN_SIZE = 20

        let nl = hd.origCropL, nt = hd.origCropT
        let nw = hd.origCropW, nh = hd.origCropH

        if (hd.id.includes('l')) { nl += dx; nw -= dx }
        if (hd.id.includes('r')) { nw += dx }
        if (hd.id === 'tm' || hd.id === 'tl' || hd.id === 'tr') { nt += dy; nh -= dy }
        if (hd.id === 'bm' || hd.id === 'bl' || hd.id === 'br') { nh += dy }

        if (nw < MIN_SIZE) { if (hd.id.includes('l')) { nl = hd.origCropL + hd.origCropW - MIN_SIZE }; nw = MIN_SIZE }
        if (nh < MIN_SIZE) { if (hd.id === 'tm' || hd.id === 'tl' || hd.id === 'tr') { nt = hd.origCropT + hd.origCropH - MIN_SIZE }; nh = MIN_SIZE }

        cm.cropL = nl; cm.cropT = nt; cm.cropW = nw; cm.cropH = nh
        c.requestRenderAll()
        return
      }

      const z = c.getZoom() || 1
      const handle = hitTestCropHandle(cm, p.x, p.y, z)
      if (handle) {
        c.defaultCursor = handle.cursor
        c.hoverCursor = handle.cursor
      } else {
        const inCrop = p.x >= cm.cropL && p.x <= cm.cropL + cm.cropW &&
                       p.y >= cm.cropT && p.y <= cm.cropT + cm.cropH
        c.defaultCursor = inCrop ? 'move' : 'default'
        c.hoverCursor = inCrop ? 'move' : 'default'
      }
    })

    c.on('mouse:up', (opt) => {
      const cm = cropModeRef.current
      if (!cm) return
      if (cm.handleDrag) {
        cm.handleDrag = null
        cm.target.lockMovementX = false
        cm.target.lockMovementY = false
        c.requestRenderAll()
      }
    })

    c.on('mouse:down', (opt) => {
      if (activeToolRef.current !== 'blobBrush') return
      opt.e.stopPropagation()
      c.discardActiveObject()
      const p = getScenePoint(opt.e)
      blobDrawingRef.current = true
      blobPointsRef.current = [p]
      c.requestRenderAll()
    })

    c.on('mouse:move', (opt) => {
      if (!blobDrawingRef.current) return
      const p = getScenePoint(opt.e)
      blobPointsRef.current.push(p)
      c.requestRenderAll()
    })

    c.on('mouse:up', (opt) => {
      if (!blobDrawingRef.current) return
      blobDrawingRef.current = false
      const finalPt = getScenePoint(opt.e)
      blobPointsRef.current.push(finalPt)
      const points = blobPointsRef.current
      blobPointsRef.current = []
      if (points.length === 0) { c.requestRenderAll(); return }

      const radius = blobBrushSizeRef.current / 2
      const pathData = generateBlobPath(points, radius, blobBrushShapeRef.current, blobBrushAngleRef.current)
      if (!pathData) { c.requestRenderAll(); return }

      const fillColor = blobBrushColorRef.current
      const newBounds = {
        left: Math.min(...points.map(p => p.x)) - radius - 2,
        top: Math.min(...points.map(p => p.y)) - radius - 2,
        right: Math.max(...points.map(p => p.x)) + radius + 2,
        bottom: Math.max(...points.map(p => p.y)) + radius + 2,
      }

      const merged = mergeOverlappingBlobs(c, pathData, fillColor, newBounds)
      saveUndoState()

      const isBrushActive = activeToolRef.current === 'blobBrush'
      if (merged) {
        for (const obj of merged.toRemove) c.remove(obj)
        try {
          const p = new Path(merged.pathData, {
            fill: fillColor, stroke: null, strokeWidth: 0,
            _dtoolId: uuidv4(), originX: 'center', originY: 'center',
            selectable: !isBrushActive, evented: !isBrushActive,
          })
          c.add(p)
        } catch (_) {}
      } else {
        try {
          const p = new Path(pathData, {
            fill: fillColor, stroke: null, strokeWidth: 0,
            _dtoolId: uuidv4(), originX: 'center', originY: 'center',
            selectable: !isBrushActive, evented: !isBrushActive,
          })
          c.add(p)
        } catch (_) {}
      }
      c.requestRenderAll()
      refreshObjects()
    })

    /* ---- Pen tool handlers ---- */
    let penMouseDown = false
    let penDragStart = null

    c.on('mouse:down', (opt) => {
      if (activeToolRef.current !== 'pen') return
      const ps = penStateRef.current
      const sub = penSubToolRef.current
      if (sub === PEN_SUB_TOOLS.SELECT) return
      const p = getScenePoint(opt.e)
      opt.e.stopPropagation()
      opt.e.preventDefault()

      if (sub === PEN_SUB_TOOLS.PEN) {
        if (ps.editingPath) {
          const epPts = ps.editingPath.points
          const closeThresh = 10
          if (epPts.length > 1 && dist(p, epPts[0]) < closeThresh) {
            ps.editingPath.closed = true
            const pathData = pointsToSVGPath(ps.editingPath.points, true)
            if (pathData) {
              saveUndoState()
              const oldObj = ps.editingFabricObj
              const newPath = new Path(pathData, {
                fill: oldObj.fill || 'transparent',
                stroke: oldObj.stroke || '#000000',
                strokeWidth: oldObj.strokeWidth || 2,
                strokeUniform: true,
                opacity: oldObj.opacity,
                shadow: oldObj.shadow,
                _dtoolId: oldObj._dtoolId || uuidv4(),
                originX: 'center', originY: 'center',
                objectCaching: false,
              })
              c.remove(oldObj)
              c.add(newPath)
              ps.editingPath = null
              ps.editingFabricObj = null
              ps.selectedPointIndices = []
              c.setActiveObject(newPath)
              refreshObjects()
            }
            canvasState.setPenSubTool(PEN_SUB_TOOLS.SELECT)
            return
          }
          if (epPts.length > 0 && dist(p, epPts[epPts.length - 1]) < 8) {
            ps._reDraggingLast = true
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
          epPts.push({ x: p.x, y: p.y, type: 'corner' })
          penMouseDown = true
          penDragStart = { x: p.x, y: p.y }
          c.requestRenderAll()
          return
        }

        if (ps.points.length > 1 && dist(p, ps.points[0]) < 10) {
          ps.closed = true
          const pathData = pointsToSVGPath(ps.points, true)
          if (pathData) {
            saveUndoState()
            const fabricPath = createFabricPath(pathData, penFillColorRef.current, penStrokeColorRef.current, penStrokeWidthRef.current, getPenStyleOpts())
            fabricPath.selectable = true
            fabricPath.evented = true
            c.add(fabricPath)
            c.setActiveObject(fabricPath)
            c.requestRenderAll()
            refreshObjects()
          }
          ps.points = []
          ps.closed = false
          canvasState.setPenSubTool(PEN_SUB_TOOLS.SELECT)
          return
        }

        if (ps.points.length > 0 && dist(p, ps.points[ps.points.length - 1]) < 8) {
          ps._reDraggingLast = true
          penMouseDown = true
          penDragStart = { x: p.x, y: p.y }
          c.requestRenderAll()
          return
        }

        ps.points.push({ x: p.x, y: p.y, type: 'corner' })
        penMouseDown = true
        penDragStart = { x: p.x, y: p.y }
        ps.dragging = false
        ps.dragPoint = p
        c.requestRenderAll()

      } else if (sub === PEN_SUB_TOOLS.DIRECT_SELECT) {
        const currentZoom = c.getZoom() || 1
        const hitThresh = Math.max(12, 14 / currentZoom)

        if (!ps.editingPath) {
          let target = opt.target || c.findTarget(opt.e)
          if (!target || target.type !== 'path') {
            const allPaths = c.getObjects().filter(o => o.type === 'path' && o.visible !== false)
            let bestPath = null, bestDist = Infinity
            for (const pathObj of allPaths) {
              const parsed = parseFabricPathToPoints(pathObj)
              if (!parsed) continue
              for (const pt of parsed.points) {
                const d = dist(p, pt)
                if (d < bestDist) { bestDist = d; bestPath = pathObj }
              }
            }
            if (bestPath && bestDist < hitThresh * 2) target = bestPath
          }
          if (target && target.type === 'path') {
            const parsed = parseFabricPathToPoints(target)
            if (parsed) {
              ps.editingPath = parsed
              ps.editingFabricObj = target
              target.visible = false
              c.discardActiveObject()
              ps.selectedPointIndices = []

              let nearestIdx = -1, nearestDist = hitThresh
              for (let i = 0; i < parsed.points.length; i++) {
                const d = dist(p, parsed.points[i])
                if (d < nearestDist) { nearestDist = d; nearestIdx = i }
              }
              if (nearestIdx >= 0) {
                ps.selectedPointIndices = [nearestIdx]
                ps.dragHandleType = 'anchor'
                ps.dragHandleIndex = nearestIdx
                penMouseDown = true
                penDragStart = { x: p.x, y: p.y }
              }

              c.requestRenderAll()
              return
            }
          }
          return
        }

        const epPts = ps.editingPath.points

        for (let i = 0; i < epPts.length; i++) {
          const pt = epPts[i]
          if (pt.handleInX != null && dist(p, { x: pt.handleInX, y: pt.handleInY }) < hitThresh) {
            ps.dragHandleType = 'handleIn'
            ps.dragHandleIndex = i
            ps.selectedPointIndices = [i]
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
          if (pt.handleOutX != null && dist(p, { x: pt.handleOutX, y: pt.handleOutY }) < hitThresh) {
            ps.dragHandleType = 'handleOut'
            ps.dragHandleIndex = i
            ps.selectedPointIndices = [i]
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
        }

        for (let i = 0; i < epPts.length; i++) {
          if (dist(p, epPts[i]) < hitThresh) {
            if (opt.e.shiftKey) {
              const idx = ps.selectedPointIndices.indexOf(i)
              if (idx >= 0) ps.selectedPointIndices.splice(idx, 1)
              else ps.selectedPointIndices.push(i)
            } else {
              ps.selectedPointIndices = [i]
            }
            ps.dragHandleType = 'anchor'
            ps.dragHandleIndex = i
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
        }

        ps.selectedPointIndices = []
        c.requestRenderAll()

      } else if (sub === PEN_SUB_TOOLS.ADD_POINT) {
        if (!ps.editingPath) {
          const target = opt.target || c.findTarget(opt.e)
          if (target && target.type === 'path') {
            const parsed = parseFabricPathToPoints(target)
            if (parsed) {
              ps.editingPath = parsed
              ps.editingFabricObj = target
              target.visible = false
              c.discardActiveObject()
              c.requestRenderAll()
            }
          }
          return
        }
        const addZoom = c.getZoom() || 1
        const addThresh = Math.max(14, 16 / addZoom)
        const hit = findClosestPointOnPath(ps.editingPath.points, ps.editingPath.closed, p.x, p.y, addThresh)
        if (!hit) return
        const idx = hit.segIndex
        const pts = ps.editingPath.points
        const p0 = pts[idx]
        const p1 = pts[(idx + 1) % pts.length]
        const hasH = (p0.handleOutX != null) || (p1.handleInX != null)

        if (hasH) {
          const cp1 = { x: p0.handleOutX ?? p0.x, y: p0.handleOutY ?? p0.y }
          const cp2 = { x: p1.handleInX ?? p1.x, y: p1.handleInY ?? p1.y }
          const result = splitBezierAt(p0, cp1, cp2, p1, hit.t)

          p0.handleOutX = result.left.cp1.x
          p0.handleOutY = result.left.cp1.y

          const newPt = {
            x: result.left.end.x, y: result.left.end.y,
            handleInX: result.left.cp2.x, handleInY: result.left.cp2.y,
            handleOutX: result.right.cp1.x, handleOutY: result.right.cp1.y,
            type: 'smooth',
          }

          p1.handleInX = result.right.cp2.x
          p1.handleInY = result.right.cp2.y

          pts.splice(idx + 1, 0, newPt)
        } else {
          pts.splice(idx + 1, 0, { x: hit.point.x, y: hit.point.y, type: 'corner' })
        }

        ps.selectedPointIndices = [idx + 1]
        c.requestRenderAll()

      } else if (sub === PEN_SUB_TOOLS.DELETE_POINT) {
        if (!ps.editingPath) {
          const target = opt.target || c.findTarget(opt.e)
          if (target && target.type === 'path') {
            const parsed = parseFabricPathToPoints(target)
            if (parsed) {
              ps.editingPath = parsed
              ps.editingFabricObj = target
              target.visible = false
              c.discardActiveObject()
              c.requestRenderAll()
            }
          }
          return
        }
        const epPts = ps.editingPath.points
        const delZoom = c.getZoom() || 1
        const delThresh = Math.max(12, 14 / delZoom)
        for (let i = 0; i < epPts.length; i++) {
          if (dist(p, epPts[i]) < delThresh) {
            epPts.splice(i, 1)
            ps.selectedPointIndices = []
            c.requestRenderAll()
            return
          }
        }

      } else if (sub === PEN_SUB_TOOLS.CONVERT_POINT) {
        const currentZoom = c.getZoom() || 1
        const hitThresh = Math.max(12, 14 / currentZoom)

        if (!ps.editingPath) {
          let target = opt.target || c.findTarget(opt.e)
          if (!target || target.type !== 'path') {
            const allPaths = c.getObjects().filter(o => o.type === 'path' && o.visible !== false)
            let bestPath = null, bestDist = Infinity
            for (const pathObj of allPaths) {
              const parsed = parseFabricPathToPoints(pathObj)
              if (!parsed) continue
              for (const pt of parsed.points) {
                const d = dist(p, pt)
                if (d < bestDist) { bestDist = d; bestPath = pathObj }
              }
            }
            if (bestPath && bestDist < hitThresh * 2) target = bestPath
          }
          if (target && target.type === 'path') {
            const parsed = parseFabricPathToPoints(target)
            if (parsed) {
              ps.editingPath = parsed
              ps.editingFabricObj = target
              target.visible = false
              c.discardActiveObject()
              ps.selectedPointIndices = []

              let nearestIdx = -1, nearestDist = hitThresh
              for (let i = 0; i < parsed.points.length; i++) {
                const d = dist(p, parsed.points[i])
                if (d < nearestDist) { nearestDist = d; nearestIdx = i }
              }
              if (nearestIdx >= 0) {
                ps._convertAnchorIndex = nearestIdx
                ps._convertDragHandle = null
                ps._convertDragIndex = -1
                ps.selectedPointIndices = [nearestIdx]
                penMouseDown = true
                penDragStart = { x: p.x, y: p.y }
                ps._convertDidDrag = false
              }

              c.requestRenderAll()
            }
          }
          return
        }
        const epPts = ps.editingPath.points

        for (let i = 0; i < epPts.length; i++) {
          const pt = epPts[i]
          if (pt.handleInX != null && dist(p, { x: pt.handleInX, y: pt.handleInY }) < hitThresh) {
            pt.type = 'corner'
            ps._convertDragHandle = 'handleIn'
            ps._convertDragIndex = i
            ps.selectedPointIndices = [i]
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
          if (pt.handleOutX != null && dist(p, { x: pt.handleOutX, y: pt.handleOutY }) < hitThresh) {
            pt.type = 'corner'
            ps._convertDragHandle = 'handleOut'
            ps._convertDragIndex = i
            ps.selectedPointIndices = [i]
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            c.requestRenderAll()
            return
          }
        }

        for (let i = 0; i < epPts.length; i++) {
          if (dist(p, epPts[i]) < hitThresh) {
            ps._convertAnchorIndex = i
            ps._convertDragHandle = null
            ps._convertDragIndex = -1
            ps.selectedPointIndices = [i]
            penMouseDown = true
            penDragStart = { x: p.x, y: p.y }
            ps._convertDidDrag = false
            c.requestRenderAll()
            return
          }
        }
      }
    })

    c.on('mouse:move', (opt) => {
      if (activeToolRef.current !== 'pen') return
      const ps = penStateRef.current
      const sub = penSubToolRef.current
      if (sub === PEN_SUB_TOOLS.SELECT) return
      const p = getScenePoint(opt.e)

      if (penMouseDown && sub === PEN_SUB_TOOLS.PEN) {
        const dx = p.x - penDragStart.x
        const dy = p.y - penDragStart.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          ps.dragging = true
          const targetPts = ps.editingPath ? ps.editingPath.points : ps.points
          const lastPt = targetPts[targetPts.length - 1]
          lastPt.handleOutX = p.x
          lastPt.handleOutY = p.y
          if (opt.e.altKey || ps._reDraggingLast) {
            // Alt+drag: only move outgoing handle (break symmetry)
          } else {
            lastPt.handleInX = lastPt.x * 2 - p.x
            lastPt.handleInY = lastPt.y * 2 - p.y
          }
          lastPt.type = 'smooth'
        }
        c.requestRenderAll()
        return
      }

      if (penMouseDown && sub === PEN_SUB_TOOLS.DIRECT_SELECT && ps.editingPath) {
        const epPts = ps.editingPath.points
        const dx = p.x - penDragStart.x
        const dy = p.y - penDragStart.y
        const isSmooth = epPts[ps.dragHandleIndex]?.type === 'smooth'

        if (ps.dragHandleType === 'handleIn') {
          const pt = epPts[ps.dragHandleIndex]
          pt.handleInX = p.x
          pt.handleInY = p.y
          if (isSmooth && pt.handleOutX != null) {
            const d = dist({ x: pt.handleOutX, y: pt.handleOutY }, pt)
            const angle = Math.atan2(p.y - pt.y, p.x - pt.x) + Math.PI
            pt.handleOutX = pt.x + Math.cos(angle) * d
            pt.handleOutY = pt.y + Math.sin(angle) * d
          }
        } else if (ps.dragHandleType === 'handleOut') {
          const pt = epPts[ps.dragHandleIndex]
          pt.handleOutX = p.x
          pt.handleOutY = p.y
          if (isSmooth && pt.handleInX != null) {
            const d = dist({ x: pt.handleInX, y: pt.handleInY }, pt)
            const angle = Math.atan2(p.y - pt.y, p.x - pt.x) + Math.PI
            pt.handleInX = pt.x + Math.cos(angle) * d
            pt.handleInY = pt.y + Math.sin(angle) * d
          }
        } else if (ps.dragHandleType === 'anchor') {
          const indices = ps.selectedPointIndices.length > 0 ? ps.selectedPointIndices : [ps.dragHandleIndex]
          for (const idx of indices) {
            const pt = epPts[idx]
            pt.x += dx; pt.y += dy
            if (pt.handleInX != null) { pt.handleInX += dx; pt.handleInY += dy }
            if (pt.handleOutX != null) { pt.handleOutX += dx; pt.handleOutY += dy }
          }
          penDragStart = { x: p.x, y: p.y }
        }
        c.requestRenderAll()
        return
      }

      if (sub === PEN_SUB_TOOLS.ADD_POINT && ps.editingPath) {
        const hit = findClosestPointOnPath(ps.editingPath.points, ps.editingPath.closed, p.x, p.y)
        ps.hoveredSegment = hit
        c.requestRenderAll()
        return
      }

      if (penMouseDown && sub === PEN_SUB_TOOLS.CONVERT_POINT && ps.editingPath) {
        const epPts = ps.editingPath.points

        if (ps._convertDragHandle && ps._convertDragIndex >= 0) {
          const pt = epPts[ps._convertDragIndex]
          if (ps._convertDragHandle === 'handleIn') {
            pt.handleInX = p.x
            pt.handleInY = p.y
          } else {
            pt.handleOutX = p.x
            pt.handleOutY = p.y
          }
        } else if (ps._convertAnchorIndex >= 0) {
          const pt = epPts[ps._convertAnchorIndex]
          const adx = p.x - pt.x
          const ady = p.y - pt.y
          if (Math.abs(adx) > 2 || Math.abs(ady) > 2) {
            ps._convertDidDrag = true
            pt.handleOutX = p.x
            pt.handleOutY = p.y
            pt.handleInX = pt.x - adx
            pt.handleInY = pt.y - ady
            pt.type = 'smooth'
          }
        }
        c.requestRenderAll()
        return
      }

      if (!penMouseDown && !ps.editingPath &&
          (sub === PEN_SUB_TOOLS.CONVERT_POINT || sub === PEN_SUB_TOOLS.DIRECT_SELECT ||
           sub === PEN_SUB_TOOLS.ADD_POINT || sub === PEN_SUB_TOOLS.DELETE_POINT)) {
        let target = c.findTarget(opt.e)
        if (!target || target.type !== 'path') {
          const currentZoom = c.getZoom() || 1
          const hoverThresh = Math.max(20, 24 / currentZoom)
          const allPaths = c.getObjects().filter(o => o.type === 'path' && o.visible !== false)
          let bestPath = null, bestDist = Infinity
          for (const pathObj of allPaths) {
            const parsed = parseFabricPathToPoints(pathObj)
            if (!parsed) continue
            for (const pt of parsed.points) {
              const d = dist(p, pt)
              if (d < bestDist) { bestDist = d; bestPath = pathObj }
            }
            const segHit = findClosestPointOnPath(parsed.points, parsed.closed, p.x, p.y, hoverThresh)
            if (segHit && segHit.dist < bestDist) { bestDist = segHit.dist; bestPath = pathObj }
          }
          if (bestPath && bestDist < hoverThresh) target = bestPath
        }
        if (target && target.type === 'path') {
          const parsed = parseFabricPathToPoints(target)
          if (parsed && parsed.points.length > 0) {
            ps.editingPath = parsed
            ps.editingFabricObj = target
            target.visible = false
            c.discardActiveObject()
            ps.selectedPointIndices = []
            c.requestRenderAll()
          }
        }
      }

      if (!penMouseDown) {
        const targetPts = ps.editingPath ? ps.editingPath.points : ps.points
        ps.hoveredPointIndex = -1
        ps.hoveredHandleInfo = null
        const currentZoom = c.getZoom() || 1
        const hitThresh = Math.max(10, 12 / currentZoom)

        for (let i = 0; i < targetPts.length; i++) {
          const pt = targetPts[i]
          if (pt.handleInX != null && dist(p, { x: pt.handleInX, y: pt.handleInY }) < hitThresh) {
            ps.hoveredHandleInfo = { pointIndex: i, type: 'handleIn' }
            break
          }
          if (pt.handleOutX != null && dist(p, { x: pt.handleOutX, y: pt.handleOutY }) < hitThresh) {
            ps.hoveredHandleInfo = { pointIndex: i, type: 'handleOut' }
            break
          }
        }

        for (let i = 0; i < targetPts.length; i++) {
          if (dist(p, targetPts[i]) < hitThresh) {
            ps.hoveredPointIndex = i
            break
          }
        }
        ps.dragPoint = p
        c.requestRenderAll()
      }
    })

    c.on('mouse:up', (opt) => {
      if (activeToolRef.current !== 'pen') return
      const ps = penStateRef.current
      const sub = penSubToolRef.current

      if (penMouseDown && ps.editingPath && sub === PEN_SUB_TOOLS.DIRECT_SELECT) {
        ps.dragHandleType = null
        ps.dragHandleIndex = -1
      }

      if (penMouseDown && ps.editingPath && sub === PEN_SUB_TOOLS.CONVERT_POINT) {
        if (ps._convertAnchorIndex >= 0 && !ps._convertDidDrag) {
          const pt = ps.editingPath.points[ps._convertAnchorIndex]
          if (pt.type === 'smooth') {
            delete pt.handleInX; delete pt.handleInY
            delete pt.handleOutX; delete pt.handleOutY
            pt.type = 'corner'
          }
        }
        ps._convertAnchorIndex = -1
        ps._convertDragHandle = null
        ps._convertDragIndex = -1
        ps._convertDidDrag = false
        c.requestRenderAll()
      }

      penMouseDown = false
      penDragStart = null
      ps.dragging = false
      ps._reDraggingLast = false
    })

    const handlePenEscape = (e) => {
      if (e.key === 'Escape' && activeToolRef.current === 'pen') {
        const ps = penStateRef.current
        if (ps.editingPath && ps.editingFabricObj) {
          const pathData = pointsToSVGPath(ps.editingPath.points, ps.editingPath.closed)
          if (pathData && ps.editingPath.points.length >= 2) {
            saveUndoState()
            const oldObj = ps.editingFabricObj
            const newPath = new Path(pathData, {
              fill: oldObj.fill || 'transparent',
              stroke: oldObj.stroke || '#000000',
              strokeWidth: oldObj.strokeWidth || 2,
              strokeUniform: true,
              opacity: oldObj.opacity,
              shadow: oldObj.shadow,
              _dtoolId: oldObj._dtoolId || uuidv4(),
              originX: 'center', originY: 'center',
              objectCaching: false,
            })
            c.remove(oldObj)
            c.add(newPath)
            refreshObjects()
          } else {
            ps.editingFabricObj.visible = true
          }
          ps.editingPath = null
          ps.editingFabricObj = null
          ps.selectedPointIndices = []
          c.requestRenderAll()
        } else if (ps.points.length > 1) {
          const pathData = pointsToSVGPath(ps.points, false)
          if (pathData) {
            saveUndoState()
            const fabricPath = createFabricPath(pathData, penFillColorRef.current, penStrokeColorRef.current, penStrokeWidthRef.current, getPenStyleOpts())
            fabricPath.selectable = false
            fabricPath.evented = false
            c.add(fabricPath)
            refreshObjects()
          }
          ps.points = []
          ps.closed = false
          c.requestRenderAll()
        } else {
          ps.points = []
          ps.closed = false
          c.requestRenderAll()
        }
      }

      if (e.key === 'Enter' && activeToolRef.current === 'pen') {
        const ps = penStateRef.current
        if (ps.editingPath && ps.editingFabricObj) {
          const pathData = pointsToSVGPath(ps.editingPath.points, ps.editingPath.closed)
          if (pathData && ps.editingPath.points.length >= 2) {
            saveUndoState()
            const oldObj = ps.editingFabricObj
            const newPath = new Path(pathData, {
              fill: oldObj.fill || 'transparent',
              stroke: oldObj.stroke || '#000000',
              strokeWidth: oldObj.strokeWidth || 2,
              strokeUniform: true,
              opacity: oldObj.opacity,
              shadow: oldObj.shadow,
              _dtoolId: oldObj._dtoolId || uuidv4(),
              originX: 'center', originY: 'center',
              objectCaching: false,
            })
            c.remove(oldObj)
            c.add(newPath)
            refreshObjects()
          } else {
            ps.editingFabricObj.visible = true
          }
          ps.editingPath = null
          ps.editingFabricObj = null
          ps.selectedPointIndices = []
          c.requestRenderAll()
        }
      }

      if (e.key === 'Delete' && activeToolRef.current === 'pen') {
        const ps = penStateRef.current
        if (ps.editingPath && ps.selectedPointIndices.length > 0) {
          const sorted = [...ps.selectedPointIndices].sort((a, b) => b - a)
          for (const idx of sorted) {
            ps.editingPath.points.splice(idx, 1)
          }
          ps.selectedPointIndices = []
          c.requestRenderAll()
        }
      }
    }
    document.addEventListener('keydown', handlePenEscape)

    const handleCropKeys = (e) => {
      if (!cropModeRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        const target = cropModeRef.current.target
        target.set({ left: cropModeRef.current.origLeft, top: cropModeRef.current.origTop })
        target.setCoords()
        exitCropMode(c, false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        saveUndoState()
        exitCropMode(c, true)
        refreshObjects()
      }
    }
    document.addEventListener('keydown', handleCropKeys)

    const upperCanvas = c.upperCanvasEl || c.wrapperEl?.querySelector('.upper-canvas')
    let _hoverRafId = null
    const trackMouse = (e) => {
      const rect = (upperCanvas || el).getBoundingClientRect()
      mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (!_hoverRafId) {
        _hoverRafId = requestAnimationFrame(() => { _hoverRafId = null; c.requestRenderAll() })
      }
    }
    const clearMouse = () => { mousePosRef.current = { x: -9999, y: -9999 }; c.requestRenderAll() }
    const target = upperCanvas || el.parentElement
    target.addEventListener('mousemove', trackMouse)
    target.addEventListener('mouseleave', clearMouse)

    const onFontsLoaded = () => {
      cache.clearFontCache()
      c.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
          obj._forceClearCache = true
          obj.dirty = true
        }
      })
      c.requestRenderAll()
    }
    document.fonts?.addEventListener('loadingdone', onFontsLoaded)

    return () => {
      if (_hoverRafId) cancelAnimationFrame(_hoverRafId)
      document.removeEventListener('keydown', handlePenEscape)
      document.removeEventListener('keydown', handleCropKeys)
      target.removeEventListener('mousemove', trackMouse)
      target.removeEventListener('mouseleave', clearMouse)
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded)
      canvasRef.current = null
      setFabricCanvas(null)
      c.dispose()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleEnterCrop = (e) => {
      const target = e.detail?.target
      if (!target || !canvas.getObjects().includes(target)) return
      if (enterCropModeRef.current) enterCropModeRef.current(canvas, target)
    }
    document.addEventListener('dtool-enter-crop', handleEnterCrop)
    return () => document.removeEventListener('dtool-enter-crop', handleEnterCrop)
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setZoom(zoom)
    canvas.viewportTransform[4] = PASTEBOARD * zoom
    canvas.viewportTransform[5] = PASTEBOARD * zoom
    canvas.setWidth(totalW * zoom)
    canvas.setHeight(totalH * zoom)
    canvas.renderAll()
  }, [zoom])

  const calcFitZoom = useCallback(() => {
    const el = outerRef.current
    if (!el) return 1
    const availW = el.clientWidth
    const availH = el.clientHeight
    if (availW <= 0 || availH <= 0) return 1
    const zH = (availH * 0.92) / canvasH
    const zW = (availW * 0.88) / canvasW
    return Math.min(zW, zH, 2)
  }, [canvasW, canvasH])

  useEffect(() => {
    canvasState.fitToViewRef.current = () => {
      const z = calcFitZoom()
      canvasState.setZoom(+(z.toFixed(2)))
    }
    const timer = requestAnimationFrame(() => {
      const z = calcFitZoom()
      canvasState.setZoom(+(z.toFixed(2)))
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) canvas.requestRenderAll()
  }, [canvasState.darkMode])

  useEffect(() => {
    activeToolRef.current = activeTool
    const canvas = canvasRef.current
    if (!canvas) return
    if (activeTool === 'blobBrush') {
      canvas.discardActiveObject()
      canvas.selection = false
      canvas.forEachObject(o => { o.selectable = false; o.evented = false })
      canvas.defaultCursor = 'none'
      canvas.hoverCursor = 'none'
    } else if (activeTool === 'pen') {
      canvas.discardActiveObject()
      const sub = penSubToolRef.current
      if (sub === PEN_SUB_TOOLS.SELECT) {
        canvas.selection = true
        canvas.forEachObject(o => { o.selectable = true; o.evented = true })
        canvas.defaultCursor = 'default'
        canvas.hoverCursor = 'move'
      } else {
        canvas.selection = false
        const needsPathEvents = sub !== PEN_SUB_TOOLS.PEN
        canvas.forEachObject(o => {
          o.selectable = false
          o.evented = (needsPathEvents && o.type === 'path')
        })
        if (sub === PEN_SUB_TOOLS.DIRECT_SELECT) {
          canvas.defaultCursor = 'default'
          canvas.hoverCursor = 'pointer'
        } else if (sub === PEN_SUB_TOOLS.ADD_POINT) {
          canvas.defaultCursor = 'copy'
          canvas.hoverCursor = 'copy'
        } else if (sub === PEN_SUB_TOOLS.DELETE_POINT) {
          canvas.defaultCursor = 'not-allowed'
          canvas.hoverCursor = 'not-allowed'
        } else if (sub === PEN_SUB_TOOLS.CONVERT_POINT) {
          canvas.defaultCursor = 'crosshair'
          canvas.hoverCursor = 'crosshair'
        } else {
          canvas.defaultCursor = 'crosshair'
          canvas.hoverCursor = 'crosshair'
        }
      }
      const ps = penStateRef.current
      if (!ps.editingPath) {
        ps.points = []
        ps.closed = false
      }
    } else {
      const ps = penStateRef.current
      if (ps.editingPath && ps.editingFabricObj) {
        const pathData = pointsToSVGPath(ps.editingPath.points, ps.editingPath.closed)
        if (pathData && ps.editingPath.points.length >= 2) {
          saveUndoState()
          const oldObj = ps.editingFabricObj
          const newPath = new Path(pathData, {
            fill: oldObj.fill || 'transparent',
            stroke: oldObj.stroke || '#000000',
            strokeWidth: oldObj.strokeWidth || 2,
            strokeUniform: true,
            opacity: oldObj.opacity,
            shadow: oldObj.shadow,
            _dtoolId: oldObj._dtoolId || uuidv4(),
            originX: 'center', originY: 'center',
            objectCaching: false,
          })
          canvas.remove(oldObj)
          canvas.add(newPath)
          refreshObjects()
        } else {
          ps.editingFabricObj.visible = true
        }
      } else if (ps.points.length > 1 && !ps.closed) {
        finalizePenPath()
      }
      ps.points = []
      ps.closed = false
      ps.editingPath = null
      ps.editingFabricObj = null
      ps.selectedPointIndices = []
      canvas.selection = true
      canvas.forEachObject(o => { o.selectable = true; o.evented = true })
      canvas.defaultCursor = 'default'
      canvas.hoverCursor = 'move'
    }
    canvas.renderAll()
  }, [activeTool])

  useEffect(() => { blobBrushSizeRef.current = blobBrushSize }, [blobBrushSize])
  useEffect(() => { blobBrushColorRef.current = blobBrushColor }, [blobBrushColor])
  useEffect(() => { blobBrushShapeRef.current = blobBrushShape }, [blobBrushShape])
  useEffect(() => { blobBrushAngleRef.current = blobBrushAngle }, [blobBrushAngle])
  useEffect(() => {
    penSubToolRef.current = penSubTool
    penStateRef.current.subTool = penSubTool
    const canvas = canvasRef.current
    if (canvas && activeTool === 'pen') {
      if (penSubTool === PEN_SUB_TOOLS.SELECT) {
        const ps = penStateRef.current
        if (ps.editingPath && ps.editingFabricObj) {
          const pathData = pointsToSVGPath(ps.editingPath.points, ps.editingPath.closed)
          if (pathData && ps.editingPath.points.length >= 2) {
            saveUndoState()
            const oldObj = ps.editingFabricObj
            const newPath = new Path(pathData, {
              fill: oldObj.fill || 'transparent',
              stroke: oldObj.stroke || '#000000',
              strokeWidth: oldObj.strokeWidth || 2,
              strokeUniform: true,
              opacity: oldObj.opacity,
              shadow: oldObj.shadow,
              _dtoolId: oldObj._dtoolId || uuidv4(),
              originX: 'center', originY: 'center',
              objectCaching: false,
            })
            canvas.remove(oldObj)
            canvas.add(newPath)
            refreshObjects()
          } else {
            ps.editingFabricObj.visible = true
          }
          ps.editingPath = null
          ps.editingFabricObj = null
          ps.selectedPointIndices = []
        }
        if (ps.points.length > 1) {
          const pathData = pointsToSVGPath(ps.points, false)
          if (pathData) {
            saveUndoState()
            const fabricPath = createFabricPath(pathData, penFillColorRef.current, penStrokeColorRef.current, penStrokeWidthRef.current, getPenStyleOpts())
            canvas.add(fabricPath)
            refreshObjects()
          }
          ps.points = []
          ps.closed = false
        }
        canvas.selection = true
        canvas.forEachObject(o => { o.selectable = true; o.evented = true })
        canvas.defaultCursor = 'default'
        canvas.hoverCursor = 'move'
      } else {
        canvas.selection = false
        const needsPathEvents = penSubTool !== PEN_SUB_TOOLS.PEN
        canvas.forEachObject(o => {
          o.selectable = false
          o.evented = (needsPathEvents && o.type === 'path')
        })
        if (penSubTool === PEN_SUB_TOOLS.DIRECT_SELECT) {
          canvas.defaultCursor = 'default'
          canvas.hoverCursor = 'pointer'
        } else if (penSubTool === PEN_SUB_TOOLS.ADD_POINT) {
          canvas.defaultCursor = 'copy'
          canvas.hoverCursor = 'copy'
        } else if (penSubTool === PEN_SUB_TOOLS.DELETE_POINT) {
          canvas.defaultCursor = 'not-allowed'
          canvas.hoverCursor = 'not-allowed'
        } else if (penSubTool === PEN_SUB_TOOLS.CONVERT_POINT) {
          canvas.defaultCursor = 'crosshair'
          canvas.hoverCursor = 'crosshair'
        } else {
          canvas.defaultCursor = 'crosshair'
          canvas.hoverCursor = 'crosshair'
        }
      }
      canvas.requestRenderAll()
    }
  }, [penSubTool, activeTool])
  useEffect(() => { penStrokeColorRef.current = penStrokeColor }, [penStrokeColor])
  useEffect(() => { penFillColorRef.current = penFillColor }, [penFillColor])
  useEffect(() => { penStrokeWidthRef.current = penStrokeWidth }, [penStrokeWidth])
  useEffect(() => { penDashArrayRef.current = canvasState.penDashArray || [] }, [canvasState.penDashArray])
  useEffect(() => { penLineCapRef.current = canvasState.penLineCap || 'butt' }, [canvasState.penLineCap])
  useEffect(() => { penLineJoinRef.current = canvasState.penLineJoin || 'miter' }, [canvasState.penLineJoin])
  useEffect(() => { penOpacityRef.current = canvasState.penOpacity ?? 1 }, [canvasState.penOpacity])

  const getPenStyleOpts = () => ({
    strokeDashArray: penDashArrayRef.current,
    strokeLineCap: penLineCapRef.current,
    strokeLineJoin: penLineJoinRef.current,
    opacity: penOpacityRef.current,
  })

  const finalizePenPath = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ps = penStateRef.current
    if (ps.points.length < 2) return
    saveUndoState()
    const pathData = pointsToSVGPath(ps.points, ps.closed)
    if (!pathData) return
    const fabricPath = createFabricPath(pathData, penFillColorRef.current, penStrokeColorRef.current, penStrokeWidthRef.current, getPenStyleOpts())
    const isPenActive = activeToolRef.current === 'pen'
    fabricPath.selectable = !isPenActive
    fabricPath.evented = !isPenActive
    canvas.add(fabricPath)
    canvas.requestRenderAll()
    refreshObjects()
    ps.points = []
    ps.closed = false
  }, [])

  const commitEditingPath = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ps = penStateRef.current
    if (!ps.editingPath || !ps.editingFabricObj) return
    saveUndoState()
    const pathData = pointsToSVGPath(ps.editingPath.points, ps.editingPath.closed)
    if (!pathData) return
    const oldObj = ps.editingFabricObj
    const newPath = new Path(pathData, {
      fill: oldObj.fill || 'transparent',
      stroke: oldObj.stroke || '#000000',
      strokeWidth: oldObj.strokeWidth || 2,
      strokeUniform: true,
      opacity: oldObj.opacity,
      shadow: oldObj.shadow,
      _dtoolId: oldObj._dtoolId || uuidv4(),
      originX: 'center',
      originY: 'center',
      objectCaching: false,
    })
    canvas.remove(oldObj)
    canvas.add(newPath)
    ps.editingFabricObj = newPath
    canvas.requestRenderAll()
    refreshObjects()
  }, [])

  const isMediaFile = (file) => {
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    return t.startsWith('image/') || t.startsWith('video/') ||
      n.endsWith('.svg') || n.endsWith('.gif') || n.endsWith('.webm') ||
      n.endsWith('.webp') || n.endsWith('.mp4') || n.endsWith('.apng') ||
      n.endsWith('.avif') || n.endsWith('.png') || n.endsWith('.jpg') ||
      n.endsWith('.jpeg') || n.endsWith('.bmp') || n.endsWith('.ico')
  }

  const isVideoType = (file) => {
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    return t.startsWith('video/') || n.endsWith('.webm') || n.endsWith('.mp4')
  }

  const isGifType = (file) => {
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    return t === 'image/gif' || n.endsWith('.gif')
  }

  const isAnimatedImageType = (file) => {
    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    return t === 'image/gif' || t === 'image/apng' || t === 'image/webp' ||
      n.endsWith('.gif') || n.endsWith('.apng') || n.endsWith('.webp')
  }

  const computePlacement = (w, h, dropX, dropY) => {
    const maxDim = 200
    let scale = 1
    if (w > maxDim || h > maxDim) scale = maxDim / Math.max(w, h)
    const pw = w * scale, ph = h * scale
    const center = dropX === canvasW / 2 && dropY === canvasH / 2
    return {
      scale,
      left: center ? dropX - pw / 2 : dropX,
      top: center ? dropY - ph / 2 : dropY,
    }
  }

  const placeMediaOnCanvas = async (canvas, file, dataUrl, dropX, dropY) => {
    const isVideo = isVideoType(file)
    const isAnimImg = isAnimatedImageType(file)

    if (isVideo) {
      const blobUrl = URL.createObjectURL(file)

      try {
        const videoEl = await prepareVideoElement(blobUrl)
        saveUndoState()

        const vw = videoEl.videoWidth || 320
        const vh = videoEl.videoHeight || 240
        const { scale, left, top } = computePlacement(vw, vh, dropX, dropY)

        const proxyCvs = createFrameCanvas(vw, vh)
        const proxyCtx = proxyCvs.getContext('2d')
        proxyCtx.drawImage(videoEl, 0, 0)

        const thumbDataUrl = proxyCvs.toDataURL('image/jpeg', 0.7)
        const assetId = addAsset(file, blobUrl, thumbDataUrl)

        const objId = uuidv4()
        const audioTrackId = uuidv4()
        const fabricImg = new FabricImage(proxyCvs, {
          left, top,
          _dtoolId: objId,
          _dtoolAssetId: assetId,
          _dtoolAnimated: true,
          _dtoolMediaType: 'video',
          _dtoolMediaElement: videoEl,
          _dtoolProxyCanvas: proxyCvs,
          _dtoolBlobUrl: blobUrl,
          _dtoolLayerName: 'Motion',
          _dtoolVideoAudioTrackId: audioTrackId,
          objectCaching: false,
        })
        if (scale !== 1) fabricImg.scale(scale)
        canvas.add(fabricImg)
        canvas.setActiveObject(fabricImg)

        const audioName = file.name ? file.name.replace(/\.[^.]+$/, '') + ' (Audio)' : 'Video Audio'
        addAudioTrack(audioTrackId, blobUrl, audioName)

        if (autoplay) {
          videoEl.play().catch(() => {})
          setTimeout(() => playAudioTrack(audioTrackId), 50)
        }
        fabricImg.dirty = true
        canvas.requestRenderAll()
        refreshObjects()
        setTimelineOpen(true)

        setTimeout(() => {
          if (videoEl.readyState >= 2) {
            const ctx = proxyCvs.getContext('2d')
            ctx.clearRect(0, 0, proxyCvs.width, proxyCvs.height)
            ctx.drawImage(videoEl, 0, 0)
          }
          fabricImg.dirty = true
          fabricImg.setElement(proxyCvs)
          canvas.requestRenderAll()
        }, 200)
      } catch (err) {
        console.error('Failed to load video:', err)
        URL.revokeObjectURL(blobUrl)
      }
    } else if (isAnimImg) {
      const assetId = addAsset(file, dataUrl)

      try {
        const blob = file instanceof Blob ? file : await (await fetch(dataUrl)).blob()
        const isGif = isGifType(file)
        let decoded
        if (isGif) {
          const buf = await blob.arrayBuffer()
          decoded = await decodeGif(buf)
        } else {
          decoded = await decodeAnimatedWebP(blob)
        }
        saveUndoState()

        const { frames, durations, width, height } = decoded
        const { scale, left, top } = computePlacement(width, height, dropX, dropY)

        const proxyCvs = createFrameCanvas(width, height)
        drawFrameToCanvas(proxyCvs, frames[0])

        const animator = new FrameAnimator(frames, durations)

        const fabricImg = new FabricImage(proxyCvs, {
          left, top,
          _dtoolId: uuidv4(),
          _dtoolAssetId: assetId,
          _dtoolAnimated: true,
          _dtoolMediaType: 'animImage',
          _dtoolProxyCanvas: proxyCvs,
          _dtoolFrameAnimator: animator,
          _dtoolLayerName: 'Motion',
          objectCaching: false,
        })
        if (scale !== 1) fabricImg.scale(scale)
        canvas.add(fabricImg)
        canvas.setActiveObject(fabricImg)
        canvas.renderAll()
        refreshObjects()
        setTimelineOpen(true)
      } catch (err) {
        console.error('Failed to decode animated image:', err)
      }
    } else {
      const assetId = addAsset(file, dataUrl)
      const imgEl = new Image()
      imgEl.onload = () => {
        saveUndoState()
        const { scale, left, top } = computePlacement(imgEl.width, imgEl.height, dropX, dropY)

        const fabricImg = new FabricImage(imgEl, {
          left, top,
          _dtoolId: uuidv4(),
          _dtoolAssetId: assetId,
        })
        if (scale !== 1) fabricImg.scale(scale)
        canvas.add(fabricImg)
        canvas.setActiveObject(fabricImg)
        canvas.renderAll()
        refreshObjects()
      }
      imgEl.src = dataUrl
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const files = Array.from(e.dataTransfer.files).filter(isMediaFile)

    const canvasRect = containerRef.current?.getBoundingClientRect()
    let dropX, dropY
    if (canvasRect &&
        e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom) {
      dropX = (e.clientX - canvasRect.left) / zoom - PASTEBOARD
      dropY = (e.clientY - canvasRect.top) / zoom - PASTEBOARD
    } else {
      dropX = canvasW / 2
      dropY = canvasH / 2
    }

    if (files.length === 0) {
      const uri = e.dataTransfer.getData('text/uri-list')
      if (uri && uri.toLowerCase().endsWith('.svg')) {
        try {
          const resp = await fetch(uri)
          const svgText = await resp.text()
          const { objects } = await loadSVGFromString(svgText)
          const valid = objects.filter(Boolean)
          if (valid.length === 0) return

          saveUndoState()
          const obj = valid.length === 1 ? valid[0] : new Group(valid)
          obj.set({ _dtoolId: uuidv4() })

          const maxDim = 200
          const w = (obj.width || 0) * (obj.scaleX || 1)
          const h = (obj.height || 0) * (obj.scaleY || 1)
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h)
            obj.set({ scaleX: scale, scaleY: scale })
          }
          obj.set({ left: dropX, top: dropY })
          canvas.add(obj)
          canvas.setActiveObject(obj)
          canvas.renderAll()
          refreshObjects()
        } catch (err) {
          console.warn('SVG drop failed:', err)
        }
        return
      }
      if (uri) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          saveUndoState()
          const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
          const maxDim = 200
          if (fImg.width > maxDim || fImg.height > maxDim) {
            const scale = maxDim / Math.max(fImg.width, fImg.height)
            fImg.set({ scaleX: scale, scaleY: scale })
          }
          fImg.set({ left: dropX, top: dropY })
          canvas.add(fImg)
          canvas.setActiveObject(fImg)
          canvas.renderAll()
          refreshObjects()
        }
        img.src = uri
        return
      }
    }

    files.forEach((file) => {
      if (isVideoType(file)) {
        placeMediaOnCanvas(canvas, file, null, dropX, dropY)
      } else {
        const reader = new FileReader()
        reader.onload = (ev) => {
          placeMediaOnCanvas(canvas, file, ev.target.result, dropX, dropY)
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleAddImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,video/webm,video/mp4,.svg,.gif,.webm,.mp4,.webp,.apng,.avif'
    input.multiple = true
    input.onchange = (e) => {
      const canvas = canvasRef.current
      if (!canvas) return
      Array.from(e.target.files).forEach((file) => {
        if (isVideoType(file)) {
          placeMediaOnCanvas(canvas, file, null, canvasW / 2, canvasH / 2)
        } else {
          const reader = new FileReader()
          reader.onload = (ev) => {
            placeMediaOnCanvas(canvas, file, ev.target.result, canvasW / 2, canvasH / 2)
          }
          reader.readAsDataURL(file)
        }
      })
    }
    input.click()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const z = calcFitZoom()
    const newTotalW = canvasW + 2 * PASTEBOARD
    const newTotalH = canvasH + 2 * PASTEBOARD
    canvas.setZoom(z)
    canvas.setDimensions({ width: newTotalW * z, height: newTotalH * z })
    canvas.viewportTransform[4] = PASTEBOARD * z
    canvas.viewportTransform[5] = PASTEBOARD * z
    canvas.renderAll()
    canvasState.setZoom(+(z.toFixed(2)))
  }, [canvasW, canvasH])

  useEffect(() => {
    const animate = (timestamp) => {
      const canvas = canvasRef.current
      if (!canvas) {
        animFrameRef.current = requestAnimationFrame(animate)
        return
      }

      let needsRender = false

      const tickAnimated = (obj, parentGroup) => {
        if (obj._dtoolAnimated) {
          if (obj._dtoolMediaType === 'video') {
            const videoEl = obj._dtoolMediaElement
            const proxyCvs = obj._dtoolProxyCanvas
            if (!videoEl || !proxyCvs) return

            if (autoplay) {
              if (videoEl.paused) videoEl.play().catch(() => {})
              if (videoEl.readyState >= 2) {
                const ctx = proxyCvs.getContext('2d')
                ctx.clearRect(0, 0, proxyCvs.width, proxyCvs.height)
                ctx.drawImage(videoEl, 0, 0)
                obj.dirty = true
                obj.set('dirty', true)
                if (parentGroup) { parentGroup.dirty = true; parentGroup.set('dirty', true) }
                needsRender = true
              }
            } else {
              if (!videoEl.paused) videoEl.pause()
            }
          } else if (obj._dtoolFrameAnimator) {
            if (autoplay) {
              const animator = obj._dtoolFrameAnimator
              const changed = animator.tick(timestamp)
              if (changed) {
                const proxyCvs = obj._dtoolProxyCanvas
                if (proxyCvs) {
                  drawFrameToCanvas(proxyCvs, animator.getCurrentFrame())
                  obj.dirty = true
                  obj.set('dirty', true)
                  if (parentGroup) { parentGroup.dirty = true; parentGroup.set('dirty', true) }
                  needsRender = true
                }
              }
            }
          }
        }
        if (obj._objects) {
          obj._objects.forEach(child => tickAnimated(child, obj))
        }
      }

      canvas.getObjects().forEach(obj => {
        tickAnimated(obj, null)

        if (obj._dtoolMotionFill) {
          const proxy = obj._dtoolMotionFillProxy
          if (!proxy) return
          const pw = proxy.width, ph = proxy.height
          const pctx = proxy.getContext('2d')

          if (obj._dtoolMotionFillType === 'video') {
            const vid = obj._dtoolMotionFillElement
            if (!vid) return
            if (autoplay) {
              if (vid.paused) vid.play().catch(() => {})
              if (vid.readyState >= 2) {
                const sw = obj._dtoolMotionFillSrcW || vid.videoWidth
                const sh = obj._dtoolMotionFillSrcH || vid.videoHeight
                const sc = Math.max(pw / sw, ph / sh)
                const dw = sw * sc, dh = sh * sc
                pctx.clearRect(0, 0, pw, ph)
                pctx.drawImage(vid, (pw - dw) / 2, (ph - dh) / 2, dw, dh)
                obj.set('fill', new Pattern({ source: proxy, repeat: 'no-repeat' }))
                obj.dirty = true
                needsRender = true
              }
            } else {
              if (!vid.paused) vid.pause()
            }
          } else if (obj._dtoolMotionFillAnimator) {
            if (autoplay) {
              const animator = obj._dtoolMotionFillAnimator
              const changed = animator.tick(timestamp)
              if (changed) {
                const frame = animator.getCurrentFrame()
                const sw = obj._dtoolMotionFillSrcW || frame.width
                const sh = obj._dtoolMotionFillSrcH || frame.height
                const sc = Math.max(pw / sw, ph / sh)
                const dw = sw * sc, dh = sh * sc
                pctx.clearRect(0, 0, pw, ph)
                pctx.drawImage(frame, (pw - dw) / 2, (ph - dh) / 2, dw, dh)
                obj.set('fill', new Pattern({ source: proxy, repeat: 'no-repeat' }))
                obj.dirty = true
                needsRender = true
              }
            }
          }
        }
      })
      if (needsRender) {
        canvas.requestRenderAll()
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [autoplay])

  const hasObjects = canvasRef.current && canvasRef.current.getObjects().length > 0

  const syncMaskClipPath = useCallback(async (group, maskShapeChild) => {
    if (!group || !group._dtoolMaskGroup || !maskShapeChild) return
    const newClip = await maskShapeChild.clone()
    newClip.set({
      left: maskShapeChild.left,
      top: maskShapeChild.top,
      originX: maskShapeChild.originX || 'center',
      originY: maskShapeChild.originY || 'center',
      angle: maskShapeChild.angle || 0,
      scaleX: maskShapeChild.scaleX || 1,
      scaleY: maskShapeChild.scaleY || 1,
      fill: '#000',
      stroke: null,
      strokeWidth: 0,
      absolutePositioned: false,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    })
    group.clipPath = newClip
    group.dirty = true
    group.set('dirty', true)
    canvasRef.current?.renderAll()
  }, [])

  const removeMaskFromGroup = useCallback((group) => {
    const canvas = canvasRef.current
    if (!canvas || !group || !group._dtoolMaskGroup) return
    saveUndoState()

    const idx = canvas.getObjects().indexOf(group)

    const items = group.removeAll()

    const contentItems = items.filter(c => !c._dtoolMaskShape)

    group._dtoolReordering = true
    canvas.remove(group)
    delete group._dtoolReordering

    contentItems.forEach((child, ci) => {
      child._dtoolMaskedContent = undefined
      child._dtoolMaskedImage = undefined
      child.setCoords()
      if (idx >= 0) canvas.insertAt(idx + ci, child)
      else canvas.add(child)
    })

    if (contentItems.length > 0) canvas.setActiveObject(contentItems[0])

    canvas.renderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const createMask = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maskShape = canvas.getActiveObject()
    if (!maskShape || maskShape instanceof ActiveSelection) return

    const allObjs = canvas.getObjects().filter(o => !o._dtoolTileClone)
    const topIdx = allObjs.indexOf(maskShape)
    if (topIdx <= 0) return

    const belowObj = allObjs[topIdx - 1]
    saveUndoState()

    const isMotion = belowObj._dtoolAnimated
    let contentObj = isMotion ? belowObj : await belowObj.clone()
    contentObj.set({
      _dtoolId: belowObj._dtoolId || uuidv4(),
      _dtoolMaskedContent: true,
    })

    const maskChild = await maskShape.clone()
    maskChild.set({
      fill: 'transparent',
      stroke: null,
      strokeWidth: 0,
      _dtoolMaskShape: true,
      _dtoolId: uuidv4(),
      lockMovementX: true,
      lockMovementY: true,
      hasControls: false,
      hasBorders: false,
      selectable: false,
      evented: false,
    })

    const belowIdx = canvas.getObjects().indexOf(belowObj)
    canvas.discardActiveObject()
    if (isMotion) belowObj._dtoolMovingToGroup = true
    canvas.remove(belowObj)
    canvas.remove(maskShape)

    const group = new Group([contentObj, maskChild], {
      _dtoolId: maskShape._dtoolId || uuidv4(),
      _dtoolMaskGroup: true,
      _dtoolMaskLinked: true,
      interactive: false,
      subTargetCheck: false,
    })

    const clipShape = await maskChild.clone()
    clipShape.set({
      fill: '#000',
      stroke: null,
      strokeWidth: 0,
      absolutePositioned: false,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    })
    group.clipPath = clipShape
    patchMaskGroupRender(group)

    if (belowIdx >= 0) canvas.insertAt(belowIdx, group)
    else canvas.add(group)
    canvas.setActiveObject(group)
    canvas.renderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  const useAsMask = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || !(active instanceof ActiveSelection) || !active._objects || active._objects.length < 2) return

    const members = active._objects.filter(o => !o._dtoolTileClone)
    if (members.length < 2) return

    const VECTOR_TYPES = new Set(['rect', 'circle', 'ellipse', 'triangle', 'polygon', 'path'])

    let maskShape = null
    for (let i = members.length - 1; i >= 0; i--) {
      if (VECTOR_TYPES.has((members[i].type || '').toLowerCase())) {
        maskShape = members[i]
        break
      }
    }
    if (!maskShape) return
    const contentObjs = members.filter(o => o !== maskShape)

    saveUndoState()
    canvas.discardActiveObject()

    const canvasObjs = canvas.getObjects()
    const indices = members.map(o => canvasObjs.indexOf(o)).filter(i => i >= 0)
    const lowestIdx = indices.length > 0 ? Math.min(...indices) : canvasObjs.length

    const maskChild = await maskShape.clone()
    maskChild.set({
      fill: 'transparent',
      stroke: null,
      strokeWidth: 0,
      _dtoolMaskShape: true,
      _dtoolId: uuidv4(),
      lockMovementX: true,
      lockMovementY: true,
      hasControls: false,
      hasBorders: false,
      selectable: false,
      evented: false,
    })

    const groupChildren = []
    for (const obj of contentObjs) {
      const child = obj._dtoolAnimated ? obj : await obj.clone()
      child.set({
        _dtoolId: obj._dtoolId || uuidv4(),
        _dtoolMaskedContent: true,
      })
      if (obj._dtoolAnimated) obj._dtoolMovingToGroup = true
      groupChildren.push(child)
    }
    groupChildren.push(maskChild)

    for (const obj of members) canvas.remove(obj)

    const group = new Group(groupChildren, {
      _dtoolId: uuidv4(),
      _dtoolMaskGroup: true,
      _dtoolMaskLinked: true,
      interactive: false,
      subTargetCheck: false,
    })

    const clipShape = await maskChild.clone()
    clipShape.set({
      fill: '#000',
      stroke: null,
      strokeWidth: 0,
      absolutePositioned: false,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
    })
    group.clipPath = clipShape
    patchMaskGroupRender(group)

    if (lowestIdx >= 0 && lowestIdx < canvas.getObjects().length) {
      canvas.insertAt(lowestIdx, group)
    } else {
      canvas.add(group)
    }
    canvas.setActiveObject(group)
    canvas.renderAll()
    refreshObjects()
  }, [saveUndoState, refreshObjects])

  useEffect(() => {
    canvasState.createMaskRef.current = useAsMask
  }, [useAsMask])

  useEffect(() => {
    canvasState.removeMaskRef.current = removeMaskFromGroup
  }, [removeMaskFromGroup])

  useEffect(() => {
    canvasState.syncMaskClipPathRef.current = syncMaskClipPath
  }, [syncMaskClipPath])

  const handleBackgroundClick = (e) => {
    if (ctxMenu) { setCtxMenu(null); return }
    if (e.target === containerRef.current || containerRef.current?.contains(e.target)) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.discardActiveObject()
    canvas.renderAll()
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) { setCtxMenu(null); return }
    const allObjs = canvas.getObjects().filter(o => !o._dtoolTileClone)
    const idx = allObjs.indexOf(active)
    const canMask = idx > 0 && !(active instanceof ActiveSelection) && !active._dtoolTileClone
    const canExpandTiles = !!(active._dtoolTileMode && active._dtoolTileMode !== 'none' && !active._dtoolTileClone)
    const canExpandStroke = !!(active.stroke && active.stroke !== 'transparent' && (active.strokeWidth || 0) > 0 && !(active instanceof ActiveSelection))
    const VECTOR_TYPES = new Set(['rect', 'circle', 'ellipse', 'triangle', 'polygon', 'path'])
    let canUseAsMask = false
    if (active instanceof ActiveSelection && active._objects && active._objects.length >= 2) {
      const members = active._objects.filter(o => !o._dtoolTileClone)
      if (members.length >= 2) {
        const hasVector = members.some(o => VECTOR_TYPES.has((o.type || '').toLowerCase()))
        const hasNonVector = members.some(o => !VECTOR_TYPES.has((o.type || '').toLowerCase()))
        canUseAsMask = hasVector && hasNonVector
      }
    }
    const canGroup = active instanceof ActiveSelection && active._objects && active._objects.length >= 2
    const canUngroup = active.type === 'group' && !active._dtoolMaskGroup

    setCtxMenu({ x: e.clientX, y: e.clientY, canMask, canExpandTiles, canExpandStroke, canUseAsMask, canGroup, canUngroup })
  }

  const handleExpandStroke = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    const strokeColor = active.stroke
    const pathData = expandStrokeToPath(active)
    if (!pathData) return

    saveUndoState()

    const strokePath = new Path(pathData, {
      fill: strokeColor,
      stroke: null,
      strokeWidth: 0,
      _dtoolId: uuidv4(),
      _dtoolLayerName: 'Expanded Stroke',
    })
    strokePath.setCoords()

    const objIndex = canvas.getObjects().indexOf(active)
    active.set({ stroke: null, strokeWidth: 0 })
    active.dirty = true
    active.setCoords()

    canvas.insertAt(objIndex + 1, strokePath)
    canvas.setActiveObject(strokePath)
    canvas.requestRenderAll()
    refreshObjects()
  }

  const handleExpandTiles = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || !active._dtoolTileMode) return
    saveUndoState()
    await expandTiling(canvas, active, canvasState.canvasW || DEFAULT_CANVAS_W, canvasState.canvasH || DEFAULT_CANVAS_H, PASTEBOARD)
    refreshObjects()
  }

  const ctxAction = (fn) => {
    setCtxMenu(null)
    fn()
  }

  return (
    <div
      ref={outerRef}
      className={`flex-1 overflow-hidden relative ${
        canvasState.darkMode ? 'bg-gray-800' : 'bg-gray-200'
      }`}
      onMouseDown={handleBackgroundClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={containerRef}
        className="absolute"
        style={{
          width: totalW * zoom,
          height: totalH * zoom,
          left: '50%',
          top: '50%',
          transform: `translate(${-((PASTEBOARD + canvasW / 2) * zoom)}px, ${-((PASTEBOARD + canvasH / 2) * zoom)}px)`,
        }}
      >
        <canvas ref={canvasElRef} width={totalW} height={totalH} />
        {!hasObjects && (
          <div
            className={`absolute flex flex-col items-center justify-center pointer-events-none select-none ${canvasState.darkMode ? 'text-gray-400' : 'text-gray-500'}`}
            style={{
              left: PASTEBOARD * zoom,
              top: PASTEBOARD * zoom,
              width: canvasW * zoom,
              height: canvasH * zoom,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-50">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="text-sm font-medium">Drag images here</p>
            <p className="text-xs mt-1 opacity-70">or use the toolbar to add text and images</p>
            <p className="text-xs mt-0.5 opacity-50">PNG, JPEG, SVG supported</p>
          </div>
        )}
      </div>



      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)} onMouseDown={(e) => e.stopPropagation()} />
          <div
            className={`fixed z-[70] border rounded-lg shadow-xl py-1 min-w-[160px] text-xs ${
              canvasState.darkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-200'
            }`}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CtxItem label="Bring to Front" shortcut="" onClick={() => ctxAction(bringToFront)} dm={!!canvasState.darkMode} />
            <CtxItem label="Bring Forward" shortcut="Ctrl+]" onClick={() => ctxAction(bringForward)} dm={!!canvasState.darkMode} />
            <CtxItem label="Send Backward" shortcut="Ctrl+[" onClick={() => ctxAction(sendBackward)} dm={!!canvasState.darkMode} />
            <CtxItem label="Send to Back" shortcut="" onClick={() => ctxAction(sendToBack)} dm={!!canvasState.darkMode} />
            {ctxMenu.canGroup && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Group" shortcut="Ctrl+G" onClick={() => ctxAction(groupSelected)} dm={!!canvasState.darkMode} />
              </>
            )}
            {ctxMenu.canUngroup && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Ungroup" shortcut="Ctrl+Shift+G" onClick={() => ctxAction(ungroupSelected)} dm={!!canvasState.darkMode} />
              </>
            )}
            {ctxMenu.canMask && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Create Mask" shortcut="" onClick={() => ctxAction(createMask)} dm={!!canvasState.darkMode} />
              </>
            )}
            {ctxMenu.canUseAsMask && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Create Mask" shortcut="" onClick={() => ctxAction(useAsMask)} dm={!!canvasState.darkMode} />
              </>
            )}
            {ctxMenu.canExpandTiles && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Expand Tiles" shortcut="" onClick={() => ctxAction(handleExpandTiles)} dm={!!canvasState.darkMode} />
              </>
            )}
            {ctxMenu.canExpandStroke && (
              <>
                <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
                <CtxItem label="Expand Stroke" shortcut="" onClick={() => ctxAction(handleExpandStroke)} dm={!!canvasState.darkMode} />
              </>
            )}
            <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
            <CtxItem label="Copy" shortcut="Ctrl+C" onClick={() => ctxAction(copySelected)} dm={!!canvasState.darkMode} />
            <CtxItem label="Cut" shortcut="Ctrl+X" onClick={() => ctxAction(cutSelected)} dm={!!canvasState.darkMode} />
            <CtxItem label="Paste" shortcut="Ctrl+V" onClick={() => ctxAction(pasteFromClipboard)} dm={!!canvasState.darkMode} />
            <CtxItem label="Duplicate" shortcut="Ctrl+D" onClick={() => ctxAction(duplicateSelected)} dm={!!canvasState.darkMode} />
            <div className={`border-t my-1 ${canvasState.darkMode ? 'border-gray-700' : 'border-gray-100'}`} />
            <CtxItem label="Delete" shortcut="Del" onClick={() => ctxAction(deleteSelected)} danger dm={!!canvasState.darkMode} />
          </div>
        </>
      )}
    </div>
  )
}
