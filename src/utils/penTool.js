import { Path } from 'fabric'
import { v4 as uuidv4 } from 'uuid'

export const PEN_SUB_TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  DIRECT_SELECT: 'directSelect',
  ADD_POINT: 'addPoint',
  DELETE_POINT: 'deletePoint',
  CONVERT_POINT: 'convertPoint',
}

/* ---------- SVG path generation ---------- */

export function pointsToSVGPath(points, closed) {
  if (points.length === 0) return ''
  const segs = []
  const p0 = points[0]
  segs.push(`M ${p0.x} ${p0.y}`)

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const hasHandleOut = prev.handleOutX !== undefined && prev.handleOutY !== undefined
    const hasHandleIn = cur.handleInX !== undefined && cur.handleInY !== undefined
    if (hasHandleOut || hasHandleIn) {
      const cp1x = hasHandleOut ? prev.handleOutX : prev.x
      const cp1y = hasHandleOut ? prev.handleOutY : prev.y
      const cp2x = hasHandleIn ? cur.handleInX : cur.x
      const cp2y = hasHandleIn ? cur.handleInY : cur.y
      segs.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${cur.x} ${cur.y}`)
    } else {
      segs.push(`L ${cur.x} ${cur.y}`)
    }
  }

  if (closed && points.length > 1) {
    const last = points[points.length - 1]
    const first = points[0]
    const hasHandleOut = last.handleOutX !== undefined && last.handleOutY !== undefined
    const hasHandleIn = first.handleInX !== undefined && first.handleInY !== undefined
    if (hasHandleOut || hasHandleIn) {
      const cp1x = hasHandleOut ? last.handleOutX : last.x
      const cp1y = hasHandleOut ? last.handleOutY : last.y
      const cp2x = hasHandleIn ? first.handleInX : first.x
      const cp2y = hasHandleIn ? first.handleInY : first.y
      segs.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${first.x} ${first.y}`)
    }
    segs.push('Z')
  }
  return segs.join(' ')
}

export function createFabricPath(pathData, fillColor, strokeColor, strokeWidth, opts = {}) {
  const props = {
    fill: fillColor || 'transparent',
    stroke: strokeColor || '#000000',
    strokeWidth: strokeWidth || 2,
    strokeUniform: true,
    _dtoolId: uuidv4(),
    originX: 'center',
    originY: 'center',
    objectCaching: false,
  }
  if (opts.strokeDashArray?.length) props.strokeDashArray = [...opts.strokeDashArray]
  if (opts.strokeLineCap) props.strokeLineCap = opts.strokeLineCap
  if (opts.strokeLineJoin) props.strokeLineJoin = opts.strokeLineJoin
  if (opts.opacity != null && opts.opacity !== 1) props.opacity = opts.opacity
  return new Path(pathData, props)
}

export function dist(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

/* ---------- Fabric path parsing ---------- */

export function parseFabricPathToPoints(fabricObj) {
  const pathData = fabricObj.path
  if (!pathData || !Array.isArray(pathData)) return null

  const points = []
  const sx = fabricObj.scaleX || 1
  const sy = fabricObj.scaleY || 1
  const center = fabricObj.getCenterPoint()
  const po = fabricObj.pathOffset || { x: fabricObj.width / 2, y: fabricObj.height / 2 }
  const angle = fabricObj.angle || 0
  const rad = angle * Math.PI / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)

  const toScene = (lx, ly) => {
    let dx = (lx - po.x) * sx
    let dy = (ly - po.y) * sy
    if (angle !== 0) {
      const rx = dx * cosA - dy * sinA
      const ry = dx * sinA + dy * cosA
      dx = rx; dy = ry
    }
    return { x: center.x + dx, y: center.y + dy }
  }

  for (let i = 0; i < pathData.length; i++) {
    const seg = pathData[i]
    const cmd = seg[0]

    if (cmd === 'M') {
      const p = toScene(seg[1], seg[2])
      points.push({ x: p.x, y: p.y, type: 'corner' })
    } else if (cmd === 'L') {
      const p = toScene(seg[1], seg[2])
      points.push({ x: p.x, y: p.y, type: 'corner' })
    } else if (cmd === 'C') {
      const cp1 = toScene(seg[1], seg[2])
      const cp2 = toScene(seg[3], seg[4])
      const end = toScene(seg[5], seg[6])

      if (points.length > 0) {
        const prev = points[points.length - 1]
        prev.handleOutX = cp1.x
        prev.handleOutY = cp1.y
        prev.type = 'smooth'
      }

      end.handleInX = cp2.x
      end.handleInY = cp2.y
      end.type = 'smooth'
      points.push(end)
    } else if (cmd === 'Q') {
      const cp = toScene(seg[1], seg[2])
      const end = toScene(seg[3], seg[4])

      if (points.length > 0) {
        const prev = points[points.length - 1]
        prev.handleOutX = cp.x
        prev.handleOutY = cp.y
        prev.type = 'smooth'
      }

      end.handleInX = cp.x
      end.handleInY = cp.y
      end.type = 'smooth'
      points.push(end)
    }
  }

  const isClosed = pathData.some(s => s[0] === 'Z' || s[0] === 'z')
  return { points, closed: isClosed }
}

