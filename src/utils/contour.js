export function traceAlphaContours(data, w, h) {
  const val = (x, y) => (x >= 0 && x < w && y >= 0 && y < h && data[(y * w + x) * 4 + 3] > 128) ? 1 : 0
  const adj = new Map()
  const pk = (x, y) => `${x},${y}`
  function link(a, b) {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push(b)
    adj.get(b).push(a)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = val(x, y), tr = val(x + 1, y), br = val(x + 1, y + 1), bl = val(x, y + 1)
      const c = tl * 8 + tr * 4 + br * 2 + bl
      if (c === 0 || c === 15) continue
      const T = pk(x * 2 + 1, y * 2), R = pk(x * 2 + 2, y * 2 + 1)
      const B = pk(x * 2 + 1, y * 2 + 2), L = pk(x * 2, y * 2 + 1)
      switch (c) {
        case 1: case 14: link(L, B); break
        case 2: case 13: link(B, R); break
        case 3: case 12: link(L, R); break
        case 4: case 11: link(R, T); break
        case 5: link(L, T); link(B, R); break
        case 6: case 9: link(T, B); break
        case 7: case 8: link(T, L); break
        case 10: link(T, R); link(L, B); break
      }
    }
  }
  const visited = new Set()
  const contours = []
  for (const start of adj.keys()) {
    if (visited.has(start)) continue
    const chain = []
    let cur = start, prev = null
    while (!visited.has(cur)) {
      visited.add(cur)
      chain.push(cur)
      const nbrs = adj.get(cur) || []
      const next = nbrs.find(n => n !== prev && !visited.has(n))
      if (next === undefined) break
      prev = cur
      cur = next
    }
    if (chain.length >= 3) {
      contours.push(chain.map(k => {
        const [x, y] = k.split(',').map(Number)
        return { x: x / 2, y: y / 2 }
      }))
    }
  }
  return contours
}

export function simplifyRDP(points, tolerance) {
  if (points.length <= 2) return points
  function perpDist(pt, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq))
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy))
  }
  function rdp(pts, s, e) {
    let maxD = 0, maxI = s
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e])
      if (d > maxD) { maxD = d; maxI = i }
    }
    if (maxD > tolerance) {
      const left = rdp(pts, s, maxI)
      const right = rdp(pts, maxI, e)
      return [...left.slice(0, -1), ...right]
    }
    return [pts[s], pts[e]]
  }
  return rdp(points, 0, points.length - 1)
}

export function contourToSmoothPath(points) {
  if (points.length < 3) return null
  const n = points.length
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d + ' Z'
}

