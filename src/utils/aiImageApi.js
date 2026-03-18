const METAL_ENHANCERS = [
  'with dramatic lightning bolts and electric energy',
  'with chrome metallic textures and neon purple glow',
  'with 80s hair metal concert lighting and smoke machines',
  'in a heavy metal album cover aesthetic with dark dramatic lighting',
  'with electric guitar riffs visualized as energy waves',
  'with leather and chrome accents, concert stage atmosphere',
  'with molten metal and volcanic energy effects',
  'with power chord energy and amplifier stack vibes',
  'with battle vest patches and studded leather details',
  'with arena rock lighting and pyrotechnic effects',
]

function addMetalFlair(prompt) {
  const enhancer = METAL_ENHANCERS[Math.floor(Math.random() * METAL_ENHANCERS.length)]
  return `${prompt}, ${enhancer}`
}

export async function generateImage({ prompt, aspectRatio = '1:1', num = 1, model, addMetal = true }) {
  const finalPrompt = addMetal ? addMetalFlair(prompt) : prompt
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate', prompt: finalPrompt, num, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Image generation failed')
  }
  return res.json()
}

export async function editImage({ prompt, imageUrl, aspectRatio, model, addMetal = true }) {
  const finalPrompt = addMetal ? addMetalFlair(prompt) : prompt
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'edit', prompt: finalPrompt, imageUrl, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Image editing failed')
  }
  return res.json()
}

export async function removeBackground({ imageUrl, aspectRatio, model }) {
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'removeBackground', imageUrl, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Background removal failed')
  }
  return res.json()
}

export async function restorePhoto({ imageUrl, aspectRatio, model }) {
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'restore', imageUrl, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Photo restoration failed')
  }
  return res.json()
}

export async function colorizePhoto({ imageUrl, aspectRatio, model }) {
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'colorize', imageUrl, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Colorization failed')
  }
  return res.json()
}

export async function removeRedeye({ imageUrl, aspectRatio, model }) {
  const res = await fetch('/api/ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'removeRedeye', imageUrl, aspectRatio, model }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || 'Red-eye removal failed')
  }
  return res.json()
}

export const ASPECT_RATIOS = [
  { value: '1:1', label: 'Square (1:1)' },
  { value: '16:9', label: 'Landscape (16:9)' },
  { value: '9:16', label: 'Portrait (9:16)' },
  { value: '4:3', label: 'Standard (4:3)' },
  { value: '3:4', label: 'Standard Portrait (3:4)' },
  { value: '3:2', label: 'Photo (3:2)' },
  { value: '2:3', label: 'Photo Portrait (2:3)' },
]

export const AI_MODELS = [
  { value: 'gemini-2.5-flash-image', label: 'Fast (2 credits)' },
  { value: 'gemini-2.5-flash-image-hd', label: 'HD (5 credits)' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Flash 3.1 (4 credits)' },
  { value: 'gemini-3.1-flash-image-preview-2k', label: 'Flash 3.1 2K (6 credits)' },
  { value: 'gemini-3-pro-image-preview', label: 'Pro 3 (8 credits)' },
  { value: 'gemini-3-pro-image-preview-4k', label: 'Pro 3 4K (16 credits)' },
]