/* ---------- Path segment utilities ---------- */

export function findClosestPointOnPath(points, closed, sceneX, sceneY, threshold = 14) {
  let bestDist = threshold
  let bestIdx = -1
  let bestT = 0
  let bestPt = null

  const segCount = closed ? points.length : points.length - 1
  for (let i = 0; i < segCount; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % points.length]
    const hasH = (p0.handleOutX != null) || (p1.handleInX != null)

    if (hasH) {
      const cp1x = p0.handleOutX ?? p0.x
      const cp1y = p0.handleOutY ?? p0.y
      const cp2x = p1.handleInX ?? p1.x
      const cp2y = p1.handleInY ?? p1.y
      for (let t = 0; t <= 1; t += 0.02) {
        const it = 1 - t
        const bx = it * it * it * p0.x + 3 * it * it * t * cp1x + 3 * it * t * t * cp2x + t * t * t * p1.x
        const by = it * it * it * p0.y + 3 * it * it * t * cp1y + 3 * it * t * t * cp2y + t * t * t * p1.y
        const d = Math.sqrt((bx - sceneX) ** 2 + (by - sceneY) ** 2)
        if (d < bestDist) {
          bestDist = d
          bestIdx = i
          bestT = t
          bestPt = { x: bx, y: by }
        }
      }
    } else {
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const lenSq = dx * dx + dy * dy
      if (lenSq === 0) continue
      let t = ((sceneX - p0.x) * dx + (sceneY - p0.y) * dy) / lenSq
      t = Math.max(0, Math.min(1, t))
      const px = p0.x + t * dx, py = p0.y + t * dy
      const d = Math.sqrt((px - sceneX) ** 2 + (py - sceneY) ** 2)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
        bestT = t
        bestPt = { x: px, y: py }
      }
    }
  }

  return bestIdx >= 0 ? { segIndex: bestIdx, t: bestT, point: bestPt, dist: bestDist } : null
}

