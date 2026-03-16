import { v4 as uuidv4 } from 'uuid'
import { Rect, Pattern, Group } from 'fabric'

export function findTilingMaster(obj) {
  if (!obj) return null
  if (obj._dtoolTileMode && obj._dtoolTileMode !== 'none' && !obj._dtoolTileClone) return obj
  let parent = obj.group
  while (parent) {
    if (parent._dtoolTileMode && parent._dtoolTileMode !== 'none' && !parent._dtoolTileClone) return parent
    parent = parent.group
  }
  return null
}

export function computeTileOffsets(tileW, tileH, canvasW, canvasH, pasteboard, mode, spacing = 0) {
  if (!mode || mode === 'none' || tileW <= 0 || tileH <= 0) return []

  const stepW = tileW + spacing
  const stepH = tileH + spacing
  if (stepW <= 1 || stepH <= 1) return []

  const offsets = []

  if (mode === 'basic') {
    const colsLeft = Math.ceil(pasteboard / stepW) + 1
    const colsRight = Math.ceil((canvasW + pasteboard) / stepW) + 1
    const rowsUp = Math.ceil(pasteboard / stepH) + 1
    const rowsDown = Math.ceil((canvasH + pasteboard) / stepH) + 1
    for (let row = -rowsUp; row <= rowsDown; row++) {
      for (let col = -colsLeft; col <= colsRight; col++) {
        if (row === 0 && col === 0) continue
        offsets.push({ dx: col * stepW, dy: row * stepH, flipX: false, flipY: false })
      }
    }
  } else if (mode === 'halfBrick') {
    const colsLeft = Math.ceil(pasteboard / stepW) + 2
    const colsRight = Math.ceil((canvasW + pasteboard) / stepW) + 2
    const rowsUp = Math.ceil(pasteboard / stepH) + 1
    const rowsDown = Math.ceil((canvasH + pasteboard) / stepH) + 1
    for (let row = -rowsUp; row <= rowsDown; row++) {
      const shift = (row & 1) !== 0 ? stepW / 2 : 0
      for (let col = -colsLeft; col <= colsRight; col++) {
        const dx = col * stepW + shift
        const dy = row * stepH
        if (dx === 0 && dy === 0) continue
        offsets.push({ dx, dy, flipX: false, flipY: false })
      }
    }
  } else if (mode === 'halfDrop') {
    const colsLeft = Math.ceil(pasteboard / stepW) + 1
    const colsRight = Math.ceil((canvasW + pasteboard) / stepW) + 1
    const rowsUp = Math.ceil(pasteboard / stepH) + 2
    const rowsDown = Math.ceil((canvasH + pasteboard) / stepH) + 2
    for (let row = -rowsUp; row <= rowsDown; row++) {
      for (let col = -colsLeft; col <= colsRight; col++) {
        const shift = (col & 1) !== 0 ? stepH / 2 : 0
        const dx = col * stepW
        const dy = row * stepH + shift
        if (dx === 0 && dy === 0) continue
        offsets.push({ dx, dy, flipX: false, flipY: false })
      }
    }
  } else if (mode === 'mirror') {
    const superW = stepW * 2
    const superH = stepH * 2
    const colsLeft = Math.ceil(pasteboard / superW) + 1
    const colsRight = Math.ceil((canvasW + pasteboard) / superW) + 1
    const rowsUp = Math.ceil(pasteboard / superH) + 1
    const rowsDown = Math.ceil((canvasH + pasteboard) / superH) + 1
    for (let row = -rowsUp; row <= rowsDown; row++) {
      for (let col = -colsLeft; col <= colsRight; col++) {
        const bx = col * superW
        const by = row * superH
        const cells = [
          { dx: bx, dy: by, flipX: false, flipY: false },
          { dx: bx + stepW, dy: by, flipX: true, flipY: false },
          { dx: bx, dy: by + stepH, flipX: false, flipY: true },
          { dx: bx + stepW, dy: by + stepH, flipX: true, flipY: true },
        ]
        for (const cell of cells) {
          if (cell.dx === 0 && cell.dy === 0 && !cell.flipX && !cell.flipY) continue
          offsets.push(cell)
        }
      }
    }
  }

  return offsets
}

