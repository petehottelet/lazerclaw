import React, { useState, useRef, useCallback } from 'react'
import { FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import { generateImage, editImage, removeBackground, restorePhoto, colorizePhoto, removeRedeye, ASPECT_RATIOS, AI_MODELS } from '../utils/aiImageApi'
import { saveToGallery } from '../utils/imageGallery'
import BloodFill from './BloodFill'

const TABS = [
  { id: 'generate', label: 'Generate', icon: '✦' },
  { id: 'edit', label: 'Edit', icon: '✎' },
  { id: 'tools', label: 'Photo Tools', icon: '⚡' },
]

function ImageResult({ url, onAddToCanvas }) {
  return (
    <div className="relative group rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <img src={url} alt="AI Generated" className="w-full h-auto block" style={{ minHeight: 80 }} />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={() => onAddToCanvas(url)}
          className="px-3 py-1.5 rounded text-xs font-bold uppercase"
          style={{ background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)', color: '#fff', border: '1px solid #c0c0d0' }}
        >
          Add to Canvas
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded text-xs font-bold bg-gray-700 text-white hover:bg-gray-600"
        >
          Open
        </a>
      </div>
    </div>
  )
}

export default function AiToolsPanel({ canvasState, darkMode }) {
  const dm = darkMode
  const { bloodRain } = canvasState
  const [activeTab, setActiveTab] = useState('generate')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [model, setModel] = useState('gemini-2.5-flash-image')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [editPrompt, setEditPrompt] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [toolImageUrl, setToolImageUrl] = useState('')
  const [activeTool, setActiveTool] = useState(null)
  const fileInputRef = useRef(null)
  const toolFileRef = useRef(null)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await generateImage({ prompt: prompt.trim(), aspectRatio, model })
      data.urls.forEach(url => saveToGallery({ url, prompt: prompt.trim(), source: 'Text to Image' }))
      setResults(prev => [...data.urls.map(url => ({ url, type: 'generated' })), ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [prompt, aspectRatio, model])

  const handleEdit = useCallback(async () => {
    if (!editPrompt.trim() || !editImageUrl.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await editImage({ prompt: editPrompt.trim(), imageUrl: editImageUrl.trim(), aspectRatio, model })
      setResults(prev => [...data.urls.map(url => ({ url, type: 'edited' })), ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [editPrompt, editImageUrl, aspectRatio, model])

  const handlePhotoTool = useCallback(async (action) => {
    if (!toolImageUrl.trim()) return
    setLoading(true)
    setError('')
    setActiveTool(action)
    try {
      const params = { imageUrl: toolImageUrl.trim(), aspectRatio, model }
      let data
      if (action === 'removeBackground') data = await removeBackground(params)
      else if (action === 'restore') data = await restorePhoto(params)
      else if (action === 'colorize') data = await colorizePhoto(params)
      else if (action === 'removeRedeye') data = await removeRedeye(params)
      const urls = data?.urls || []
      if (urls.length === 0) throw new Error('No result returned from the API')
      setResults(prev => [...urls.map(url => ({ url, type: action })), ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setActiveTool(null)
    }
  }, [toolImageUrl, aspectRatio, model])

  const handleAddToCanvas = useCallback((url) => {
    const canvas = canvasState?.canvasRef?.current
    if (!canvas) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (canvasState.saveUndoState) canvasState.saveUndoState()
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
      if (canvasState.refreshObjects) canvasState.refreshObjects()
    }
    img.onerror = () => setError('Failed to load image. The URL may be invalid or inaccessible.')
    img.src = url
  }, [canvasState])

  const handleFileUpload = useCallback((e, setter) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setter(reader.result)
    reader.readAsDataURL(file)
  }, [])

  const inputStyle = {
    background: dm ? 'rgba(30,30,50,0.8)' : '#f8fafc',
    border: dm ? '1px solid rgba(100,160,255,0.3)' : '1px solid #cbd5e1',
    color: dm ? '#e2e8f0' : '#1e293b',
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${dm ? '%23888' : '%23666'}' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 28,
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden relative"
      style={{
        background: dm
          ? 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)'
          : '#ffffff',
      }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span style={{ fontSize: 16 }}>⚡</span>
          <span className="text-sm font-bold" style={{ color: dm ? '#e2e8f0' : '#1e293b' }}>AI Tools</span>
        </div>
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-all"
              style={{
                background: activeTab === tab.id
                  ? (dm ? 'rgba(100,160,255,0.2)' : 'rgba(59,130,246,0.1)')
                  : 'transparent',
                border: activeTab === tab.id
                  ? (dm ? '1px solid rgba(100,160,255,0.4)' : '1px solid rgba(59,130,246,0.3)')
                  : '1px solid transparent',
                color: activeTab === tab.id
                  ? (dm ? '#8bb8ff' : '#2563eb')
                  : (dm ? '#888' : '#94a3b8'),
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 px-3 pb-2">
        <select
          value={aspectRatio}
          onChange={e => setAspectRatio(e.target.value)}
          className="flex-1 rounded px-2 py-1 text-[10px]"
          style={selectStyle}
        >
          {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="flex-1 rounded px-2 py-1 text-[10px]"
          style={selectStyle}
        >
          {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin' }}>
        {error && (
          <div className="mb-2 p-2 rounded text-xs text-red-400" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}>
            {error}
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="flex flex-col gap-2">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              rows={3}
              className="w-full rounded px-3 py-2 text-xs resize-none outline-none"
              style={inputStyle}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full rounded py-2 text-xs font-bold uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
                color: '#fff',
                border: '1px solid #c0c0d0',
                boxShadow: '0 0 10px rgba(120,80,210,0.5)',
              }}
            >
              {loading ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase" style={{ color: dm ? '#888' : '#94a3b8' }}>Image URL or Upload</div>
            <div className="flex gap-1">
              <input
                value={editImageUrl}
                onChange={e => setEditImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
                style={inputStyle}
              />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, setEditImageUrl)} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1.5 rounded text-xs"
                style={{ background: dm ? 'rgba(60,65,80,0.8)' : '#e2e8f0', color: dm ? '#ccc' : '#475569' }}
              >
                Upload
              </button>
            </div>
            <textarea
              value={editPrompt}
              onChange={e => setEditPrompt(e.target.value)}
              placeholder="Describe the edits you want to make..."
              rows={3}
              className="w-full rounded px-3 py-2 text-xs resize-none outline-none"
              style={inputStyle}
            />
            <button
              onClick={handleEdit}
              disabled={loading || !editPrompt.trim() || !editImageUrl.trim()}
              className="w-full rounded py-2 text-xs font-bold uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #181440 0%, #7888c8 48%, #ffffff 50%, #2a1050 52%, #8848c8 100%)',
                color: '#fff',
                border: '1px solid #c0c0d0',
                boxShadow: '0 0 10px rgba(120,80,210,0.5)',
              }}
            >
              {loading ? 'Editing...' : 'Edit Image'}
            </button>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase" style={{ color: dm ? '#888' : '#94a3b8' }}>Image URL or Upload</div>
            <div className="flex gap-1">
              <input
                value={toolImageUrl}
                onChange={e => setToolImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
                style={inputStyle}
              />
              <input ref={toolFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, setToolImageUrl)} />
              <button
                onClick={() => toolFileRef.current?.click()}
                className="px-2 py-1.5 rounded text-xs"
                style={{ background: dm ? 'rgba(60,65,80,0.8)' : '#e2e8f0', color: dm ? '#ccc' : '#475569' }}
              >
                Upload
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {[
                { action: 'removeBackground', label: 'Remove BG', icon: '🔲' },
                { action: 'restore', label: 'Restore Photo', icon: '🔧' },
                { action: 'colorize', label: 'Colorize', icon: '🎨' },
                { action: 'removeRedeye', label: 'Fix Red-Eye', icon: '👁' },
              ].map(tool => (
                <button
                  key={tool.action}
                  onClick={() => handlePhotoTool(tool.action)}
                  disabled={loading || !toolImageUrl.trim()}
                  className="flex flex-col items-center gap-1 rounded p-2 text-[10px] font-bold uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: dm ? 'rgba(40,45,60,0.8)' : '#f1f5f9',
                    border: activeTool === tool.action
                      ? '1px solid rgba(100,160,255,0.6)'
                      : (dm ? '1px solid rgba(100,160,255,0.2)' : '1px solid #e2e8f0'),
                    color: dm ? '#ccc' : '#475569',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{tool.icon}</span>
                  {activeTool === tool.action && loading ? 'Working...' : tool.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Gallery */}
        {results.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase" style={{ color: dm ? '#888' : '#94a3b8' }}>Results</div>
              <button
                onClick={() => setResults([])}
                className="text-[9px] px-2 py-0.5 rounded"
                style={{ color: dm ? '#888' : '#94a3b8', background: dm ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <ImageResult key={`${r.url}-${i}`} url={r.url} onAddToCanvas={handleAddToCanvas} />
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs" style={{ color: dm ? '#888' : '#94a3b8' }}>
              <span style={{ animation: 'agentIconPulse 1s ease-in-out infinite', display: 'inline-block' }}>⚡</span>
              {' '}Processing...
            </div>
          </div>
        )}
      </div>
      {bloodRain && <BloodFill />}
    </div>
  )
}
