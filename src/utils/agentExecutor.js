import { Textbox, Rect, Circle, Ellipse, Triangle, Polygon, Path, FabricImage, Shadow } from 'fabric'
import { v4 as uuidv4 } from 'uuid'

// Same filled style as ShapesPanel: one fill color, no stroke
const SHAPE_FILL = '#C8C4BE'
const SHAPE_OPTS = { stroke: 'transparent', strokeWidth: 0 }

const SHAPE_FACTORIES = {
  rectangle: (p) => new Rect({ width: p.width || 120, height: p.height || 80, fill: p.fill || SHAPE_FILL, rx: 0, ry: 0, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  square: (p) => new Rect({ width: p.width || 100, height: p.height || 100, fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  rounded_rect: (p) => new Rect({ width: p.width || 120, height: p.height || 80, fill: p.fill || SHAPE_FILL, rx: 12, ry: 12, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  circle: (p) => new Circle({ radius: (p.width || 100) / 2, fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  ellipse: (p) => new Ellipse({ rx: (p.width || 120) / 2, ry: (p.height || 80) / 2, fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  triangle: (p) => new Triangle({ width: p.width || 100, height: p.height || 90, fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  diamond: (p) => new Polygon(
    [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }],
    { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
  ),
  pentagon: (p) => {
    const r = 50
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
      return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) }
    })
    return new Polygon(pts, { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
  },
  hexagon: (p) => {
    const r = 50
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
      return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) }
    })
    return new Polygon(pts, { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
  },
  star: (p) => {
    const outer = 50, inner = 22
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? outer : inner
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
      return { x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) }
    })
    return new Polygon(pts, { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
  },
  heart: (p) => new Path(
    'M 50 30 C 50 10, 90 0, 90 30 C 90 60, 50 90, 50 90 C 50 90, 10 60, 10 30 C 10 0, 50 10, 50 30 Z',
    { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
  ),
  arrow_right: (p) => new Polygon(
    [
      { x: 0, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 10 },
      { x: 100, y: 50 }, { x: 70, y: 90 }, { x: 70, y: 70 }, { x: 0, y: 70 },
    ],
    { fill: p.fill || SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
  ),
}

function findObjectById(canvas, objectId) {
  const all = canvas.getObjects()
  for (const obj of all) {
    if (obj._dtoolId === objectId) return obj
    if (obj.type === 'group' && obj.getObjects) {
      const child = obj.getObjects().find(c => c._dtoolId === objectId)
      if (child) return child
    }
  }
  return null
}

function executeAddText(canvas, action) {
  const obj = new Textbox(action.text || 'Text', {
    left: action.left ?? 100,
    top: action.top ?? 100,
    width: action.width ?? 200,
    fontSize: action.fontSize ?? 24,
    fontFamily: action.fontFamily ?? 'Inter',
    fill: action.fill ?? '#000000',
    textAlign: action.textAlign ?? 'left',
    fontWeight: action.fontWeight ?? 'normal',
    fontStyle: action.fontStyle ?? 'normal',
    _dtoolId: uuidv4(),
  })
  canvas.add(obj)
  return obj._dtoolId
}

function executeAddShape(canvas, action) {
  const factory = SHAPE_FACTORIES[action.shapeId]
  if (!factory) return null
  const obj = factory(action)
  const props = { left: action.left ?? 100, top: action.top ?? 100 }
  if (action.width && action.shapeId !== 'circle') props.width = action.width
  if (action.height) props.height = action.height
  if (action.stroke) props.stroke = action.stroke
  if (action.strokeWidth) props.strokeWidth = action.strokeWidth
  if (action.opacity != null) props.opacity = action.opacity
  obj.set(props)
  canvas.add(obj)
  return obj._dtoolId
}

function executeModifyObject(canvas, action) {
  const obj = findObjectById(canvas, action.objectId)
  if (!obj) return false
  const allowed = [
    'fill', 'stroke', 'strokeWidth', 'opacity', 'fontSize', 'fontFamily',
    'left', 'top', 'scaleX', 'scaleY', 'angle', 'fontWeight', 'fontStyle',
    'textAlign', 'width', 'height',
  ]
  const props = {}
  for (const key of allowed) {
    if (action.props[key] !== undefined) props[key] = action.props[key]
  }
  if (action.props.text != null && obj.set && typeof obj.text === 'string') {
    obj.set('text', action.props.text)
  }
  if (action.props.shadow) {
    const parts = action.props.shadow.split(' ')
    if (parts.length >= 4) {
      obj.set('shadow', new Shadow({
        color: parts[0],
        offsetX: parseFloat(parts[1]) || 0,
        offsetY: parseFloat(parts[2]) || 0,
        blur: parseFloat(parts[3]) || 0,
      }))
    }
  }
  obj.set(props)
  obj.setCoords()
  return true
}

function executeDeleteObject(canvas, action) {
  const obj = findObjectById(canvas, action.objectId)
  if (!obj) return false
  canvas.remove(obj)
  return true
}

function executeSetBgColor(canvas, action, setBgColor) {
  if (setBgColor) setBgColor(action.color)
  canvas.backgroundColor = action.color
  return true
}

function executeFlipObject(canvas, action) {
  const obj = findObjectById(canvas, action.objectId)
  if (!obj) return false
  if (action.direction === 'horizontal') {
    obj.set('flipX', !obj.flipX)
  } else if (action.direction === 'vertical') {
    obj.set('flipY', !obj.flipY)
  }
  obj.setCoords()
  return true
}

function executeReorderObject(canvas, action) {
  const obj = findObjectById(canvas, action.objectId)
  if (!obj) return false
  switch (action.position) {
    case 'front':
      canvas.bringObjectToFront(obj)
      break
    case 'back':
      canvas.sendObjectToBack(obj)
      break
    case 'forward':
      canvas.bringObjectForward(obj)
      break
    case 'backward':
      canvas.sendObjectBackwards(obj)
      break
    default:
      return false
  }
  return true
}

function executeAddShadow(canvas, action) {
  const obj = findObjectById(canvas, action.objectId)
  if (!obj) return false
  obj.set('shadow', new Shadow({
    color: action.color || 'rgba(0,0,0,0.3)',
    offsetX: action.offsetX ?? 2,
    offsetY: action.offsetY ?? 2,
    blur: action.blur ?? 5,
  }))
  obj.dirty = true
  return true
}

function removeOffCanvasObjects(canvas, canvasW = 500, canvasH = 700) {
  const toRemove = []
  for (const obj of canvas.getObjects()) {
    if (obj._dtoolTileClone) continue
    try {
      const bound = obj.getBoundingRect(true)
      const objRight = bound.left + bound.width
      const objBottom = bound.top + bound.height
      if (objRight < 0 || bound.left > canvasW || objBottom < 0 || bound.top > canvasH) {
        toRemove.push(obj)
      }
    } catch {
      /* skip */
    }
  }
  for (const obj of toRemove) {
    canvas.remove(obj)
  }
  return toRemove.length
}

function validateLayout(canvas, canvasW = 500, canvasH = 700) {
  const allObjects = canvas.getObjects()
  const filtered = allObjects.filter(o => !o._dtoolTileClone && !o._dtoolBgLayer)
  let fixes = 0

  for (const obj of filtered) {
    try {
      const bound = obj.getBoundingRect(true)
      const visW = Math.min(bound.left + bound.width, canvasW) - Math.max(bound.left, 0)
      const visH = Math.min(bound.top + bound.height, canvasH) - Math.max(bound.top, 0)
      const visibleArea = Math.max(0, visW) * Math.max(0, visH)
      const totalArea = bound.width * bound.height
      if (totalArea > 0 && visibleArea / totalArea < 0.25) {
        const clampedLeft = Math.max(-bound.width * 0.3, Math.min(canvasW - bound.width * 0.7, obj.left))
        const clampedTop = Math.max(-bound.height * 0.3, Math.min(canvasH - bound.height * 0.7, obj.top))
        obj.set({ left: clampedLeft, top: clampedTop })
        obj.setCoords()
        fixes++
      }
    } catch { /* skip */ }
  }

  const isText = (o) => ['textbox', 'i-text', 'text'].includes((o.type || '').toLowerCase())
  const texts = filtered.filter(o => isText(o))
  const images = filtered.filter(o => (o.type || '').toLowerCase() === 'image')

  for (const txt of texts) {
    try {
      const tb = txt.getBoundingRect(true)
      for (const img of images) {
        const ib = img.getBoundingRect(true)
        const overlapL = Math.max(tb.left, ib.left)
        const overlapT = Math.max(tb.top, ib.top)
        const overlapR = Math.min(tb.left + tb.width, ib.left + ib.width)
        const overlapB = Math.min(tb.top + tb.height, ib.top + ib.height)
        if (overlapR > overlapL && overlapB > overlapT) {
          const overlapArea = (overlapR - overlapL) * (overlapB - overlapT)
          const txtArea = tb.width * tb.height
          if (txtArea > 0 && overlapArea / txtArea > 0.4) {
            canvas.bringObjectToFront(txt)
            fixes++
          }
        }
      }
    } catch { /* skip */ }
  }

  return fixes
}

export async function executeActions(canvas, actions, canvasState) {
  if (!canvas || !actions || !Array.isArray(actions)) return []
  const results = []

  canvasState.saveUndoState()

  for (const action of actions) {
    try {
      let result = null
      switch (action.type) {
        case 'addText':
          result = executeAddText(canvas, action)
          break
        case 'addShape':
          result = executeAddShape(canvas, action)
          break
        case 'modifyObject':
          result = executeModifyObject(canvas, action)
          break
        case 'deleteObject':
          result = executeDeleteObject(canvas, action)
          break
        case 'setBgColor':
          result = executeSetBgColor(canvas, action, canvasState.setBgColor)
          break
        case 'flipObject':
          result = executeFlipObject(canvas, action)
          break
        case 'reorderObject':
          result = executeReorderObject(canvas, action)
          break
        case 'addShadow':
          result = executeAddShadow(canvas, action)
          break
        case 'generateImage':
          result = await executeGenerateImage(canvas, action, canvasState)
          break
        case 'editImage':
          result = await executeEditImage(canvas, action)
          break
        case 'removeBackground':
          result = await executeRemoveBackground(canvas, action)
          break
        default:
          result = { error: `Unknown action: ${action.type}` }
      }
      const succeeded = result !== null && result !== false && !result?.error
      results.push({ action: action.type, success: succeeded, result })
    } catch (err) {
      results.push({ action: action.type, success: false, error: err.message })
    }
  }

  canvas.requestRenderAll()
  const cw = canvasState.canvasW || 500
  const ch = canvasState.canvasH || 700
  const removed = removeOffCanvasObjects(canvas, cw, ch)
  const layoutFixes = validateLayout(canvas, cw, ch)
  if (removed > 0 || layoutFixes > 0) {
    canvas.requestRenderAll()
  }
  canvasState.refreshObjects()
  return results
}

/** Add an already-generated image (by URL) to the canvas. Used for "Add to design" from chat preview. Caller should call canvasState.saveUndoState() before if needed. */
export function addImageFromUrlToCanvas(canvas, imageUrl, action, canvasState = {}) {
  if (!canvas || !imageUrl) return Promise.resolve({ error: 'Missing canvas or image URL' })
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
      const maxW = (action && action.width) || 400
      const maxH = (action && action.height) || 400
      const scale = Math.min(maxW / fImg.width, maxH / fImg.height, 1)
      fImg.set({
        scaleX: scale,
        scaleY: scale,
        left: action?.left ?? (80 + Math.random() * 60),
        top: action?.top ?? (80 + Math.random() * 60),
      })
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      canvas.requestRenderAll()
      if (canvasState.refreshObjects) canvasState.refreshObjects()
      resolve({ success: true, objectId: fImg._dtoolId })
    }
    img.onerror = () => resolve({ error: 'Failed to load image' })
    img.src = imageUrl
  })
}

async function executeGenerateImage(canvas, action, canvasState) {
  const { generateImage } = await import('./aiImageApi')
  const data = await generateImage({
    prompt: action.prompt || '',
    aspectRatio: action.aspectRatio || '1:1',
    addMetal: false,
  })
  const url = data.urls?.[0]
  if (!url) return { error: 'No image URL returned' }
  return addImageFromUrlToCanvas(canvas, url, action, canvasState || {})
}

async function executeEditImage(canvas, action) {
  if (!action.objectId) return { error: 'objectId required' }
  const obj = canvas.getObjects().find(o => o._dtoolId === action.objectId)
  if (!obj || obj.type !== 'image') return { error: 'Image object not found' }

  const src = obj.getSrc?.() || obj._element?.src
  if (!src) return { error: 'Could not get image source' }

  const { editImage } = await import('./aiImageApi')
  const data = await editImage({ prompt: action.prompt || '', imageUrl: src, addMetal: true })
  const url = data.urls?.[0]
  if (!url) return { error: 'No edited image URL returned' }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
      fImg.set({ left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle })
      canvas.remove(obj)
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      resolve({ success: true, objectId: fImg._dtoolId })
    }
    img.onerror = () => resolve({ error: 'Failed to load edited image' })
    img.src = url
  })
}

async function executeRemoveBackground(canvas, action) {
  if (!action.objectId) return { error: 'objectId required' }
  const obj = canvas.getObjects().find(o => o._dtoolId === action.objectId)
  if (!obj || obj.type !== 'image') return { error: 'Image object not found' }

  const src = obj.getSrc?.() || obj._element?.src
  if (!src) return { error: 'Could not get image source' }

  const { removeBackground } = await import('./aiImageApi')
  const data = await removeBackground({ imageUrl: src })
  const url = data.urls?.[0]
  if (!url) return { error: 'No result URL returned' }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
      fImg.set({ left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle })
      canvas.remove(obj)
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      resolve({ success: true, objectId: fImg._dtoolId })
    }
    img.onerror = () => resolve({ error: 'Failed to load result image' })
    img.src = url
  })
}