function buildSuperTileCanvas(tileCvs, tileW, tileH, mode, spacing = 0) {
  const w = Math.max(1, Math.round(tileW))
  const h = Math.max(1, Math.round(tileH))
  const sw = Math.max(1, Math.round(tileW + spacing))
  const sh = Math.max(1, Math.round(tileH + spacing))
  let superW, superH
  const draws = []

  if (mode === 'basic') {
    superW = sw
    superH = sh
    draws.push({ x: 0, y: 0, flipX: false, flipY: false })
  } else if (mode === 'halfBrick') {
    superW = sw
    superH = sh * 2
    draws.push({ x: 0, y: 0, flipX: false, flipY: false })
    draws.push({ x: Math.round(sw / 2), y: sh, flipX: false, flipY: false })
    draws.push({ x: Math.round(sw / 2) - sw, y: sh, flipX: false, flipY: false })
  } else if (mode === 'halfDrop') {
    superW = sw * 2
    superH = sh
    draws.push({ x: 0, y: 0, flipX: false, flipY: false })
    draws.push({ x: sw, y: Math.round(sh / 2), flipX: false, flipY: false })
    draws.push({ x: sw, y: Math.round(sh / 2) - sh, flipX: false, flipY: false })
  } else if (mode === 'mirror') {
    superW = sw * 2
    superH = sh * 2
    draws.push({ x: 0, y: 0, flipX: false, flipY: false })
    draws.push({ x: sw, y: 0, flipX: true, flipY: false })
    draws.push({ x: 0, y: sh, flipX: false, flipY: true })
    draws.push({ x: sw, y: sh, flipX: true, flipY: true })
  } else {
    superW = sw
    superH = sh
    draws.push({ x: 0, y: 0, flipX: false, flipY: false })
  }

  const cvs = document.createElement('canvas')
  cvs.width = superW
  cvs.height = superH
  const ctx = cvs.getContext('2d')

  for (const d of draws) {
    ctx.save()
    if (d.flipX && d.flipY) {
      ctx.translate(d.x + w, d.y + h)
      ctx.scale(-1, -1)
      ctx.drawImage(tileCvs, 0, 0, w, h)
    } else if (d.flipX) {
      ctx.translate(d.x + w, d.y)
      ctx.scale(-1, 1)
      ctx.drawImage(tileCvs, 0, 0, w, h)
    } else if (d.flipY) {
      ctx.translate(d.x, d.y + h)
      ctx.scale(1, -1)
      ctx.drawImage(tileCvs, 0, 0, w, h)
    } else {
      ctx.drawImage(tileCvs, d.x, d.y, w, h)
    }
    ctx.restore()
  }

  return { canvas: cvs, width: superW, height: superH }
}

