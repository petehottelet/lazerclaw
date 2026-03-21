import React, { useState, useCallback, useEffect } from 'react'
import { FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import BloodFill from './BloodFill'

const LOBSTER_IMAGES = [
  { file: 'lobster_01.jpg', title: 'Board Meeting Lobster' },
  { file: 'lobster_02.jpg', title: 'Lobster Shredding Guitar' },
  { file: 'lobster_03.jpg', title: 'Lobster on a Motorcycle' },
  { file: 'lobster_04.jpg', title: 'Lobster at the Dentist' },
  { file: 'lobster_05.jpg', title: 'Lobster Doing Taxes' },
  { file: 'lobster_06.jpg', title: 'Lobster in a Mosh Pit' },
  { file: 'lobster_07.jpg', title: 'Lobster Lifting Weights' },
  { file: 'lobster_08.jpg', title: 'Lobster Wedding Photo' },
  { file: 'lobster_09.jpg', title: 'Lobster on Stage' },
  { file: 'lobster_10.jpg', title: 'Lobster at the DMV' },
  { file: 'lobster_11.jpg', title: 'Lobster Recording Album' },
  { file: 'lobster_12.jpg', title: 'Lobster Grocery Shopping' },
  { file: 'lobster_13.jpg', title: 'Lobster Crowd Surfing' },
  { file: 'lobster_14.jpg', title: 'Lobster Cooking Show' },
  { file: 'lobster_15.jpg', title: 'Lobster Headbanging' },
  { file: 'lobster_16.jpg', title: 'Lobster Job Interview' },
  { file: 'lobster_17.jpg', title: 'Lobster Battle of the Bands' },
  { file: 'lobster_18.jpg', title: 'Lobster at the Laundromat' },
  { file: 'lobster_19.jpg', title: 'Lobster Drum Solo' },
  { file: 'lobster_20.jpg', title: 'Lobster Traffic Jam' },
  { file: 'lobster_21.jpg', title: 'Lobster Album Cover' },
  { file: 'lobster_22.jpg', title: 'Lobster Walking the Dog' },
  { file: 'lobster_23.jpg', title: 'Lobster Stage Dive' },
  { file: 'lobster_24.jpg', title: 'Lobster Yoga Class' },
  { file: 'lobster_25.jpg', title: 'Lobster Riding a Dragon' },
]

const BASE_PATH = '/lobsters'

export default function LobstersPanel({ canvasState }) {
  const dm = !!canvasState.darkMode
  const { canvasRef, saveUndoState, refreshObjects, bloodRain } = canvasState
  const [loadingFile, setLoadingFile] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generatedLobsters, setGeneratedLobsters] = useState([])

  useEffect(() => {
    fetch('/api/lobsters')
      .then(r => r.ok ? r.json() : { lobsters: [] })
      .then(data => setGeneratedLobsters(data.lobsters || []))
      .catch(() => {})
  }, [])

  const addImageToCanvas = useCallback((src) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      saveUndoState()
      const fImg = new FabricImage(img, { _dtoolId: uuidv4() })
      const maxDim = 300
      if (fImg.width > maxDim || fImg.height > maxDim) {
        const scale = maxDim / Math.max(fImg.width, fImg.height)
        fImg.set({ scaleX: scale, scaleY: scale })
      }
      fImg.set({ left: 80 + Math.random() * 60, top: 80 + Math.random() * 60 })
      canvas.add(fImg)
      canvas.setActiveObject(fImg)
      canvas.renderAll()
      refreshObjects()
      setLoadingFile(null)
    }
    img.onerror = () => setLoadingFile(null)
    img.src = src
  }, [canvasRef, saveUndoState, refreshObjects])

  const addToCanvas = useCallback((file) => {
    setLoadingFile(file)
    addImageToCanvas(`${BASE_PATH}/${file}`)
  }, [addImageToCanvas])

  const addGeneratedToCanvas = useCallback((url) => {
    setLoadingFile(url)
    addImageToCanvas(url)
  }, [addImageToCanvas])

  const handleDragStart = (e, src) => {
    e.dataTransfer.setData('text/uri-list', src)
    e.dataTransfer.setData('text/plain', src)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const generateLobster = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/lobsters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Generation failed')
      }
      const lobster = await res.json()
      setGeneratedLobsters(prev => [lobster, ...prev])
    } catch (err) {
      console.error('Lobster generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }, [])

  const totalCount = generatedLobsters.length + LOBSTER_IMAGES.length

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 flex items-center gap-2 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>
          Stock Lobsters
        </span>
        <span className={`text-[10px] tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          {totalCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <div className={`text-[10px] px-2 py-1.5 mb-2 rounded-lg ${dm ? 'text-gray-400 bg-gray-700/50' : 'text-gray-500 bg-gray-50'}`}>
          Heavy metal lobsters in real life situations. Click or drag to add to canvas.
        </div>

        <button
          onClick={generateLobster}
          disabled={generating}
          className="w-full mb-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', border: '1px solid rgba(192,192,208,0.3)' }}
        >
          {generating ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Generate Lobster
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-1.5 px-0.5">
          {generatedLobsters.map((lob) => (
            <button
              key={lob.url}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors cursor-pointer group relative ${
                dm
                  ? 'border-purple-500/40 hover:border-purple-400 hover:bg-gray-700/60'
                  : 'border-purple-200 hover:border-purple-500 hover:bg-purple-50'
              } ${loadingFile === lob.url ? 'opacity-50' : ''}`}
              onClick={() => addGeneratedToCanvas(lob.url)}
              draggable
              onDragStart={(e) => handleDragStart(e, lob.url)}
              title={lob.title}
            >
              <div className="w-full aspect-square flex items-center justify-center overflow-hidden rounded relative">
                <img
                  src={lob.url}
                  alt={lob.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span className={`absolute top-0.5 right-0.5 text-[6px] font-bold px-1 py-0.5 rounded ${dm ? 'bg-purple-600/80 text-purple-100' : 'bg-purple-100 text-purple-700'}`}>
                  AI
                </span>
              </div>
              <span className={`text-[8px] leading-tight text-center truncate w-full ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
                {lob.title}
              </span>
            </button>
          ))}

          {LOBSTER_IMAGES.map(({ file, title }) => (
            <button
              key={file}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors cursor-pointer group relative ${
                dm
                  ? 'border-gray-600/50 hover:border-gray-500 hover:bg-gray-700/60'
                  : 'border-gray-100 hover:border-gray-400 hover:bg-gray-100'
              } ${loadingFile === file ? 'opacity-50' : ''}`}
              onClick={() => addToCanvas(file)}
              draggable
              onDragStart={(e) => handleDragStart(e, `${BASE_PATH}/${file}`)}
              title={title}
            >
              <div className="w-full aspect-square flex items-center justify-center overflow-hidden rounded">
                <img
                  src={`${BASE_PATH}/${file}`}
                  alt={title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <span className={`text-[8px] leading-tight text-center truncate w-full ${dm ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-500 group-hover:text-gray-800'}`}>
                {title}
              </span>
            </button>
          ))}
        </div>
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