export function expandStrokeToPath(obj) {
  const sw = obj.strokeWidth || 0
  if (sw <= 0 || !obj.stroke || obj.stroke === 'transparent') return null

  const br = obj.getBoundingRect()
  const PAD = Math.ceil(sw) + 8
  const minX = Math.floor(br.left) - PAD
  const minY = Math.floor(br.top) - PAD
  const maxX = Math.ceil(br.left + br.width) + PAD
  const maxY = Math.ceil(br.top + br.height) + PAD
  const w = maxX - minX, h = maxY - minY
  if (w <= 0 || h <= 0 || w > 6000 || h > 6000) return null

  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d')
  ctx.translate(-minX, -minY)

  const m = obj.calcTransformMatrix()
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])

  const drawStroke = (ctx2d) => {
    ctx2d.strokeStyle = '#000'
    ctx2d.lineWidth = sw / Math.max(Math.abs(m[0]), Math.abs(m[3]), 1)
    ctx2d.lineCap = obj.strokeLineCap || 'butt'
    ctx2d.lineJoin = obj.strokeLineJoin || 'miter'
    if (obj.strokeDashArray) ctx2d.setLineDash(obj.strokeDashArray)

    const t = (obj.type || '').toLowerCase()
    if (t === 'path' && obj.path) {
      const p2d = new Path2D(obj.path.map(s => s.join(' ')).join(' '))
      ctx2d.stroke(p2d)
    } else if (t === 'rect') {
      const rx = obj.rx || 0, ry = obj.ry || 0
      const ow = obj.width || 0, oh = obj.height || 0
      const ox = -ow / 2, oy = -oh / 2
      if (rx > 0 || ry > 0) {
        const r = Math.min(rx, ry, ow / 2, oh / 2)
        ctx2d.beginPath()
        ctx2d.moveTo(ox + r, oy)
        ctx2d.lineTo(ox + ow - r, oy)
        ctx2d.arcTo(ox + ow, oy, ox + ow, oy + r, r)
        ctx2d.lineTo(ox + ow, oy + oh - r)
        ctx2d.arcTo(ox + ow, oy + oh, ox + ow - r, oy + oh, r)
        ctx2d.lineTo(ox + r, oy + oh)
        ctx2d.arcTo(ox, oy + oh, ox, oy + oh - r, r)
        ctx2d.lineTo(ox, oy + r)
        ctx2d.arcTo(ox, oy, ox + r, oy, r)
        ctx2d.closePath()
        ctx2d.stroke()
      } else {
        ctx2d.strokeRect(ox, oy, ow, oh)
      }
    } else if (t === 'circle') {
      const radius = obj.radius || 0
      ctx2d.beginPath()
      ctx2d.arc(0, 0, radius, 0, Math.PI * 2)
      ctx2d.stroke()
    } else if (t === 'ellipse') {
      ctx2d.beginPath()
      ctx2d.ellipse(0, 0, obj.rx || 0, obj.ry || 0, 0, 0, Math.PI * 2)
      ctx2d.stroke()
    } else if (t === 'triangle') {
      const tw = obj.width || 0, th = obj.height || 0
      ctx2d.beginPath()
      ctx2d.moveTo(0, -th / 2)
      ctx2d.lineTo(tw / 2, th / 2)
      ctx2d.lineTo(-tw / 2, th / 2)
      ctx2d.closePath()
      ctx2d.stroke()
    } else if (t === 'polygon' && obj.points) {
      ctx2d.beginPath()
      obj.points.forEach((pt, i) => {
        const px = pt.x - obj.pathOffset.x
        const py = pt.y - obj.pathOffset.y
        if (i === 0) ctx2d.moveTo(px, py)
        else ctx2d.lineTo(px, py)
      })
      ctx2d.closePath()
      ctx2d.stroke()
    } else {
      return false
    }
    return true
  }

  if (!drawStroke(ctx)) return null

  const imgData = ctx.getImageData(0, 0, w, h)
  const contours = traceAlphaContours(imgData.data, w, h)
  if (contours.length === 0) return null

  const paths = []
  for (const contour of contours) {
    if (contour.length < 3) continue
    const scene = contour.map(p => ({ x: p.x + minX, y: p.y + minY }))
    const simplified = simplifyRDP(scene, 1.0)
    if (simplified.length < 3) continue
    const sp = contourToSmoothPath(simplified)
    if (sp) paths.push(sp)
  }
  if (paths.length === 0) return null

  return paths.join(' ')
}

export function flattenFabricPath(obj) {
  const br = obj.getBoundingRect()
  const PAD = 6
  const minX = Math.floor(br.left) - PAD
  const minY = Math.floor(br.top) - PAD
  const maxX = Math.ceil(br.left + br.width) + PAD
  const maxY = Math.ceil(br.top + br.height) + PAD
  const w = maxX - minX, h = maxY - minY
  if (w <= 0 || h <= 0 || w > 4000 || h > 4000) return null

  const off = document.createElement('canvas')
  off.width = w; off.height = h
  const ctx = off.getContext('2d')
  ctx.translate(-minX, -minY)

  const m = obj.calcTransformMatrix()
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
  const p2d = new Path2D(obj.path.map(s => s.join(' ')).join(' '))
  ctx.fillStyle = '#000'
  ctx.fill(p2d)

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

  return paths.join(' ')
}
