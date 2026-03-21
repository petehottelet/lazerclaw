import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Shadow, Path, Gradient, Pattern, Group, FabricImage, cache } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { buildPatternFromImage } from './ColorPicker'
import BloodFill from './BloodFill'
import { AVAILABLE_FONTS } from '../elements/fonts'
import ColorPicker from './ColorPicker'
import { flattenFabricPath } from '../utils/contour'
import { refreshTileClones, findTilingMaster } from '../utils/tiling'
import { decodeGif, decodeAnimatedWebP, createFrameCanvas, drawFrameToCanvas, FrameAnimator, prepareVideoElement } from '../utils/motionMedia'

const PASTEBOARD = 300

const MIXED = Symbol('mixed')

const Section = ({ title, children, dm }) => (
  <div className="mb-3.5">
    <div className="flex items-center gap-2 mb-2">
      <span className={`text-[11px] font-semibold ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span>
    </div>
    {children}
  </div>
)

const AlignIcon = ({ type }) => {
  const lines = {
    left: [{ x: 3, w: 14 }, { x: 3, w: 10 }, { x: 3, w: 12 }],
    center: [{ x: 3, w: 14 }, { x: 5, w: 10 }, { x: 4, w: 12 }],
    right: [{ x: 6, w: 14 }, { x: 10, w: 10 }, { x: 8, w: 12 }],
    justify: [{ x: 3, w: 14 }, { x: 3, w: 14 }, { x: 3, w: 14 }],
  }
  const l = lines[type] || lines.left
  return (
    <svg width="16" height="14" viewBox="0 0 20 14" fill="currentColor">
      {l.map((line, i) => (
        <rect key={i} x={line.x} y={1 + i * 5} width={line.w} height={2} rx="0.5" />
      ))}
    </svg>
  )
}

function isTextObj(o) {
  const t = (o.type || '').toLowerCase()
  return t === 'textbox' || t === 'i-text' || t === 'text'
}

function rgbaToHex(color) {
  if (!color) return '#000000'
  if (color.startsWith('#')) return color.slice(0, 7)
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return '#000000'
  const r = parseInt(match[1]).toString(16).padStart(2, '0')
  const g = parseInt(match[2]).toString(16).padStart(2, '0')
  const b = parseInt(match[3]).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function commonVal(objects, getter) {
  const first = getter(objects[0])
  for (let i = 1; i < objects.length; i++) {
    if (getter(objects[i]) !== first) return MIXED
  }
  return first
}

export default function RightSidebar({ canvasState, onClose }) {
  const { selectedObject, canvasRef, saveUndoState, refreshObjects, canvasW, canvasH, bloodRain } = canvasState
  const [props, setProps] = useState({})
  const [updateKey, setUpdateKey] = useState(0)
  const gestureUndoSaved = useRef(false)

  useEffect(() => {
    readProps()
  }, [selectedObject, updateKey])

  const getTargets = () => {
    if (!selectedObject) return []
    const children = selectedObject.getObjects?.() ?? selectedObject._objects
    if (children && children.length > 0) return children.filter(o => !o._dtoolTileClone)
    if (selectedObject._dtoolTileClone) return []
    return [selectedObject]
  }

  const readProps = () => {
    const targets = getTargets()
    if (targets.length === 0) { setProps({}); return }

    const multi = targets.length > 1
    const textTargets = targets.filter(isTextObj)
    const allText = textTargets.length === targets.length
    const someText = textTargets.length > 0

    const p = {
      count: targets.length,
      multi,
      allText,
      someText,
      textCount: textTargets.length,
      angle: commonVal(targets, o => Math.round(o.angle || 0)),
      opacity: commonVal(targets, o => Math.round((o.opacity ?? 1) * 100)),
    }

    if (!multi) {
      p.left = Math.round(targets[0].left || 0)
      p.top = Math.round(targets[0].top || 0)
      p.width = Math.round((targets[0].width || 0) * (targets[0].scaleX || 1))
      p.height = Math.round((targets[0].height || 0) * (targets[0].scaleY || 1))
    }

    if (someText) {
      const src = allText ? targets : textTargets
      p.fontFamily = commonVal(src, o => o.fontFamily || 'Inter')
      p.fontSize = commonVal(src, o => o.fontSize || 24)
      if (src.length === 1 && (src[0].fill instanceof Gradient || src[0].fill instanceof Pattern)) {
        p.fill = src[0].fill
      } else {
        p.fill = commonVal(src, o => {
          if (o.fill instanceof Gradient || o.fill instanceof Pattern) return MIXED
          return o.fill || '#000000'
        })
      }
      p.fontWeight = commonVal(src, o => o.fontWeight || 'normal')
      p.fontStyle = commonVal(src, o => o.fontStyle || 'normal')
      p.underline = commonVal(src, o => o.underline || false)
      p.textAlign = commonVal(src, o => o.textAlign || 'left')
      p.lineHeight = commonVal(src, o => o.lineHeight || 1.16)
      p.charSpacing = commonVal(src, o => o.charSpacing || 0)
      p.linethrough = commonVal(src, o => o.linethrough || false)
      p.overline = commonVal(src, o => o.overline || false)
      p.curveAmount = commonVal(src, o => o._dtoolCurveAmount || 0)
      p.isVertical = commonVal(src, o => !!o._dtoolVertical)
      p.vAnchor = commonVal(src, o => o._dtoolVAnchor || 'top')
      p.overflow = commonVal(src, o => o._dtoolOverflow || 'wrap')
    }

    const nonTextTargets = targets.filter(o => !isTextObj(o))
    const someNonText = nonTextTargets.length > 0
    p.someNonText = someNonText
    if (someNonText) {
      const src = allText ? [] : nonTextTargets
      if (src.length === 1 && (src[0].fill instanceof Gradient || src[0].fill instanceof Pattern)) {
        p.shapeFill = src[0].fill
      } else {
        p.shapeFill = commonVal(src, o => {
          if (o.fill instanceof Gradient || o.fill instanceof Pattern) return MIXED
          return o.fill ?? '#000000'
        })
      }
      if (selectedObject && selectedObject._dtoolMaskGroup && selectedObject._dtoolMaskImageUrl) {
        p.maskImageUrl = selectedObject._dtoolMaskImageUrl
      }
    }

    const strokeTargets = selectedObject?._dtoolMaskGroup
      ? [selectedObject]
      : targets
    p.strokeColor = commonVal(strokeTargets, o => o.stroke || '')
    p.strokeWidth = commonVal(strokeTargets, o => o.strokeWidth ?? 0)
    p.strokeLineCap = commonVal(strokeTargets, o => o.strokeLineCap || 'butt')
    p.strokeLineJoin = commonVal(strokeTargets, o => o.strokeLineJoin || 'miter')

    const dashArrays = strokeTargets.map(o => o.strokeDashArray || null)
    const firstDash = dashArrays[0]
    const dashSame = dashArrays.every(d =>
      JSON.stringify(d) === JSON.stringify(firstDash)
    )
    p.strokeDashArray = dashSame ? firstDash : MIXED
    p.strokeDashSegment = dashSame && firstDash ? (firstDash[0] ?? 0) : (dashSame ? 0 : MIXED)
    p.strokeDashGap = dashSame && firstDash ? (firstDash[1] ?? firstDash[0] ?? 0) : (dashSame ? 0 : MIXED)

    const shadowTargets = selectedObject?._dtoolMaskGroup ? [selectedObject] : targets
    p.shadowEnabled = commonVal(shadowTargets, o => o.shadow ? true : false)
    p.shadowColor = commonVal(shadowTargets, o => o.shadow?.color || 'rgba(0,0,0,0.5)')
    p.shadowBlur = commonVal(shadowTargets, o => o.shadow?.blur ?? 10)
    p.shadowOffsetX = commonVal(shadowTargets, o => o.shadow?.offsetX ?? 5)
    p.shadowOffsetY = commonVal(shadowTargets, o => o.shadow?.offsetY ?? 5)
    p.shadowOpacity = commonVal(shadowTargets, o => {
      const c = o.shadow?.color || 'rgba(0,0,0,0.5)'
      const m = c.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/)
      return m ? Math.round(parseFloat(m[1]) * 100) : 100
    })

    setProps(p)
  }

  const saveOnce = () => {
    if (!gestureUndoSaved.current) {
      saveUndoState()
      gestureUndoSaved.current = true
    }
  }

  const startGesture = () => {
    gestureUndoSaved.current = false
  }

  const syncTiles = () => {
    if (!selectedObject || !canvasRef.current) return
    const master = findTilingMaster(selectedObject)
    if (master) {
      refreshTileClones(canvasRef.current, master, canvasState.canvasW, canvasState.canvasH, PASTEBOARD)
    }
  }

  const STROKE_KEYS = ['stroke', 'strokeWidth', 'strokeUniform', 'strokeLineCap', 'strokeLineJoin', 'strokeDashArray']

  const syncStrokeShadowCache = (obj) => {
    if (obj._dtoolMaskGroup) {
      obj.objectCaching = !(obj.stroke && obj.strokeWidth > 0)
      obj.dirty = true
      return
    }
    const hasStroke = obj.stroke && obj.strokeWidth > 0
    const hasShadow = !!obj.shadow
    if (hasStroke && hasShadow) {
      obj.objectCaching = false
      obj.paintFirst = 'fill'
    } else if (!obj._dtoolMotionFill) {
      obj.objectCaching = true
    }
    obj.dirty = true
  }

  const update = (key, value) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    let targets = getTargets()
    const isTextProp = ['fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'overline', 'textAlign', 'lineHeight', 'charSpacing'].includes(key)
    const isStrokeProp = STROKE_KEYS.includes(key)

    if (isStrokeProp && selectedObject._dtoolMaskGroup) {
      targets = [selectedObject]
    }

    if (key === 'fontFamily') {
      cache.clearFontCache(value)
    }

    const charStyleKeys = ['fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline', 'linethrough', 'overline']

    const applyUpdate = () => {
      targets.forEach(obj => {
        if (isTextProp && !isTextObj(obj)) return
        if (key === 'width') {
          if (isTextObj(obj)) {
            obj.set({ width: value, scaleX: 1 })
          } else {
            obj.set('scaleX', value / obj.width)
          }
        } else if (key === 'height') {
          if (isTextObj(obj)) {
            obj.set({ height: value, scaleY: 1 })
          } else {
            obj.set('scaleY', value / obj.height)
          }
        } else {
          const hasFixedHeight = isTextObj(obj) && (obj._dtoolOverflow === 'shrink' || obj._dtoolOverflow === 'clip')
          const savedH = hasFixedHeight ? obj.height : null
          const savedW = isTextObj(obj) ? obj.width : null
          obj.set(key, value)
          if (savedW !== null && key !== 'width') obj.set('width', savedW)
          if (savedH !== null) obj.height = savedH
        }
        if (isTextObj(obj) && charStyleKeys.includes(key) && obj.styles) {
          for (const lineIdx in obj.styles) {
            const lineStyle = obj.styles[lineIdx]
            for (const charIdx in lineStyle) {
              if (lineStyle[charIdx] && key in lineStyle[charIdx]) {
                delete lineStyle[charIdx][key]
              }
            }
          }
        }
        if (isTextProp && isTextObj(obj)) {
          const hasFixedHeight = obj._dtoolOverflow === 'shrink' || obj._dtoolOverflow === 'clip'
          const savedH = hasFixedHeight ? obj.height : null
          const savedW = obj.width
          obj.dirty = true
          obj._forceClearCache = true
          obj.initDimensions?.()
          if (key !== 'width') obj.set('width', savedW)
          if (savedH !== null) obj.height = savedH
        }
        if (isStrokeProp) syncStrokeShadowCache(obj)
        obj.setCoords()
      })
      canvasRef.current.requestRenderAll()
      setUpdateKey(k => k + 1)
      syncTiles()
    }

    if (key === 'fontFamily' && document.fonts) {
      const testStyles = ['normal', 'bold']
      const loads = testStyles.map(w => document.fonts.load(`${w} 16px "${value}"`))
      Promise.all(loads).then(applyUpdate).catch(applyUpdate)
    } else {
      applyUpdate()
    }
  }

  const updateShapeFill = (colorOrGradientOrPattern) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    const targets = getTargets().filter(o => !isTextObj(o))
    targets.forEach(obj => {
      if (obj._dtoolMotionFill) {
        if (obj._dtoolMotionFillElement?.tagName === 'VIDEO') {
          obj._dtoolMotionFillElement.pause()
          obj._dtoolMotionFillElement.src = ''
        }
        if (obj._dtoolMotionFillBlobUrl) URL.revokeObjectURL(obj._dtoolMotionFillBlobUrl)
        delete obj._dtoolMotionFill
        delete obj._dtoolMotionFillType
        delete obj._dtoolMotionFillElement
        delete obj._dtoolMotionFillAnimator
        delete obj._dtoolMotionFillProxy
        delete obj._dtoolMotionFillBlobUrl
        delete obj._dtoolMotionFillSrcW
        delete obj._dtoolMotionFillSrcH
        obj.objectCaching = true
      }
      if (colorOrGradientOrPattern instanceof Gradient || colorOrGradientOrPattern instanceof Pattern) {
        obj.set('fill', colorOrGradientOrPattern)
      } else {
        obj.set('fill', colorOrGradientOrPattern || 'transparent')
      }
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const unwrapMaskGroup = useCallback(async (canvas, group) => {
    if (!group || !group._dtoolMaskGroup || !group.clipPath) return null
    const clipShape = group.clipPath
    const restored = await clipShape.clone()
    const gsx = group.scaleX || 1
    const gsy = group.scaleY || 1
    restored.set({
      left: group.left,
      top: group.top,
      angle: group.angle || 0,
      originX: group.originX,
      originY: group.originY,
      scaleX: (clipShape.scaleX || 1) * gsx,
      scaleY: (clipShape.scaleY || 1) * gsy,
      _dtoolId: group._dtoolId || uuidv4(),
      absolutePositioned: undefined,
    })
    restored.setCoords()
    const idx = canvas.getObjects().indexOf(group)
    canvas.remove(group)
    if (idx >= 0) canvas.insertAt(idx, restored)
    else canvas.add(restored)
    return restored
  }, [])

  const handleImageFill = useCallback(async (imgElement, mode, _dataUrl) => {
    if (!selectedObject || !canvasRef.current) return
    const canvas = canvasRef.current
    saveOnce()

    if (mode === 'tile') {
      let targets
      if (selectedObject._dtoolMaskGroup) {
        const restored = await unwrapMaskGroup(canvas, selectedObject)
        if (!restored) return
        canvas.setActiveObject(restored)
        targets = [restored]
      } else {
        targets = getTargets().filter(o => !isTextObj(o))
      }

      targets.forEach(obj => {
        const w = (obj.width || 100) * (obj.scaleX || 1)
        const h = (obj.height || 100) * (obj.scaleY || 1)
        const pattern = buildPatternFromImage(imgElement, mode, w, h)
        obj.set('fill', pattern)
        obj.dirty = true
        obj.setCoords()
      })
      canvas.renderAll()
      refreshObjects()
      setUpdateKey(k => k + 1)
      syncTiles()
      return
    }

    let targets = getTargets().filter(o => !isTextObj(o))
    if (selectedObject._dtoolMaskGroup) {
      const restored = await unwrapMaskGroup(canvas, selectedObject)
      if (!restored) return
      canvas.setActiveObject(restored)
      targets = [restored]
    }

    for (const obj of targets) {
      const sx = obj.scaleX || 1
      const sy = obj.scaleY || 1
      const shapeW = (obj.width || 100) * sx
      const shapeH = (obj.height || 100) * sy
      const imgW = imgElement.naturalWidth || imgElement.width
      const imgH = imgElement.naturalHeight || imgElement.height
      const imgScale = Math.min(shapeW / imgW, shapeH / imgH)

      const clipShape = await obj.clone()
      clipShape.set({
        left: 0, top: 0,
        originX: 'center', originY: 'center',
        angle: 0,
        scaleX: sx, scaleY: sy,
        fill: '#000',
        stroke: null,
        strokeWidth: 0,
        absolutePositioned: false,
      })

      const fabricImg = new FabricImage(imgElement, {
        originX: 'center', originY: 'center',
        left: 0, top: 0,
        scaleX: imgScale,
        scaleY: imgScale,
        _dtoolId: uuidv4(),
        _dtoolMaskedContent: true,
      })

      const maskChild = await obj.clone()
      maskChild.set({
        left: 0, top: 0,
        originX: 'center', originY: 'center',
        angle: 0,
        scaleX: sx, scaleY: sy,
        fill: 'transparent',
        _dtoolMaskShape: true,
        _dtoolId: uuidv4(),
        lockMovementX: true,
        lockMovementY: true,
        hasControls: false,
      })

      const group = new Group([fabricImg, maskChild], {
        left: obj.left,
        top: obj.top,
        angle: obj.angle || 0,
        originX: obj.originX,
        originY: obj.originY,
        clipPath: clipShape,
        _dtoolId: obj._dtoolId || uuidv4(),
        _dtoolMaskGroup: true,
        _dtoolMaskLinked: true,
        _dtoolMaskImageUrl: _dataUrl,
        interactive: false,
        subTargetCheck: false,
      })

      const idx = canvas.getObjects().indexOf(obj)
      canvas.remove(obj)
      if (idx >= 0) canvas.insertAt(idx, group)
      else canvas.add(group)
      canvas.setActiveObject(group)
    }

    canvas.renderAll()
    refreshObjects()
    setUpdateKey(k => k + 1)
    syncTiles()
  }, [selectedObject, canvasRef, saveOnce, getTargets, syncTiles, refreshObjects, unwrapMaskGroup])

  const handleTextImageFill = useCallback((imgElement, mode, _dataUrl) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    const targets = getTargets().filter(o => isTextObj(o))
    targets.forEach(obj => {
      const w = (obj.width || 100) * (obj.scaleX || 1)
      const h = (obj.height || 100) * (obj.scaleY || 1)
      const pattern = buildPatternFromImage(imgElement, mode, w, h)
      obj.set('fill', pattern)
      if (obj.styles) {
        for (const lineIdx in obj.styles) {
          for (const charIdx in obj.styles[lineIdx]) {
            if (obj.styles[lineIdx][charIdx]?.fill) delete obj.styles[lineIdx][charIdx].fill
          }
        }
      }
      obj.dirty = true
      obj._forceClearCache = true
      obj.initDimensions?.()
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }, [selectedObject, canvasRef, saveOnce, getTargets, syncTiles])

  const handleMotionFill = useCallback(async (file) => {
    if (!selectedObject || !canvasRef.current) return
    const targets = getTargets().filter(o => !isTextObj(o))
    if (targets.length === 0) return
    saveOnce()

    const t = file.type || ''
    const n = (file.name || '').toLowerCase()
    const isVideo = t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.webm')
    const isGif = t === 'image/gif' || n.endsWith('.gif')

    for (const obj of targets) {
      if (obj._dtoolMotionFillElement?.tagName === 'VIDEO') {
        obj._dtoolMotionFillElement.pause()
        obj._dtoolMotionFillElement.src = ''
      }
      if (obj._dtoolMotionFillBlobUrl) URL.revokeObjectURL(obj._dtoolMotionFillBlobUrl)

      const w = Math.round((obj.width || 100) * (obj.scaleX || 1))
      const h = Math.round((obj.height || 100) * (obj.scaleY || 1))
      const proxy = createFrameCanvas(w, h)
      const pctx = proxy.getContext('2d')

      try {
        if (isVideo) {
          const blobUrl = URL.createObjectURL(file)
          const videoEl = await prepareVideoElement(blobUrl)
          const vw = videoEl.videoWidth || w
          const vh = videoEl.videoHeight || h
          const scale = Math.max(w / vw, h / vh)
          const sw = vw * scale, sh = vh * scale
          pctx.drawImage(videoEl, (w - sw) / 2, (h - sh) / 2, sw, sh)

          const pat = new Pattern({ source: proxy, repeat: 'no-repeat' })
          obj.set('fill', pat)
          obj._dtoolMotionFill = true
          obj._dtoolMotionFillType = 'video'
          obj._dtoolMotionFillElement = videoEl
          obj._dtoolMotionFillProxy = proxy
          obj._dtoolMotionFillBlobUrl = blobUrl
          obj._dtoolMotionFillSrcW = vw
          obj._dtoolMotionFillSrcH = vh
          obj.objectCaching = false
          obj.dirty = true

          if (canvasState?.autoplay) videoEl.play().catch(() => {})
        } else {
          const blob = file instanceof Blob ? file : await (await fetch(URL.createObjectURL(file))).blob()
          let decoded
          if (isGif) {
            decoded = await decodeGif(await blob.arrayBuffer())
          } else {
            decoded = await decodeAnimatedWebP(blob)
          }
          const { frames, durations, width: fw, height: fh } = decoded
          const scale = Math.max(w / fw, h / fh)
          const sw = fw * scale, sh = fh * scale
          if (frames[0]) pctx.drawImage(frames[0], (w - sw) / 2, (h - sh) / 2, sw, sh)

          const animator = new FrameAnimator(frames, durations)
          const pat = new Pattern({ source: proxy, repeat: 'no-repeat' })
          obj.set('fill', pat)
          obj._dtoolMotionFill = true
          obj._dtoolMotionFillType = 'animImage'
          obj._dtoolMotionFillAnimator = animator
          obj._dtoolMotionFillProxy = proxy
          obj._dtoolMotionFillSrcW = fw
          obj._dtoolMotionFillSrcH = fh
          obj.objectCaching = false
          obj.dirty = true
        }
      } catch (err) {
        console.error('Failed to apply motion fill:', err)
      }
    }
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
  }, [selectedObject, canvasRef, saveOnce, getTargets, canvasState?.autoplay])

  const getShadowTargets = () => {
    if (selectedObject?._dtoolMaskGroup) return [selectedObject]
    return getTargets()
  }

  const updateShadowProp = (prop, value) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    const targets = getShadowTargets()
    targets.forEach(obj => {
      if (!obj.shadow) {
        obj.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 5, offsetY: 5 }))
      }
      obj.shadow[prop] = value
      obj.dirty = true
      syncStrokeShadowCache(obj)
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const updateShadowOpacity = (pct) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    const alpha = Math.max(0, Math.min(1, pct / 100))
    const targets = getShadowTargets()
    targets.forEach(obj => {
      if (!obj.shadow) {
        obj.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 5, offsetY: 5 }))
      }
      const c = obj.shadow.color || 'rgba(0,0,0,0.5)'
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (m) {
        obj.shadow.color = `rgba(${m[1]},${m[2]},${m[3]},${alpha})`
      } else {
        obj.shadow.color = `rgba(0,0,0,${alpha})`
      }
      obj.dirty = true
      syncStrokeShadowCache(obj)
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const toggleShadow = (enabled) => {
    if (!selectedObject || !canvasRef.current) return
    gestureUndoSaved.current = false
    saveOnce()
    const targets = getShadowTargets()
    targets.forEach(obj => {
      if (enabled) {
        obj.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 5, offsetY: 5 }))
      } else {
        obj.set('shadow', null)
      }
      obj.dirty = true
      syncStrokeShadowCache(obj)
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const updateCurve = (amount) => {
    if (!selectedObject || !canvasRef.current) return
    saveOnce()
    const targets = getTargets().filter(isTextObj)
    targets.forEach(obj => {
      if (amount !== 0 && obj._dtoolVertical) {
        if (obj._dtoolOrigText != null) {
          obj.set('text', obj._dtoolOrigText)
        } else {
          obj.set('text', obj.text.replace(/\n/g, ''))
        }
        obj._dtoolVertical = false
        obj._dtoolOrigText = undefined
      }
      obj._dtoolCurveAmount = amount
      if (amount === 0) {
        obj.set('path', undefined)
      } else {
        const textWidth = obj.width || 200
        const radius = textWidth * 50 / Math.abs(amount)
        const sweep = amount > 0 ? 0 : 1
        const pathStr = `M 0 0 A ${radius} ${radius} 0 0 ${sweep} ${textWidth} 0`
        obj.set('path', new Path(pathStr, { visible: false, fill: '', stroke: '' }))
      }
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const applyTextTransform = (transform) => {
    if (!selectedObject || !canvasRef.current) return
    startGesture()
    saveOnce()
    const targets = getTargets().filter(isTextObj)
    targets.forEach(obj => {
      let text = obj.text
      switch (transform) {
        case 'uppercase': text = text.toUpperCase(); break
        case 'lowercase': text = text.toLowerCase(); break
        case 'capitalize': text = text.replace(/\b\w/g, c => c.toUpperCase()); break
      }
      obj.set('text', text)
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const toggleOrientation = (vertical) => {
    if (!selectedObject || !canvasRef.current) return
    startGesture()
    saveOnce()
    const targets = getTargets().filter(isTextObj)
    targets.forEach(obj => {
      if (vertical && obj._dtoolCurveAmount) {
        obj._dtoolCurveAmount = 0
        obj.set('path', undefined)
      }
      if (vertical && !obj._dtoolVertical) {
        obj._dtoolOrigText = obj.text
        const stacked = obj.text.replace(/\n/g, '').split('').join('\n')
        obj.set('text', stacked)
        obj.set('textAlign', 'center')
        obj._dtoolVertical = true
      } else if (!vertical && obj._dtoolVertical) {
        if (obj._dtoolOrigText != null) {
          obj.set('text', obj._dtoolOrigText)
        } else {
          obj.set('text', obj.text.replace(/\n/g, ''))
        }
        obj._dtoolVertical = false
        obj._dtoolOrigText = undefined
      }
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const updateVAnchor = (anchor) => {
    if (!selectedObject || !canvasRef.current) return
    startGesture()
    saveOnce()
    const targets = getTargets().filter(isTextObj)
    targets.forEach(obj => {
      obj._dtoolVAnchor = anchor
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const updateOverflow = (mode) => {
    if (!selectedObject || !canvasRef.current) return
    startGesture()
    saveOnce()
    const targets = getTargets().filter(isTextObj)
    targets.forEach(obj => {
      obj._dtoolOverflow = mode
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.renderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const handleFlatten = () => {
    if (!selectedObject || !canvasRef.current) return
    const targets = getTargets().filter(o => o.type === 'path')
    if (targets.length === 0) return
    saveUndoState()
    const c = canvasRef.current
    for (const obj of targets) {
      const flatPathData = flattenFabricPath(obj)
      if (!flatPathData) continue
      const newPath = new Path(flatPathData, {
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        opacity: obj.opacity,
        shadow: obj.shadow,
        _dtoolId: obj._dtoolId,
        originX: 'center',
        originY: 'center',
        fillRule: 'evenodd',
        selectable: obj.selectable,
        evented: obj.evented,
      })
      c.remove(obj)
      c.add(newPath)
      c.setActiveObject(newPath)
    }
    c.requestRenderAll()
    refreshObjects()
  }

  const handleFitToCanvas = () => {
    if (!selectedObject || !canvasRef.current) return
    saveUndoState()
    const targets = getTargets()
    targets.forEach(obj => {
      const objW = obj.width * (obj.scaleX || 1)
      const objH = obj.height * (obj.scaleY || 1)
      const scale = Math.min(canvasW / objW, canvasH / objH)
      obj.set({
        scaleX: (obj.scaleX || 1) * scale,
        scaleY: (obj.scaleY || 1) * scale,
      })
      const newW = obj.width * obj.scaleX
      const newH = obj.height * obj.scaleY
      obj.set({
        left: (canvasW - newW) / 2,
        top: (canvasH - newH) / 2,
      })
      obj.setCoords()
    })
    canvasRef.current.requestRenderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const handleFillCanvas = () => {
    if (!selectedObject || !canvasRef.current) return
    saveUndoState()
    const targets = getTargets()
    targets.forEach(obj => {
      const objW = obj.width * (obj.scaleX || 1)
      const objH = obj.height * (obj.scaleY || 1)
      const scale = Math.max(canvasW / objW, canvasH / objH)
      obj.set({
        scaleX: (obj.scaleX || 1) * scale,
        scaleY: (obj.scaleY || 1) * scale,
      })
      const newW = obj.width * obj.scaleX
      const newH = obj.height * obj.scaleY
      obj.set({
        left: (canvasW - newW) / 2,
        top: (canvasH - newH) / 2,
      })
      obj.setCoords()
    })
    canvasRef.current.requestRenderAll()
    setUpdateKey(k => k + 1)
    syncTiles()
  }

  const startCrop = () => {
    if (!selectedObject || !canvasRef.current) return
    document.dispatchEvent(new CustomEvent('dtool-enter-crop', { detail: { target: selectedObject } }))
  }

  const removeCrop = () => {
    if (!selectedObject || !canvasRef.current) return
    saveUndoState()
    const targets = getTargets()
    targets.forEach(obj => {
      obj.set('clipPath', undefined)
      obj.dirty = true
      obj.setCoords()
    })
    canvasRef.current.requestRenderAll()
    setUpdateKey(k => k + 1)
  }

  const {
    activeTool,
    penStrokeColor, setPenStrokeColor,
    penFillColor, setPenFillColor,
    penStrokeWidth, setPenStrokeWidth,
    penDashArray, setPenDashArray,
    penLineCap, setPenLineCap,
    penLineJoin, setPenLineJoin,
    penOpacity, setPenOpacity,
  } = canvasState

  const dm = !!canvasState.darkMode

  const DASH_PRESETS = [
    { label: 'Solid', dash: null },
    { label: 'Dash', dash: [10, 5] },
    { label: 'Dot', dash: [2, 4] },
    { label: 'Dash-Dot', dash: [10, 4, 2, 4] },
    { label: 'Long Dash', dash: [16, 6] },
  ]

  const LINE_CAPS = [
    { id: 'butt', label: 'Butt', icon: (
      <svg width="24" height="14" viewBox="0 0 24 14"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="butt" /><line x1="4" y1="2" x2="4" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.4" /><line x1="20" y1="2" x2="20" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.4" /></svg>
    )},
    { id: 'round', label: 'Round', icon: (
      <svg width="24" height="14" viewBox="0 0 24 14"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
    )},
    { id: 'square', label: 'Square', icon: (
      <svg width="24" height="14" viewBox="0 0 24 14"><line x1="6" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="square" /></svg>
    )},
  ]

  const LINE_JOINS = [
    { id: 'miter', label: 'Miter', icon: (
      <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="miter" strokeMiterlimit="10" /></svg>
    )},
    { id: 'round', label: 'Round', icon: (
      <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /></svg>
    )},
    { id: 'bevel', label: 'Bevel', icon: (
      <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="bevel" /></svg>
    )},
  ]

  if (!selectedObject) {
    const isPenActive = activeTool === 'pen'
    return (
      <div className={`w-64 border-l flex flex-col shrink-0 relative ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
          <span className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-700'}`}>Properties</span>
          <button onClick={onClose} className={`text-lg leading-none ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>&times;</button>
        </div>
        {isPenActive ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1 pb-40">
            <Section dm={dm} title="Fill">
              <ColorPicker value={penFillColor || ''} onChange={(c) => setPenFillColor(c || 'transparent')} allowNoColor={true} dm={dm} />
            </Section>

            <Section dm={dm} title="Opacity">
              <div className="flex items-center gap-2">
                <input
                  type="range" min="0" max="1" step="0.01" value={penOpacity}
                  onChange={(e) => setPenOpacity(Number(e.target.value))}
                  className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                />
                <span className={`text-xs w-10 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{Math.round(penOpacity * 100)}%</span>
              </div>
            </Section>

            <Section dm={dm} title="Stroke">
              <ColorPicker value={penStrokeColor} onChange={setPenStrokeColor} dm={dm} />
              <div className="mt-2">
                <div className="flex items-center justify-between mb-0.5">
                  <label className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Width</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min="0.5" max="20" step="0.5" value={penStrokeWidth}
                    onChange={(e) => setPenStrokeWidth(Number(e.target.value))}
                    className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                  />
                  <span className={`text-xs w-8 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{penStrokeWidth}</span>
                </div>
              </div>

              <div className="mt-2">
                <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Dash Style</label>
                <div className="grid grid-cols-5 gap-1">
                  {DASH_PRESETS.map((preset) => {
                    const curStr = JSON.stringify(penDashArray?.length ? penDashArray : null)
                    const presetStr = JSON.stringify(preset.dash)
                    const isActive = curStr === presetStr
                    return (
                      <button
                        key={preset.label}
                        className={`h-8 rounded-lg border flex items-center justify-center transition-colors ${
                          isActive
                            ? (dm ? 'bg-gray-600 border-gray-500' : 'bg-gray-100 border-gray-300')
                            : (dm ? 'border-gray-600/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-gray-100')
                        }`}
                        onClick={() => setPenDashArray(preset.dash || [])}
                        title={preset.label}
                      >
                        <svg width="32" height="4" viewBox="0 0 32 4">
                          <line
                            x1="0" y1="2" x2="32" y2="2"
                            stroke="currentColor" strokeWidth="2"
                            strokeDasharray={preset.dash ? preset.dash.join(' ') : 'none'}
                            strokeLinecap={penLineCap}
                            className={dm ? 'text-gray-400' : 'text-gray-500'}
                          />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-2">
                <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Line Cap</label>
                <div className="flex gap-1">
                  {LINE_CAPS.map(cap => (
                    <button
                      key={cap.id}
                      className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border transition-colors ${
                        penLineCap === cap.id
                          ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                          : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                      }`}
                      onClick={() => setPenLineCap(cap.id)}
                      title={cap.label}
                    >
                      {cap.icon}
                      <span className="text-[9px]">{cap.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2">
                <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Line Join</label>
                <div className="flex gap-1">
                  {LINE_JOINS.map(join => (
                    <button
                      key={join.id}
                      className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border transition-colors ${
                        penLineJoin === join.id
                          ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                          : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                      }`}
                      onClick={() => setPenLineJoin(join.id)}
                      title={join.label}
                    >
                      {join.icon}
                      <span className="text-[9px]">{join.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className={`text-xs text-center ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Select an object on the canvas to edit its properties</p>
          </div>
        )}
        {bloodRain && <BloodFill />}
      </div>
    )
  }

  const isMixed = (v) => v === MIXED

  const headerLabel = props.multi
    ? `${props.count} Objects${props.someText ? ` (${props.textCount} text)` : ''}`
    : props.someText ? 'Edit Text' : 'Edit Object'

  return (
    <div className={`w-64 border-l flex flex-col shrink-0 relative ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-700'}`}>{headerLabel}</span>
        <button onClick={onClose} className={`text-lg leading-none ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>&times;</button>
      </div>
      <div className="p-3 space-y-1 overflow-y-auto flex-1 pb-40">
        {props.someText && (
          <>
            <Section dm={dm} title="Font">
              <select
                className={`w-full border rounded-md px-2 py-1.5 text-xs focus:ring-1 outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500 focus:ring-gray-600' : 'bg-gray-50 border-gray-100 focus:border-gray-400 focus:ring-gray-100'}`}
                value={isMixed(props.fontFamily) ? '' : props.fontFamily}
                onChange={(e) => { startGesture(); update('fontFamily', e.target.value) }}
              >
                {isMixed(props.fontFamily) && <option value="" disabled>Mixed</option>}
                {AVAILABLE_FONTS.map(f => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
            </Section>

            <Section dm={dm} title="Color">
              <ColorPicker
                value={isMixed(props.fill) ? '#888888' : (props.fill || '#000000')}
                onChange={(c) => {
                  if (c instanceof Gradient || c instanceof Pattern) {
                    update('fill', c)
                  } else {
                    update('fill', c || 'transparent')
                  }
                }}
                allowNoColor={true}
                startGesture={startGesture}
                enableGradient={true}
                gradientTarget={getTargets().find(o => isTextObj(o))}
                onImageFill={handleTextImageFill}
                dm={dm}
              />
            </Section>

            <Section dm={dm} title="Size">
              <input
                type="number"
                value={isMixed(props.fontSize) ? '' : (props.fontSize || 24)}
                placeholder={isMixed(props.fontSize) ? 'Mixed' : ''}
                onFocus={startGesture}
                onChange={(e) => update('fontSize', parseInt(e.target.value) || 12)}
                className={`w-full border rounded-md px-2 py-1.5 text-xs outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                min={1}
                max={500}
              />
            </Section>

            <Section dm={dm} title="Alignment">
              <div className="flex gap-1">
                {['left', 'center', 'right', 'justify'].map(a => (
                  <button
                    key={a}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center border transition-colors ${
                      !isMixed(props.textAlign) && props.textAlign === a
                        ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                        : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                    }`}
                    onClick={() => { startGesture(); update('textAlign', a) }}
                    title={a.charAt(0).toUpperCase() + a.slice(1)}
                  >
                    <AlignIcon type={a} />
                  </button>
                ))}
              </div>
              {isMixed(props.textAlign) && <p className={`text-[9px] mt-0.5 italic ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Mixed values</p>}
            </Section>

            <Section dm={dm} title="Vertical Anchor">
              <div className="flex gap-1">
                {[
                  { id: 'top', label: 'Top', icon: (
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="1" y1="1" x2="15" y2="1" />
                      <line x1="4" y1="4.5" x2="12" y2="4.5" strokeWidth="1" />
                      <line x1="5" y1="7" x2="11" y2="7" strokeWidth="1" />
                    </svg>
                  )},
                  { id: 'middle', label: 'Middle', icon: (
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="4" y1="4" x2="12" y2="4" strokeWidth="1" />
                      <line x1="1" y1="7" x2="15" y2="7" />
                      <line x1="5" y1="10" x2="11" y2="10" strokeWidth="1" />
                    </svg>
                  )},
                  { id: 'bottom', label: 'Bottom', icon: (
                    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <line x1="4" y1="7" x2="12" y2="7" strokeWidth="1" />
                      <line x1="5" y1="9.5" x2="11" y2="9.5" strokeWidth="1" />
                      <line x1="1" y1="13" x2="15" y2="13" />
                    </svg>
                  )},
                ].map(a => (
                  <button
                    key={a.id}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center border transition-colors ${
                      !isMixed(props.vAnchor) && (props.vAnchor || 'top') === a.id
                        ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                        : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                    }`}
                    onClick={() => updateVAnchor(a.id)}
                    title={a.label}
                  >
                    {a.icon}
                  </button>
                ))}
              </div>
            </Section>

            <Section dm={dm} title="Text Overflow">
              <div className="flex gap-1">
                {[
                  { id: 'wrap', label: 'Wrap (allow overflow)' },
                  { id: 'shrink', label: 'Shrink to fit' },
                  { id: 'clip', label: 'Clip (truncate)' },
                ].map(m => (
                  <button
                    key={m.id}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] leading-tight border transition-colors ${
                      !isMixed(props.overflow) && (props.overflow || 'wrap') === m.id
                        ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200 font-medium' : 'bg-gray-100 border-gray-300 text-gray-800 font-medium')
                        : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                    }`}
                    onClick={() => updateOverflow(m.id)}
                    title={m.label}
                  >
                    {m.id === 'wrap' ? 'Wrap' : m.id === 'shrink' ? 'Shrink' : 'Clip'}
                  </button>
                ))}
              </div>
            </Section>

            <Section dm={dm} title="Style">
              <div className="flex gap-1">
                <button
                  className={`flex-1 py-1.5 rounded-lg text-sm border font-bold transition-colors ${
                    !isMixed(props.fontWeight) && props.fontWeight === 'bold' ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800') : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-500 hover:bg-gray-100')
                  }`}
                  onClick={() => { startGesture(); update('fontWeight', (!isMixed(props.fontWeight) && props.fontWeight === 'bold') ? 'normal' : 'bold') }}
                  title="Bold"
                >B</button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-sm border italic transition-colors ${
                    !isMixed(props.fontStyle) && props.fontStyle === 'italic' ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800') : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-500 hover:bg-gray-100')
                  }`}
                  onClick={() => { startGesture(); update('fontStyle', (!isMixed(props.fontStyle) && props.fontStyle === 'italic') ? 'normal' : 'italic') }}
                  title="Italic"
                >I</button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    !isMixed(props.underline) && props.underline ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800') : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-500 hover:bg-gray-100')
                  }`}
                  onClick={() => { startGesture(); update('underline', isMixed(props.underline) ? true : !props.underline) }}
                  title="Underline"
                ><span className="underline">U</span></button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    !isMixed(props.linethrough) && props.linethrough ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800') : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-500 hover:bg-gray-100')
                  }`}
                  onClick={() => { startGesture(); update('linethrough', isMixed(props.linethrough) ? true : !props.linethrough) }}
                  title="Strikethrough"
                ><span className="line-through">S</span></button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    !isMixed(props.overline) && props.overline ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800') : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-500 hover:bg-gray-100')
                  }`}
                  onClick={() => { startGesture(); update('overline', isMixed(props.overline) ? true : !props.overline) }}
                  title="Overline"
                ><span className="overline">O</span></button>
              </div>
            </Section>

            <Section dm={dm} title="Text Case">
              <div className="flex gap-1">
                <button
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors font-medium ${dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => applyTextTransform('uppercase')}
                  title="UPPERCASE"
                >AA</button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors font-medium ${dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => applyTextTransform('lowercase')}
                  title="lowercase"
                >aa</button>
                <button
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors font-medium ${dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60' : 'border-gray-100 text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => applyTextTransform('capitalize')}
                  title="Capitalize Each Word"
                >Aa</button>
              </div>
            </Section>

            <Section dm={dm} title="Letter Spacing">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-200}
                  max={800}
                  value={isMixed(props.charSpacing) ? 0 : (props.charSpacing || 0)}
                  onPointerDown={startGesture}
                  onChange={(e) => update('charSpacing', parseInt(e.target.value))}
                  className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                />
                <input
                  type="number"
                  value={isMixed(props.charSpacing) ? '' : (props.charSpacing || 0)}
                  placeholder={isMixed(props.charSpacing) ? '—' : ''}
                  onFocus={startGesture}
                  onChange={(e) => update('charSpacing', parseInt(e.target.value) || 0)}
                  className={`w-16 border rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                />
              </div>
            </Section>

            <Section dm={dm} title="Line Spacing">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={50}
                  max={300}
                  value={isMixed(props.lineHeight) ? 116 : Math.round((props.lineHeight || 1.16) * 100)}
                  onPointerDown={startGesture}
                  onChange={(e) => update('lineHeight', parseInt(e.target.value) / 100)}
                  className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                />
                <input
                  type="number"
                  value={isMixed(props.lineHeight) ? '' : ((props.lineHeight || 1.16).toFixed(2))}
                  placeholder={isMixed(props.lineHeight) ? '—' : ''}
                  step={0.05}
                  min={0.5}
                  max={3}
                  onFocus={startGesture}
                  onChange={(e) => update('lineHeight', parseFloat(e.target.value) || 1.16)}
                  className={`w-16 border rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                />
              </div>
            </Section>

            <Section dm={dm} title={`Curved Text${!isMixed(props.isVertical) && props.isVertical ? ' (disabled for vertical text)' : ''}`}>
              <div className={`flex items-center gap-2 ${!isMixed(props.isVertical) && props.isVertical ? 'opacity-40 pointer-events-none' : ''}`}>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={isMixed(props.curveAmount) ? 0 : (props.curveAmount || 0)}
                  onPointerDown={startGesture}
                  onChange={(e) => updateCurve(parseInt(e.target.value))}
                  className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                />
                <input
                  type="number"
                  value={isMixed(props.curveAmount) ? '' : (props.curveAmount || 0)}
                  placeholder={isMixed(props.curveAmount) ? '—' : ''}
                  min={-100}
                  max={100}
                  onFocus={startGesture}
                  onChange={(e) => updateCurve(parseInt(e.target.value) || 0)}
                  className={`w-16 border rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                />
              </div>
            </Section>

            <Section dm={dm} title="Text Orientation">
              <div className="flex gap-2">
                <button
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border transition-colors ${
                    !isMixed(props.isVertical) && !props.isVertical
                      ? (dm ? 'bg-cyan-900/30 border-cyan-700 text-gray-200' : 'bg-cyan-50 border-cyan-200 text-gray-700')
                      : (dm ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')
                  }`}
                  onClick={() => toggleOrientation(false)}
                  title="Horizontal"
                >
                  <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                    <text x="2" y="15" fontSize="11" fontWeight="600" fontFamily="system-ui" fill="currentColor" stroke="currentColor" strokeWidth="0.3">abc</text>
                  </svg>
                  <span className="text-[10px]">Horizontal</span>
                </button>
                <button
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border transition-colors ${
                    !isMixed(props.isVertical) && props.isVertical
                      ? (dm ? 'bg-cyan-900/30 border-cyan-700 text-gray-200' : 'bg-cyan-50 border-cyan-200 text-gray-700')
                      : (dm ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50')
                  }`}
                  onClick={() => toggleOrientation(true)}
                  title={!isMixed(props.curveAmount) && props.curveAmount ? 'Vertical (will reset curved text)' : 'Vertical'}
                >
                  <svg width="16" height="28" viewBox="0 0 16 28" fill="none">
                    <text x="3" y="10" fontSize="8" fontWeight="600" fontFamily="system-ui" fill="currentColor" stroke="currentColor" strokeWidth="0.2">a</text>
                    <text x="3" y="19" fontSize="8" fontWeight="600" fontFamily="system-ui" fill="currentColor" stroke="currentColor" strokeWidth="0.2">b</text>
                    <text x="3" y="28" fontSize="8" fontWeight="600" fontFamily="system-ui" fill="currentColor" stroke="currentColor" strokeWidth="0.2">c</text>
                  </svg>
                  <span className="text-[10px]">Vertical</span>
                </button>
              </div>
            </Section>
          </>
        )}

        {props.someNonText && (
          <Section dm={dm} title="Fill">
            <ColorPicker
              value={isMixed(props.shapeFill) ? '#888888' : (props.shapeFill || '')}
              onChange={(c) => updateShapeFill(c)}
              allowNoColor={true}
              startGesture={startGesture}
              enableGradient={true}
              gradientTarget={getTargets().find(o => !isTextObj(o))}
              onImageFill={handleImageFill}
              onMotionFill={handleMotionFill}
              motionFillActive={!!getTargets().find(o => o._dtoolMotionFill)}
              maskImageUrl={props.maskImageUrl || null}
              dm={dm}
            />
          </Section>
        )}

        {getTargets().some(o => o.type === 'path') && (
          <Section dm={dm} title="Path">
            <button
              className={`w-full px-3 py-1.5 text-xs border rounded-lg transition-colors ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 active:bg-gray-600 text-gray-300' : 'border-gray-100 hover:bg-gray-100 active:bg-gray-200 text-gray-700'}`}
              onClick={handleFlatten}
              title="Flatten self-intersecting paths into clean outlines with holes preserved"
            >
              Flatten Path
            </button>
          </Section>
        )}

        {!props.multi && (
          <Section dm={dm} title="Position">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>X</label>
                <input
                  type="number"
                  value={props.left ?? 0}
                  onFocus={startGesture}
                  onChange={(e) => update('left', parseInt(e.target.value) || 0)}
                  className={`w-full border rounded-md px-2 py-1.5 text-xs outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                />
              </div>
              <div>
                <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Y</label>
                <input
                  type="number"
                  value={props.top ?? 0}
                  onFocus={startGesture}
                  onChange={(e) => update('top', parseInt(e.target.value) || 0)}
                  className={`w-full border rounded-md px-2 py-1.5 text-xs outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                />
              </div>
            </div>
          </Section>
        )}

        <Section dm={dm} title="Rotate">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              value={isMixed(props.angle) ? 0 : (props.angle || 0)}
              onPointerDown={startGesture}
              onChange={(e) => update('angle', parseInt(e.target.value))}
              className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
            />
            <span className={`text-xs w-10 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {isMixed(props.angle) ? '—' : `${props.angle || 0}°`}
            </span>
          </div>
        </Section>

        <Section dm={dm} title="Opacity">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={isMixed(props.opacity) ? 100 : (props.opacity || 100)}
              onPointerDown={startGesture}
              onChange={(e) => update('opacity', parseInt(e.target.value) / 100)}
              className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
            />
            <span className={`text-xs w-8 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
              {isMixed(props.opacity) ? '—' : `${props.opacity}%`}
            </span>
          </div>
        </Section>

        <Section dm={dm} title="Flip">
          <div className="flex gap-1">
            <button
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-600'}`}
              onClick={() => {
                const targets = getTargets()
                saveUndoState()
                targets.forEach(o => o.set('flipX', !o.flipX))
                canvasRef.current.renderAll()
                setUpdateKey(k => k + 1)
                syncTiles()
              }}
            >↔ Horizontal</button>
            <button
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 text-gray-300' : 'border-gray-100 hover:bg-gray-100 text-gray-600'}`}
              onClick={() => {
                const targets = getTargets()
                saveUndoState()
                targets.forEach(o => o.set('flipY', !o.flipY))
                canvasRef.current.renderAll()
                setUpdateKey(k => k + 1)
                syncTiles()
              }}
            >↕ Vertical</button>
          </div>
        </Section>

        <Section dm={dm} title="Canvas Sizing">
          <div className="flex gap-1">
            <button
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1 ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 active:bg-gray-600 text-gray-300' : 'border-gray-100 hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
              onClick={handleFitToCanvas}
              title="Scale to fit within canvas, maintaining aspect ratio"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="14" height="14" rx="1" strokeDasharray="2 1.5" />
                <rect x="3" y="4" width="10" height="8" rx="0.5" fill="currentColor" stroke="none" opacity="0.25" />
                <rect x="3" y="4" width="10" height="8" rx="0.5" />
              </svg>
              Fit
            </button>
            <button
              className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1 ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 active:bg-gray-600 text-gray-300' : 'border-gray-100 hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
              onClick={handleFillCanvas}
              title="Scale to fill entire canvas, maintaining aspect ratio (may crop edges)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="14" height="14" rx="1" strokeDasharray="2 1.5" />
                <rect x="-1" y="3" width="18" height="10" rx="0.5" fill="currentColor" stroke="none" opacity="0.25" />
                <rect x="-1" y="3" width="18" height="10" rx="0.5" />
              </svg>
              Fill
            </button>
          </div>
        </Section>

        <Section dm={dm} title="Crop">
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <button
                className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1 ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 active:bg-gray-600 text-gray-300' : 'border-gray-100 hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
                onClick={startCrop}
                title="Crop selected object (or double-click)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M4 1v11h11" />
                  <path d="M12 15V4H1" />
                </svg>
                Crop
              </button>
              {getTargets().some(o => o.clipPath) && (
                <button
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1 ${dm ? 'border-gray-600/50 hover:bg-gray-700/60 active:bg-gray-600 text-gray-300' : 'border-gray-100 hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
                  onClick={removeCrop}
                  title="Remove crop and restore original"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <line x1="3" y1="3" x2="13" y2="13" />
                    <line x1="13" y1="3" x2="3" y2="13" />
                  </svg>
                  Reset
                </button>
              )}
            </div>
            <p className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Double-click image to crop</p>
          </div>
        </Section>

        <Section dm={dm} title="Stroke">
          <div className="space-y-2">
            <ColorPicker
              value={isMixed(props.strokeColor) ? '#000000' : (props.strokeColor || '')}
              onChange={(c) => {
                update('stroke', c)
                update('strokeUniform', true)
                if (c && (isMixed(props.strokeWidth) || (props.strokeWidth || 0) === 0)) {
                  update('strokeWidth', 2)
                }
                if (!c) update('strokeWidth', 0)
              }}
              allowNoColor={true}
              startGesture={startGesture}
              dm={dm}
            />
            <div>
              <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Width</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={isMixed(props.strokeWidth) ? 0 : (props.strokeWidth || 0)}
                  onPointerDown={startGesture}
                  onChange={(e) => { update('strokeWidth', parseFloat(e.target.value)); update('strokeUniform', true) }}
                  className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                />
                <span className={`text-xs w-8 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  {isMixed(props.strokeWidth) ? '—' : (props.strokeWidth || 0)}
                </span>
              </div>
            </div>

            <div>
              <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Dash Style</label>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: 'Solid', dash: null },
                  { label: 'Dash', dash: [10, 5] },
                  { label: 'Dot', dash: [2, 4] },
                  { label: 'Dash-Dot', dash: [10, 4, 2, 4] },
                  { label: 'Long Dash', dash: [16, 6] },
                ].map((preset) => {
                  const curDash = isMixed(props.strokeDashArray) ? '__mixed__' : JSON.stringify(props.strokeDashArray)
                  const presetStr = JSON.stringify(preset.dash)
                  const isActive = curDash === presetStr
                  return (
                    <button
                      key={preset.label}
                      className={`h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        isActive
                          ? (dm ? 'bg-gray-600 border-gray-500' : 'bg-gray-100 border-gray-300')
                          : (dm ? 'border-gray-600/50 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-gray-100')
                      }`}
                      onClick={() => {
                        startGesture()
                        saveOnce()
                        let targets = getTargets()
                        if (selectedObject?._dtoolMaskGroup) targets = [selectedObject]
                        targets.forEach(obj => {
                          obj.set('strokeDashArray', preset.dash ? [...preset.dash] : null)
                          if (preset.dash && !obj.stroke) obj.set('stroke', '#000000')
                          if (preset.dash && (!obj.strokeWidth || obj.strokeWidth === 0)) obj.set('strokeWidth', 2)
                          obj.set('strokeUniform', true)
                          syncStrokeShadowCache(obj)
                        })
                        canvasRef.current.requestRenderAll()
                        setUpdateKey(k => k + 1)
                        syncTiles()
                      }}
                      title={preset.label}
                    >
                      <svg width="32" height="4" viewBox="0 0 32 4">
                        <line
                          x1="0" y1="2" x2="32" y2="2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray={preset.dash ? preset.dash.join(' ') : 'none'}
                          strokeLinecap={!isMixed(props.strokeLineCap) ? props.strokeLineCap : 'butt'}
                          className={dm ? 'text-gray-400' : 'text-gray-500'}
                        />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>

            {!isMixed(props.strokeDashArray) && props.strokeDashArray && (
              <>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Dash Length</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={isMixed(props.strokeDashSegment) ? 10 : (props.strokeDashSegment || 10)}
                      onPointerDown={startGesture}
                      onChange={(e) => {
                        saveOnce()
                        const seg = parseInt(e.target.value)
                        const gap = isMixed(props.strokeDashGap) ? 5 : (props.strokeDashGap || 5)
                        const curDash = props.strokeDashArray || []
                        const newDash = curDash.length > 2
                          ? curDash.map((v, i) => i % 2 === 0 ? seg : v)
                          : [seg, gap]
                        const targets = getTargets()
                        targets.forEach(obj => {
                          obj.set('strokeDashArray', [...newDash])
                          obj.dirty = true
                        })
                        canvasRef.current.requestRenderAll()
                        setUpdateKey(k => k + 1)
                        syncTiles()
                      }}
                      className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={isMixed(props.strokeDashSegment) ? '' : (props.strokeDashSegment || 10)}
                      placeholder={isMixed(props.strokeDashSegment) ? '—' : ''}
                      onFocus={startGesture}
                      onChange={(e) => {
                        saveOnce()
                        const seg = parseInt(e.target.value) || 1
                        const gap = isMixed(props.strokeDashGap) ? 5 : (props.strokeDashGap || 5)
                        const curDash = props.strokeDashArray || []
                        const newDash = curDash.length > 2
                          ? curDash.map((v, i) => i % 2 === 0 ? seg : v)
                          : [seg, gap]
                        const targets = getTargets()
                        targets.forEach(obj => {
                          obj.set('strokeDashArray', [...newDash])
                          obj.dirty = true
                        })
                        canvasRef.current.requestRenderAll()
                        setUpdateKey(k => k + 1)
                        syncTiles()
                      }}
                      className={`w-14 border rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Gap Length</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={isMixed(props.strokeDashGap) ? 5 : (props.strokeDashGap || 5)}
                      onPointerDown={startGesture}
                      onChange={(e) => {
                        saveOnce()
                        const gap = parseInt(e.target.value)
                        const seg = isMixed(props.strokeDashSegment) ? 10 : (props.strokeDashSegment || 10)
                        const curDash = props.strokeDashArray || []
                        const newDash = curDash.length > 2
                          ? curDash.map((v, i) => i % 2 === 1 ? gap : v)
                          : [seg, gap]
                        const targets = getTargets()
                        targets.forEach(obj => {
                          obj.set('strokeDashArray', [...newDash])
                          obj.dirty = true
                        })
                        canvasRef.current.requestRenderAll()
                        setUpdateKey(k => k + 1)
                        syncTiles()
                      }}
                      className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={isMixed(props.strokeDashGap) ? '' : (props.strokeDashGap || 5)}
                      placeholder={isMixed(props.strokeDashGap) ? '—' : ''}
                      onFocus={startGesture}
                      onChange={(e) => {
                        saveOnce()
                        const gap = parseInt(e.target.value) || 1
                        const seg = isMixed(props.strokeDashSegment) ? 10 : (props.strokeDashSegment || 10)
                        const curDash = props.strokeDashArray || []
                        const newDash = curDash.length > 2
                          ? curDash.map((v, i) => i % 2 === 1 ? gap : v)
                          : [seg, gap]
                        const targets = getTargets()
                        targets.forEach(obj => {
                          obj.set('strokeDashArray', [...newDash])
                          obj.dirty = true
                        })
                        canvasRef.current.requestRenderAll()
                        setUpdateKey(k => k + 1)
                        syncTiles()
                      }}
                      className={`w-14 border rounded-md px-2 py-1.5 text-xs text-right tabular-nums outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Line Cap</label>
              <div className="flex gap-1">
                {[
                  { id: 'butt', label: 'Butt', icon: (
                    <svg width="24" height="14" viewBox="0 0 24 14"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="butt" /><line x1="4" y1="2" x2="4" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.4" /><line x1="20" y1="2" x2="20" y2="12" stroke="currentColor" strokeWidth="0.5" opacity="0.4" /></svg>
                  )},
                  { id: 'round', label: 'Round', icon: (
                    <svg width="24" height="14" viewBox="0 0 24 14"><line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
                  )},
                  { id: 'square', label: 'Square', icon: (
                    <svg width="24" height="14" viewBox="0 0 24 14"><line x1="6" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="4" strokeLinecap="square" /></svg>
                  )},
                ].map(cap => (
                  <button
                    key={cap.id}
                    className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border transition-colors ${
                      !isMixed(props.strokeLineCap) && props.strokeLineCap === cap.id
                        ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                        : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                    }`}
                    onClick={() => {
                      startGesture()
                      saveOnce()
                      const targets = getTargets()
                      targets.forEach(obj => {
                        obj.set('strokeLineCap', cap.id)
                        obj.dirty = true
                      })
                      canvasRef.current.requestRenderAll()
                      setUpdateKey(k => k + 1)
                      syncTiles()
                    }}
                    title={cap.label}
                  >
                    {cap.icon}
                    <span className="text-[9px]">{cap.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Line Join</label>
              <div className="flex gap-1">
                {[
                  { id: 'miter', label: 'Miter', icon: (
                    <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="miter" strokeMiterlimit="10" /></svg>
                  )},
                  { id: 'round', label: 'Round', icon: (
                    <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /></svg>
                  )},
                  { id: 'bevel', label: 'Bevel', icon: (
                    <svg width="28" height="18" viewBox="0 0 28 18"><polyline points="4,16 14,2 24,16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="bevel" /></svg>
                  )},
                ].map(join => (
                  <button
                    key={join.id}
                    className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border transition-colors ${
                      !isMixed(props.strokeLineJoin) && props.strokeLineJoin === join.id
                        ? (dm ? 'bg-gray-600 border-gray-500 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800')
                        : (dm ? 'border-gray-600/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200' : 'border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700')
                    }`}
                    onClick={() => {
                      startGesture()
                      saveOnce()
                      const targets = getTargets()
                      targets.forEach(obj => {
                        obj.set('strokeLineJoin', join.id)
                        obj.dirty = true
                      })
                      canvasRef.current.requestRenderAll()
                      setUpdateKey(k => k + 1)
                      syncTiles()
                    }}
                    title={join.label}
                  >
                    {join.icon}
                    <span className="text-[9px]">{join.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section dm={dm} title="Drop Shadow">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMixed(props.shadowEnabled) ? false : !!props.shadowEnabled}
                onChange={(e) => toggleShadow(e.target.checked)}
                className={dm ? 'rounded-md border-gray-600/50 accent-blue-400' : 'rounded-md border-gray-200 accent-blue-500'}
              />
              <span className={`text-xs ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                {isMixed(props.shadowEnabled) ? 'Mixed' : (props.shadowEnabled ? 'Enabled' : 'Disabled')}
              </span>
            </label>

            {(isMixed(props.shadowEnabled) || props.shadowEnabled) && (
              <>
                <div>
                  <label className={`text-[10px] block mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Color</label>
                  <ColorPicker
                    value={isMixed(props.shadowColor) ? '#000000' : rgbaToHex(props.shadowColor)}
                    onChange={(c) => {
                      const hex = c || '#000000'
                      const alpha = isMixed(props.shadowOpacity) ? 0.5 : (props.shadowOpacity ?? 50) / 100
                      const r = parseInt(hex.slice(1, 3), 16)
                      const g = parseInt(hex.slice(3, 5), 16)
                      const b = parseInt(hex.slice(5, 7), 16)
                      updateShadowProp('color', `rgba(${r},${g},${b},${alpha})`)
                    }}
                    startGesture={startGesture}
                    dm={dm}
                  />
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Blur</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={isMixed(props.shadowBlur) ? 10 : (props.shadowBlur ?? 10)}
                      onPointerDown={startGesture}
                      onChange={(e) => updateShadowProp('blur', parseInt(e.target.value))}
                      className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                    />
                    <span className={`text-xs w-6 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isMixed(props.shadowBlur) ? '—' : (props.shadowBlur ?? 10)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Opacity</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMixed(props.shadowOpacity) ? 50 : (props.shadowOpacity ?? 50)}
                      onPointerDown={startGesture}
                      onChange={(e) => updateShadowOpacity(parseInt(e.target.value))}
                      className={`flex-1 ${dm ? 'accent-blue-400' : 'accent-blue-500'}`}
                    />
                    <span className={`text-xs w-8 text-right tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isMixed(props.shadowOpacity) ? '—' : `${props.shadowOpacity ?? 50}%`}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Offset X</label>
                    <input
                      type="number"
                      value={isMixed(props.shadowOffsetX) ? '' : (props.shadowOffsetX ?? 5)}
                      placeholder={isMixed(props.shadowOffsetX) ? '—' : ''}
                      onFocus={startGesture}
                      onChange={(e) => updateShadowProp('offsetX', parseInt(e.target.value) || 0)}
                      className={`w-full border rounded-md px-2 py-1.5 text-xs outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Offset Y</label>
                    <input
                      type="number"
                      value={isMixed(props.shadowOffsetY) ? '' : (props.shadowOffsetY ?? 5)}
                      placeholder={isMixed(props.shadowOffsetY) ? '—' : ''}
                      onFocus={startGesture}
                      onChange={(e) => updateShadowProp('offsetY', parseInt(e.target.value) || 0)}
                      className={`w-full border rounded-md px-2 py-1.5 text-xs outline-none transition-colors ${dm ? 'bg-gray-700 border-gray-600/50 text-gray-200 focus:border-gray-500' : 'bg-gray-50 border-gray-100 focus:border-gray-400'}`}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
