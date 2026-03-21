import React, { useState, useEffect, useCallback } from 'react'
import { FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { getGalleryImages, removeFromGallery, clearGallery } from '../utils/imageGallery'
import BloodFill from './BloodFill'

function formatDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function GeneratedImagesPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, saveUndoState, refreshObjects, bloodRain } = canvasState
  const [images, setImages] = useState(() => getGalleryImages())
  const [filter, setFilter] = useState('all')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const refresh = () => setImages(getGalleryImages())
    window.addEventListener('gallery-updated', refresh)
    return () => window.removeEventListener('gallery-updated', refresh)
  }, [])

  const addToCanvas = useCallback((img) => {
    const canvas = canvasRef.current
    if (!canvas) return
    saveUndoState()
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => {
      const fImg = new FabricImage(el, { _dtoolId: uuidv4() })
      const maxDim = 400
      if (fImg.width > maxDim || fImg.height > maxDim) {
        const scale = maxDim / Math.max(fImg.width, fImg.height)
        fImg.set({ scaleX: scale, scaleY: scale })
      }
      fImg.set({ left: 80 + Math.random() * 60, top: 80 + Math.random() * 60 })
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      canvas.renderAll()
      refreshObjects()
    }
    el.onerror = () => {
      const el2 = new Image()
      el2.onload = () => {
        const fImg = new FabricImage(el2, { _dtoolId: uuidv4() })
        const maxDim = 400
        if (fImg.width > maxDim || fImg.height > maxDim) {
          const scale = maxDim / Math.max(fImg.width, fImg.height)
          fImg.set({ scaleX: scale, scaleY: scale })
        }
        fImg.set({ left: 80 + Math.random() * 60, top: 80 + Math.random() * 60 })
        canvas.add(fImg)
        canvas.setActiveObject(fImg)
        canvas.renderAll()
        refreshObjects()
      }
      el2.src = img.url
    }
    el.src = img.url
  }, [canvasRef, saveUndoState, refreshObjects])

  const handleDelete = useCallback((id) => {
    removeFromGallery(id)
    setImages(prev => prev.filter(img => img.id !== id))
  }, [])

  const handleClearAll = useCallback(() => {
    clearGallery()
    setImages([])
    setConfirmClear(false)
  }, [])

  const sources = [...new Set(images.map(i => i.source))]
  const filtered = filter === 'all' ? images : images.filter(i => i.source === filter)

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 flex items-center justify-between ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>Generated Images</span>
        <span className={`text-[10px] tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{images.length}</span>
      </div>

      {sources.length > 1 && (
        <div className={`px-2 py-1.5 border-b flex gap-1 flex-wrap ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filter === 'all' ? (dm ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700') : (dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
          >
            All
          </button>
          {sources.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filter === s ? (dm ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700') : (dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className={`text-center py-8 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            No images yet. Generate some with Dr. Claw or the AI tools!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(img => (
              <div
                key={img.id}
                className={`rounded-lg border overflow-hidden group ${dm ? 'border-gray-600/50 hover:border-gray-500' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <div className="relative">
                  <img
                    src={img.url}
                    alt={img.prompt || 'Generated image'}
                    className="w-full h-auto block"
                    style={{ maxHeight: 200, objectFit: 'cover' }}
                    loading="lazy"
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => addToCanvas(img)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'rgba(14,165,233,0.85)', backdropFilter: 'blur(4px)' }}
                      title="Add to canvas"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(img.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'rgba(220,38,38,0.85)', backdropFilter: 'blur(4px)' }}
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
                <div className={`px-2 py-1.5 ${dm ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  {img.prompt && (
                    <p className={`text-[10px] leading-tight line-clamp-2 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                      {img.prompt}
                    </p>
                  )}
                  <div className={`flex items-center justify-between mt-0.5 text-[9px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span>{img.source}</span>
                    <span>{formatDate(img.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className={`px-3 py-2 border-t shrink-0 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Clear all?</span>
              <button onClick={handleClearAll} className="text-[10px] font-bold text-red-500 hover:text-red-400">Yes</button>
              <button onClick={() => setConfirmClear(false)} className={`text-[10px] font-bold ${dm ? 'text-gray-400' : 'text-gray-500'}`}>No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className={`text-[10px] transition-colors ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Clear all images
            </button>
          )}
        </div>
      )}
      {bloodRain && <BloodFill />}
    </div>
  )
}