export function splitBezierAt(p0, cp1, cp2, p1, t) {
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  const a = lerp(p0, cp1, t)
  const b = lerp(cp1, cp2, t)
  const c = lerp(cp2, p1, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const f = lerp(d, e, t)
  return {
    left: { cp1: a, cp2: d, end: f },
    right: { cp1: e, cp2: c, end: p1 },
  }
}

/* ---------- Drawing overlay ---------- */

export function drawPenOverlay(ctx, state, vpt, zoom) {
  const { points, closed, dragging, dragPoint, hoveredPointIndex, hoveredSegment,
          hoveredHandleInfo, subTool, selectedPointIndices, editingPath } = state

  ctx.save()
  ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])

  const anchorSize = 6 / zoom
  const handleSize = 5 / zoom
  const lineWidth = 1.4 / zoom

  const allPoints = editingPath ? editingPath.points : points
  const isClosed = editingPath ? editingPath.closed : closed

  if (allPoints.length > 0) {
    ctx.strokeStyle = '#0078ff'
    ctx.lineWidth = lineWidth
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.moveTo(allPoints[0].x, allPoints[0].y)
    const segCount = isClosed ? allPoints.length : allPoints.length - 1
    for (let i = 0; i < segCount; i++) {
      const cur = allPoints[i]
      const next = allPoints[(i + 1) % allPoints.length]
      const hasH = (cur.handleOutX != null) || (next.handleInX != null)
      if (hasH) {
        const cp1x = cur.handleOutX ?? cur.x
        const cp1y = cur.handleOutY ?? cur.y
        const cp2x = next.handleInX ?? next.x
        const cp2y = next.handleInY ?? next.y
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y)
      } else {
        ctx.lineTo(next.x, next.y)
      }
    }
    ctx.stroke()

    if (!isClosed && !editingPath && dragPoint && allPoints.length > 0 && !dragging) {
      const lastPt = allPoints[allPoints.length - 1]
      ctx.strokeStyle = 'rgba(0,120,255,0.4)'
      ctx.setLineDash([4 / zoom, 3 / zoom])
      ctx.beginPath()
      ctx.moveTo(lastPt.x, lastPt.y)
      if (lastPt.handleOutX != null) {
        ctx.bezierCurveTo(lastPt.handleOutX, lastPt.handleOutY, dragPoint.x, dragPoint.y, dragPoint.x, dragPoint.y)
      } else {
        ctx.lineTo(dragPoint.x, dragPoint.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  const isEditMode = !!editingPath

  for (let i = 0; i < allPoints.length; i++) {
    const pt = allPoints[i]
    const isSelected = selectedPointIndices?.includes(i)
    const showHandles = isEditMode || isSelected

    if (showHandles && pt.handleInX != null) {
      ctx.strokeStyle = '#0078ff'
      ctx.lineWidth = 0.8 / zoom
      ctx.beginPath()
      ctx.moveTo(pt.handleInX, pt.handleInY)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()

      const isHandleHovered = hoveredHandleInfo?.pointIndex === i && hoveredHandleInfo?.type === 'handleIn'
      ctx.fillStyle = isHandleHovered ? '#ff6600' : (isSelected ? '#0078ff' : '#ffffff')
      ctx.strokeStyle = isHandleHovered ? '#ff6600' : '#0078ff'
      ctx.lineWidth = (isHandleHovered ? 2 : 1.2) / zoom
      ctx.beginPath()
      ctx.arc(pt.handleInX, pt.handleInY, isHandleHovered ? handleSize * 1.3 : handleSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    if (showHandles && pt.handleOutX != null) {
      ctx.strokeStyle = '#0078ff'
      ctx.lineWidth = 0.8 / zoom
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y)
      ctx.lineTo(pt.handleOutX, pt.handleOutY)
      ctx.stroke()

      const isHandleHovered = hoveredHandleInfo?.pointIndex === i && hoveredHandleInfo?.type === 'handleOut'
      ctx.fillStyle = isHandleHovered ? '#ff6600' : (isSelected ? '#0078ff' : '#ffffff')
      ctx.strokeStyle = isHandleHovered ? '#ff6600' : '#0078ff'
      ctx.lineWidth = (isHandleHovered ? 2 : 1.2) / zoom
      ctx.beginPath()
      ctx.arc(pt.handleOutX, pt.handleOutY, isHandleHovered ? handleSize * 1.3 : handleSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const isHovered = hoveredPointIndex === i
    const isFirstPoint = i === 0 && allPoints.length > 1 && !isClosed && !editingPath
    ctx.fillStyle = isSelected ? '#0078ff' : (isHovered ? '#fff8e0' : '#ffffff')
    ctx.strokeStyle = isHovered
      ? (isFirstPoint ? '#00cc44' : '#ff6600')
      : '#0078ff'
    ctx.lineWidth = (isHovered ? 2.5 : 1.5) / zoom

    ctx.beginPath()
    const drawSize = isHovered ? anchorSize * 1.3 : anchorSize
    if (pt.type === 'smooth') {
      ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2)
    } else {
      ctx.rect(pt.x - drawSize, pt.y - drawSize, drawSize * 2, drawSize * 2)
    }
    ctx.fill()
    ctx.stroke()

    if (isFirstPoint && isHovered) {
      ctx.strokeStyle = '#00cc44'
      ctx.lineWidth = 2 / zoom
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, anchorSize + 4 / zoom, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (hoveredSegment && subTool === PEN_SUB_TOOLS.ADD_POINT) {
    ctx.fillStyle = '#0078ff'
    ctx.beginPath()
    ctx.arc(hoveredSegment.point.x, hoveredSegment.point.y, anchorSize * 1.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2 / zoom
    ctx.stroke()

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5 / zoom
    ctx.beginPath()
    const s = anchorSize * 0.6
    ctx.moveTo(hoveredSegment.point.x - s, hoveredSegment.point.y)
    ctx.lineTo(hoveredSegment.point.x + s, hoveredSegment.point.y)
    ctx.moveTo(hoveredSegment.point.x, hoveredSegment.point.y - s)
    ctx.lineTo(hoveredSegment.point.x, hoveredSegment.point.y + s)
    ctx.stroke()
  }

  ctx.restore()
}
