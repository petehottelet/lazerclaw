import React, { useState, useCallback } from 'react'
import { FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'

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
  const { canvasRef, saveUndoState, refreshObjects } = canvasState
  const [loadingFile, setLoadingFile] = useState(null)

  const addToCanvas = useCallback((file) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLoadingFile(file)

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
    img.src = `${BASE_PATH}/${file}`
  }, [canvasRef, saveUndoState, refreshObjects])

  const handleDragStart = (e, file) => {
    e.dataTransfer.setData('text/uri-list', `${BASE_PATH}/${file}`)
    e.dataTransfer.setData('text/plain', file)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className={`w-64 border-r flex flex-col shrink-0 relative z-10 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className={`px-3 py-2 border-b shrink-0 flex items-center gap-2 ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>
          Stock Lobsters
        </span>
        <span className={`text-[10px] tabular-nums ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          {LOBSTER_IMAGES.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <div className={`text-[10px] px-2 py-1.5 mb-2 rounded-lg ${dm ? 'text-gray-400 bg-gray-700/50' : 'text-gray-500 bg-gray-50'}`}>
          Heavy metal lobsters in real life situations. Click or drag to add to canvas.
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-0.5">
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
              onDragStart={(e) => handleDragStart(e, file)}
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
    </div>
  )
}