async function renderMasterToCanvas(masterObj, tileW, tileH) {
  const w = Math.max(1, Math.round(tileW))
  const h = Math.max(1, Math.round(tileH))

  const origAngle = masterObj.angle || 0
  if (origAngle !== 0) {
    masterObj.set('angle', 0)
    masterObj.setCoords()
  }

  let dataUrl
  try {
    dataUrl = masterObj.toDataURL({ format: 'png' })
  } catch {
    if (origAngle !== 0) {
      masterObj.set('angle', origAngle)
      masterObj.setCoords()
    }
    return null
  }

  if (origAngle !== 0) {
    masterObj.set('angle', origAngle)
    masterObj.setCoords()
  }

  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = w
      cvs.height = h
      cvs.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(cvs)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export function removeOrphanedTileClones(canvas) {
  if (!canvas) return
  const objs = canvas.getObjects()
  const masterIds = new Set(
    objs.filter(o => !o._dtoolTileClone && !o._dtoolTilePatternRect && o._dtoolId).map(o => o._dtoolId)
  )
  const active = canvas.getActiveObject()
  if (active && active._dtoolId) masterIds.add(active._dtoolId)
  if (active && active._objects) {
    active._objects.forEach(o => { if (o._dtoolId) masterIds.add(o._dtoolId) })
  }
  const orphans = objs.filter(o =>
    (o._dtoolTileClone || o._dtoolTilePatternRect) &&
    o._dtoolTileMasterId &&
    !masterIds.has(o._dtoolTileMasterId)
  )
  for (const o of orphans) canvas.remove(o)
}

function seededRandom(seed) {
  let s = seed | 0
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export async function applyTiling(canvas, masterObj, mode, canvasW, canvasH, pasteboard) {
  if (!canvas || !masterObj) return

  if (!masterObj._dtoolId) masterObj._dtoolId = uuidv4()
  removeTiling(canvas, masterObj._dtoolId)
  removeOrphanedTileClones(canvas)

  masterObj._dtoolTileMode = mode

  if (!mode || mode === 'none') {
    canvas.requestRenderAll()
    return
  }

  const masterIdx = canvas.getObjects().indexOf(masterObj)
  if (masterIdx < 0) return

  const bgCount = canvas.getObjects().filter(o => o._dtoolBgLayer).length
  const tileInsertIdx = bgCount

  const spacing = masterObj._dtoolTileSpacing || 0
  const randomRotation = !!masterObj._dtoolTileRandomRotation

  const sx = masterObj.scaleX || 1
  const sy = masterObj.scaleY || 1
  const tileW = (masterObj.width || 0) * sx
  const tileH = (masterObj.height || 0) * sy
  if (tileW <= 0 || tileH <= 0) return

  const tileCvs = await renderMasterToCanvas(masterObj, tileW, tileH)
  if (!tileCvs) return

  if (randomRotation) {
    const offsets = computeTileOffsets(tileW, tileH, canvasW, canvasH, pasteboard, mode, spacing)
    const seed = masterObj._dtoolId.charCodeAt(0) * 1000 + masterObj._dtoolId.charCodeAt(1) * 100
    const rng = seededRandom(seed)
    const clones = []
    for (const off of offsets) {
      const clone = await masterObj.clone()
      const angle = rng() * 360
      clone.set({
        left: masterObj.left + off.dx,
        top: masterObj.top + off.dy,
        angle,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        _dtoolTileClone: true,
        _dtoolTileMasterId: masterObj._dtoolId,
        _dtoolId: uuidv4(),
      })
      if (off.flipX) clone.set('flipX', !clone.flipX)
      if (off.flipY) clone.set('flipY', !clone.flipY)
      clone.setCoords()
      clones.push(clone)
    }
    for (const c of clones) canvas.insertAt(tileInsertIdx, c)
    canvas.requestRenderAll()
    return
  }

  const superTile = buildSuperTileCanvas(tileCvs, tileW, tileH, mode, spacing)

  const pattern = new Pattern({
    source: superTile.canvas,
    repeat: 'repeat',
  })

  const rectLeft = -pasteboard
  const rectTop = -pasteboard
  const rectW = canvasW + 2 * pasteboard
  const rectH = canvasH + 2 * pasteboard

  const ox = ((masterObj.left - rectLeft) % superTile.width + superTile.width) % superTile.width
  const oy = ((masterObj.top - rectTop) % superTile.height + superTile.height) % superTile.height
  pattern.offsetX = ox
  pattern.offsetY = oy

  const patternRect = new Rect({
    left: rectLeft,
    top: rectTop,
    width: rectW,
    height: rectH,
    fill: pattern,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    excludeFromExport: false,
    _dtoolTileClone: true,
    _dtoolTilePatternRect: true,
    _dtoolTileMasterId: masterObj._dtoolId,
    _dtoolId: uuidv4(),
  })

  canvas.insertAt(tileInsertIdx, patternRect)
  canvas.requestRenderAll()
}

export function removeTiling(canvas, masterId) {
  if (!canvas || !masterId) return
  const toRemove = canvas.getObjects().filter(o => o._dtoolTileMasterId === masterId)
  for (const c of toRemove) canvas.remove(c)
}

export async function refreshTileClones(canvas, masterObj, canvasW, canvasH, pasteboard) {
  if (!canvas || !masterObj) return
  const mode = masterObj._dtoolTileMode
  if (!mode || mode === 'none') return
  await applyTiling(canvas, masterObj, mode, canvasW, canvasH, pasteboard)
}

export async function expandTiling(canvas, masterObj, canvasW, canvasH, pasteboard) {
  if (!canvas || !masterObj) return null
  const mode = masterObj._dtoolTileMode
  if (!mode || mode === 'none') return null

  const sx = masterObj.scaleX || 1
  const sy = masterObj.scaleY || 1
  const tileW = (masterObj.width || 0) * sx
  const tileH = (masterObj.height || 0) * sy
  if (tileW <= 0 || tileH <= 0) return null

  removeTiling(canvas, masterObj._dtoolId)

  const spacing = masterObj._dtoolTileSpacing || 0
  const OVERLAP = 0.5
  const spacingW = tileW - OVERLAP
  const spacingH = tileH - OVERLAP
  const offsets = computeTileOffsets(spacingW, spacingH, canvasW, canvasH, pasteboard, mode, spacing)

  const clones = []
  for (const off of offsets) {
    const clone = await masterObj.clone()
    clone.set({
      left: Math.round((masterObj.left + off.dx) * 100) / 100,
      top: Math.round((masterObj.top + off.dy) * 100) / 100,
      _dtoolId: uuidv4(),
    })
    if (off.flipX) clone.set('flipX', !clone.flipX)
    if (off.flipY) clone.set('flipY', !clone.flipY)
    clone.setCoords()
    clones.push(clone)
  }

  const masterLeft = masterObj.left
  const masterTop = masterObj.top
  delete masterObj._dtoolTileMode
  canvas.remove(masterObj)

  masterObj.set({ left: 0, top: 0 })
  for (const cl of clones) {
    cl.set({ left: cl.left - masterLeft, top: cl.top - masterTop })
  }

  const group = new Group([masterObj, ...clones], {
    left: masterLeft,
    top: masterTop,
    _dtoolId: uuidv4(),
    _dtoolExpandedTiles: true,
    _dtoolLayerName: 'Expanded Tiles',
  })

  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}
