import React, { useState, useCallback, useRef } from 'react'
import { FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { MOTION_CLIPS } from '../elements/motionClips'
import BloodFill from './BloodFill'

const BASE_PATH = '/motion'

function prettifyTitle(file) {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function VideoCard({ clip, dm, onAdd, onDragStart }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const src = `${BASE_PATH}/${clip.file}`
  const title = clip.title || prettifyTitle(clip.file)

  const handleMouseEnter = () => {
    const v = videoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => {})
      setPlaying(true)
    }
  }

  const handleMouseLeave = () => {
    const v = videoRef.current
    if (v) {
      v.pause()
      v.currentTime = 0
      setPlaying(false)
    }
  }

  const captureFrame = useCallback(() => {
    const v = videoRef.current
    if (!v) return null
    const c = document.createElement('canvas')
    c.width = v.videoWidth || 640
    c.height = v.videoHeight || 360
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }, [])

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors cursor-pointer group ${
        dm
          ? 'border-gray-600/50 hover:border-gray-500 hover:bg-gray-700/60'
          : 'border-gray-100 hover:border-gray-400 hover:bg-gray-100'
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, src)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-full aspect-video bg-black rounded-t-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <polygon points="8,5 19,12 8,19" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className={`px-2 py-1.5 flex items-center gap-1.5 ${dm ? 'bg-gray-700/30' : 'bg-gray-50/80'}`}>
        <span className={`text-[9px] leading-tight flex-1 truncate ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
          {title}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(clip, captureFrame) }}
          className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${
            dm ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title="Add frame to canvas"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function VideosPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, saveUndoState, refreshObjects, bloodRain } = canvasState

  const addFrameToCanvas = useCallback((clip, captureFrame) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = captureFrame()
    if (!dataUrl) return

    saveUndoState()
    const img = new Image()
    img.onload = () => {
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
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
    img.src = dataUrl
  }, [canvasRef, saveUndoState, refreshObjects])

  const handleDragStart = (e, src) => {
    e.dataTransfer.setData('text/uri-list', src)
    e.dataTransfer.setData('text/plain', src)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 flex items-center gap-2 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>
          Videos
        </span>
        <span className={`text-[10px] tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          {MOTION_CLIPS.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <div className={`text-[10px] px-2 py-1.5 mb-2 rounded-lg ${dm ? 'text-gray-400 bg-gray-700/50' : 'text-gray-500 bg-gray-50'}`}>
          Hover to preview. Click + to add a frame to your canvas. Drag to position.
        </div>

        <div className="flex flex-col gap-1.5">
          {MOTION_CLIPS.map(clip => (
            <VideoCard
              key={clip.file}
              clip={clip}
              dm={dm}
              onAdd={addFrameToCanvas}
              onDragStart={handleDragStart}
            />
          ))}
        </div>

        {MOTION_CLIPS.length === 0 && (
          <div className={`text-center py-8 text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            No videos yet.
          </div>
        )}
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
