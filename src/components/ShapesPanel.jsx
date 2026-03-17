import React, { useState, useMemo, useCallback } from 'react'
import { Rect, Circle, Ellipse, Triangle, Polygon, Path, FabricImage, Group, loadSVGFromString } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { VECTOR_SHAPE_CATEGORIES } from '../elements/vectorShapes'

// Single filled style for all shapes: one fill color, no stroke
const SHAPE_FILL = '#C8C4BE'
const SHAPE_OPTS = { stroke: 'transparent', strokeWidth: 0 }

const SHAPES = [
  {
    id: 'rectangle',
    label: 'Rectangle',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><rect x="3" y="6" width="22" height="16" rx="1" fill="currentColor" /></svg>,
    create: () => new Rect({ width: 120, height: 80, fill: SHAPE_FILL, rx: 0, ry: 0, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'square',
    label: 'Square',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="4" width="20" height="20" rx="1" fill="currentColor" /></svg>,
    create: () => new Rect({ width: 100, height: 100, fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'rounded_rect',
    label: 'Rounded Rectangle',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><rect x="3" y="6" width="22" height="16" rx="5" fill="currentColor" /></svg>,
    create: () => new Rect({ width: 120, height: 80, fill: SHAPE_FILL, rx: 12, ry: 12, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'circle',
    label: 'Circle',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="currentColor" /></svg>,
    create: () => new Circle({ radius: 50, fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><ellipse cx="14" cy="14" rx="12" ry="8" fill="currentColor" /></svg>,
    create: () => new Ellipse({ rx: 60, ry: 40, fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'triangle',
    label: 'Triangle',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,4 3,24 25,24" fill="currentColor" /></svg>,
    create: () => new Triangle({ width: 100, height: 90, fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }),
  },
  {
    id: 'diamond',
    label: 'Diamond',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,3 25,14 14,25 3,14" fill="currentColor" /></svg>,
    create: () => new Polygon(
      [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }],
      { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
    ),
  },
  {
    id: 'pentagon',
    label: 'Pentagon',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,3 25,10.5 21,23 7,23 3,10.5" fill="currentColor" /></svg>,
    create: () => {
      const r = 50
      const pts = Array.from({ length: 5 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
        return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) }
      })
      return new Polygon(pts, { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
    },
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,3 24,8.5 24,19.5 14,25 4,19.5 4,8.5" fill="currentColor" /></svg>,
    create: () => {
      const r = 50
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 2
        return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) }
      })
      return new Polygon(pts, { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
    },
  },
  {
    id: 'star',
    label: 'Star',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,3 17,11 25,11 19,16 21,24 14,20 7,24 9,16 3,11 11,11" fill="currentColor" /></svg>,
    create: () => {
      const outer = 50, inner = 22
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? outer : inner
        const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
        return { x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) }
      })
      return new Polygon(pts, { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() })
    },
  },
  {
    id: 'heart',
    label: 'Heart',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 24s-9-5.5-9-12a5 5 0 019-3 5 5 0 019 3c0 6.5-9 12-9 12z" fill="currentColor" /></svg>,
    create: () => new Path(
      'M 50 30 C 50 10, 90 0, 90 30 C 90 60, 50 90, 50 90 C 50 90, 10 60, 10 30 C 10 0, 50 10, 50 30 Z',
      { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
    ),
  },
  {
    id: 'arrow_right',
    label: 'Arrow',
    icon: <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="3,10 18,10 18,5 25,14 18,23 18,18 3,18" fill="currentColor" /></svg>,
    create: () => new Polygon(
      [
        { x: 0, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 10 },
        { x: 100, y: 50 }, { x: 70, y: 90 }, { x: 70, y: 70 }, { x: 0, y: 70 },
      ],
      { fill: SHAPE_FILL, ...SHAPE_OPTS, _dtoolId: uuidv4() }
    ),
  },
]

const SECTION_ICONS = {
  shapes: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
  vectors: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
    </svg>
  ),
}

const INITIAL_VISIBLE = 6

function prettifyFilename(filepath) {
  const filename = filepath.includes('/') ? filepath.split('/').pop() : filepath
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+\d+$/, '')
}

function SectionHeader({ icon, label, count, expanded, onToggle, dm }) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold rounded-lg transition-colors ${dm ? 'text-gray-100 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
      onClick={onToggle}
    >
      <span className={dm ? 'text-gray-400' : 'text-gray-500'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className={`text-[10px] tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{count}</span>
      <svg
        width="12" height="12" viewBox="0 0 12 12"
        className={`transition-transform ${dm ? 'text-gray-500' : 'text-gray-400'} ${expanded ? 'rotate-0' : '-rotate-90'}`}
      >
        <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function SubCategory({ label, count, expanded, onToggle, children, dm }) {
  return (
    <div className="mb-1">
      <button
        className={`w-full flex items-center justify-between px-2 py-1 text-[11px] font-medium transition-colors ${dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <span className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{count}</span>
          <svg
            width="10" height="10" viewBox="0 0 12 12"
            className={`transition-transform ${dm ? 'text-gray-500' : 'text-gray-400'} ${expanded ? 'rotate-0' : '-rotate-90'}`}
          >
            <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {expanded && children}
    </div>
  )
}

function VectorShapeGrid({ files, basePath, onAdd, onDragStart, showAllState, onToggleShowAll, gridId, dm }) {
  const showAll = showAllState[gridId]
  const visible = showAll ? files : files.slice(0, INITIAL_VISIBLE)
  const hasMore = files.length > INITIAL_VISIBLE

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 px-1">
        {visible.map(file => (
          <button
            key={file}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors cursor-pointer group ${dm ? 'border-gray-600/50 hover:border-gray-500 hover:bg-gray-700/60' : 'border-gray-100 hover:border-gray-400 hover:bg-gray-100'}`}
            onClick={() => onAdd(file)}
            draggable
            onDragStart={(e) => onDragStart(e, file, basePath)}
            title={prettifyFilename(file)}
          >
            <div className="w-7 h-7 flex items-center justify-center">
              <img
                src={`${basePath}/${file}`}
                alt=""
                className={`max-w-full max-h-full object-contain transition-opacity ${dm ? 'opacity-70 group-hover:opacity-100' : 'opacity-50 group-hover:opacity-80'}`}
                style={dm ? { filter: 'invert(1) brightness(0.85)' } : undefined}
                loading="lazy"
              />
            </div>
            <span className={`text-[9px] leading-tight text-center truncate w-full ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
              {prettifyFilename(file)}
            </span>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          className={`w-full mt-1 text-[10px] transition-colors py-0.5 ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
          onClick={() => onToggleShowAll(gridId)}
        >
          {showAll ? 'Show less' : `Show all ${files.length}`}
        </button>
      )}
    </div>
  )
}

export default function ShapesPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, saveUndoState, refreshObjects } = canvasState
  const [sections, setSections] = useState({
    shapes: true,
    vectors: true,
  })
  const [subExpanded, setSubExpanded] = useState({})
  const [showAllMap, setShowAllMap] = useState({})

  const toggleSection = (id) => {
    setSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSub = (id) => {
    setSubExpanded(prev => ({ ...prev, [id]: prev[id] === false ? true : prev[id] === undefined ? false : !prev[id] }))
  }
  const isSubExpanded = (id) => subExpanded[id] !== false

  const toggleShowAll = (id) => {
    setShowAllMap(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const addShape = (shapeDef) => {
    const canvas = canvasRef.current
    if (!canvas) return
    saveUndoState()
    const obj = shapeDef.create()
    obj.set({ left: 100 + Math.random() * 50, top: 100 + Math.random() * 50 })
    canvas.add(obj)
    canvas.setActiveObject(obj)
    canvas.renderAll()
    refreshObjects()
  }

  const addImageAsset = async (basePath, filename) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = `${basePath}/${filename}`

    if (filename.toLowerCase().endsWith('.svg')) {
      try {
        const resp = await fetch(url)
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
        obj.set({ left: 100 + Math.random() * 50, top: 100 + Math.random() * 50 })
        canvas.add(obj)
        canvas.setActiveObject(obj)
        canvas.renderAll()
        refreshObjects()
      } catch (err) {
        console.warn('SVG load failed, falling back to image:', err)
        addImageAssetRaster(basePath, filename)
      }
      return
    }

    addImageAssetRaster(basePath, filename)
  }

  const addImageAssetRaster = (basePath, filename) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = `${basePath}/${filename}`
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
      fImg.set({ left: 100 + Math.random() * 50, top: 100 + Math.random() * 50 })
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      canvas.renderAll()
      refreshObjects()
    }
    img.src = url
  }

  const handleDragStart = (e, filename, basePath) => {
    e.dataTransfer.setData('text/uri-list', `${basePath}/${filename}`)
    e.dataTransfer.setData('text/plain', filename)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const vectorCount = useMemo(() =>
    VECTOR_SHAPE_CATEGORIES.reduce((s, c) => s + c.files.length, 0), []
  )

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>My Files</span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">

        {/* Basic Shapes */}
        <div className="mb-1">
          <SectionHeader
            icon={SECTION_ICONS.shapes}
            label="Basic Shapes"
            count={SHAPES.length}
            expanded={sections.shapes}
            onToggle={() => toggleSection('shapes')}
            dm={dm}
          />
          {sections.shapes && (
            <div className="grid grid-cols-3 gap-1.5 px-1 pb-2">
              {SHAPES.map(shape => (
                <button
                  key={shape.id}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors cursor-pointer group ${dm ? 'border-gray-600/50 hover:border-gray-500 hover:bg-gray-700/60' : 'border-gray-100 hover:border-gray-400 hover:bg-gray-100'}`}
                  onClick={() => addShape(shape)}
                  title={shape.label}
                >
                  <div className={`transition-colors ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
                    {shape.icon}
                  </div>
                  <span className={`text-[9px] leading-tight text-center ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
                    {shape.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vector Shapes */}
        {VECTOR_SHAPE_CATEGORIES.length > 0 && (
          <div className="mb-1">
            <SectionHeader
              icon={SECTION_ICONS.vectors}
              label="Vector Shapes"
              count={vectorCount}
              expanded={sections.vectors}
              onToggle={() => toggleSection('vectors')}
              dm={dm}
            />
            {sections.vectors && (
              <div className="pb-2">
                {VECTOR_SHAPE_CATEGORIES.map(cat => (
                  <SubCategory
                    key={cat.id}
                    label={cat.label}
                    count={cat.files.length}
                    expanded={isSubExpanded(cat.id)}
                    onToggle={() => toggleSub(cat.id)}
                    dm={dm}
                  >
                    <VectorShapeGrid
                      files={cat.files}
                      basePath="/shapes"
                      onAdd={(f) => addImageAsset('/shapes', f)}
                      onDragStart={(e, f) => handleDragStart(e, f, '/shapes')}
                      showAllState={showAllMap}
                      onToggleShowAll={toggleShowAll}
                      gridId={cat.id}
                      dm={dm}
                    />
                  </SubCategory>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
