import React, { useState, useRef } from 'react'
import { generateImage, editImage, removeBackground, restorePhoto, colorizePhoto, removeRedeye, ASPECT_RATIOS, AI_MODELS } from '../utils/aiImageApi'

const TOOLS = [
  { id: 'generate', label: 'Text to Image', desc: 'Generate images from text descriptions', icon: '✦' },
  { id: 'edit', label: 'Image Editing', desc: 'Edit images with text instructions', icon: '✎' },
  { id: 'removeBg', label: 'Background Removal', desc: 'Remove backgrounds from images', icon: '✂' },
  { id: 'restore', label: 'Photo Restoration', desc: 'Restore old or damaged photos', icon: '🔧' },
  { id: 'colorize', label: 'Colorize', desc: 'Add color to black & white photos', icon: '🎨' },
  { id: 'redeye', label: 'Red-Eye Removal', desc: 'Fix red-eye from flash photography', icon: '👁' },
]

function ResultImage({ url }) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-700">
      <img src={url} alt="Result" className="w-full h-auto" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold"
      >
        Open Full Size
      </a>
    </div>
  )
}

export default function AiToolsPage() {
  const [activeTool, setActiveTool] = useState('generate')
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [model, setModel] = useState('gemini-2.5-flash-image')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImageUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleRun = async () => {
    setLoading(true)
    setError('')
    try {
      let data
      switch (activeTool) {
        case 'generate':
          data = await generateImage({ prompt, aspectRatio, model, addMetal: false })
          break
        case 'edit':
          data = await editImage({ prompt, imageUrl, aspectRatio, model, addMetal: false })
          break
        case 'removeBg':
          data = await removeBackground({ imageUrl, aspectRatio, model })
          break
        case 'restore':
          data = await restorePhoto({ imageUrl, aspectRatio, model })
          break
        case 'colorize':
          data = await colorizePhoto({ imageUrl, aspectRatio, model })
          break
        case 'redeye':
          data = await removeRedeye({ imageUrl, aspectRatio, model })
          break
      }
      if (data?.urls) {
        setResults(prev => [...data.urls.map(u => ({ url: u, tool: activeTool, time: Date.now() })), ...prev])
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const needsImage = ['edit', 'removeBg', 'restore', 'colorize', 'redeye'].includes(activeTool)
  const needsPrompt = ['generate', 'edit'].includes(activeTool)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">&larr; Back</a>
          <h1 className="text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">AI Tools Lab</span>
          </h1>
          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">Private</span>
        </div>

        <div className="grid grid-cols-[240px_1fr] gap-6">
          <div className="space-y-1">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => { setActiveTool(tool.id); setError('') }}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm ${
                  activeTool === tool.id
                    ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="mr-2">{tool.icon}</span>
                <span className="font-medium">{tool.label}</span>
                <div className="text-[10px] mt-0.5 opacity-60 ml-6">{tool.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <h2 className="text-lg font-bold mb-4">{TOOLS.find(t => t.id === activeTool)?.label}</h2>

              {needsPrompt && (
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">
                    {activeTool === 'edit' ? 'Edit Instructions' : 'Prompt'}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={activeTool === 'edit' ? 'Describe how to edit the image...' : 'Describe the image you want to generate...'}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-gray-200 resize-none outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              )}

              {needsImage && (
                <div className="mb-4">
                  <label className="text-xs text-gray-400 block mb-1">Source Image</label>
                  <div className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="Paste image URL..."
                      className="flex-1 rounded-lg px-3 py-2 text-sm bg-gray-800 border border-gray-700 text-gray-200 outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Upload
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </div>
                  {imageUrl && (
                    <img src={imageUrl} alt="Source" className="mt-2 max-h-32 rounded border border-gray-700" />
                  )}
                </div>
              )}

              <div className="flex gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={e => setAspectRatio(e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-200 outline-none"
                  >
                    {ASPECT_RATIOS.map(ar => (
                      <option key={ar.value} value={ar.value}>{ar.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Model</label>
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="rounded-lg px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 text-gray-200 outline-none"
                  >
                    {AI_MODELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleRun}
                disabled={loading || (needsPrompt && !prompt.trim()) || (needsImage && !imageUrl)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold uppercase transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #7c3aed 100%)',
                  color: '#fff',
                  boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                }}
              >
                {loading ? 'Processing...' : 'Run'}
              </button>

              {error && (
                <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-3">Results ({results.length})</h3>
                <div className="grid grid-cols-2 gap-3">
                  {results.map((r, i) => (
                    <ResultImage key={i} url={r.url} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
