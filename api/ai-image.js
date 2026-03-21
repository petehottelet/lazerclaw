const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const ALLOWED_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-hd',
  'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image-preview-2k',
  'gemini-3-pro-image-preview',
  'gemini-3-pro-image-preview-4k',
]

const ALLOWED_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']

async function callGemini(apiKey, model, contents, imageConfig) {
  const url = `${GEMINI_BASE}/${model}:generateContent`
  const body = {
    contents: [{ parts: contents }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }
  if (imageConfig) {
    body.generationConfig.imageConfig = imageConfig
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Gemini API error:', response.status, errText.slice(0, 500))
    const parsed = JSON.parse(errText).catch?.(() => null)
    const msg = parsed?.error?.message || errText.slice(0, 200)
    const err = new Error(`Gemini API ${response.status}: ${msg}`)
    err.status = response.status
    throw err
  }

  return response.json()
}

function extractImages(data) {
  const parts = data?.candidates?.[0]?.content?.parts || []
  const urls = []
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType) {
      urls.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
    }
  }
  return urls
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Image generation API key not configured on server' })
  }

  try {
    const { action, prompt, imageUrl, aspectRatio, model } = req.body || {}

    const safeModel = ALLOWED_MODELS.includes(model) ? model : 'gemini-2.5-flash-image'
    const safeRatio = ALLOWED_RATIOS.includes(aspectRatio) ? aspectRatio : '1:1'
    const safePrompt = typeof prompt === 'string' ? prompt.slice(0, 4000) : ''

    const ALLOWED_ACTIONS = ['generate', 'edit', 'removeBackground', 'restore', 'colorize', 'removeRedeye']
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Unknown action: ${String(action).slice(0, 50)}` })
    }

    const imageConfig = { aspectRatio: safeRatio }

    if (action === 'generate') {
      const data = await callGemini(apiKey, safeModel, [{ text: safePrompt }], imageConfig)
      const urls = extractImages(data)
      if (urls.length === 0) {
        console.error('No images in Gemini response:', JSON.stringify(data).slice(0, 500))
        return res.status(500).json({ error: 'No image was generated. The model may have refused the prompt.' })
      }
      return res.status(200).json({ urls })
    }

    if (action === 'edit') {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required for editing' })
      const parts = [{ text: `Edit this image: ${safePrompt}` }]
      if (imageUrl.startsWith('data:')) {
        const [header, b64] = imageUrl.split(',')
        const mime = header.match(/data:(.*?);/)?.[1] || 'image/png'
        parts.push({ inlineData: { mimeType: mime, data: b64 } })
      }
      const data = await callGemini(apiKey, safeModel, parts, imageConfig)
      const urls = extractImages(data)
      if (urls.length === 0) return res.status(500).json({ error: 'Image editing produced no output' })
      return res.status(200).json({ urls })
    }

    const TASK_PROMPTS = {
      removeBackground: 'Remove the background from this image completely, leaving only the main subject on a transparent/white background with precise edges.',
      restore: 'Restore and enhance this damaged/old photo. Fix scratches, tears, fading, noise, and color degradation while preserving the original content.',
      colorize: 'Colorize this black and white photograph with realistic, natural colors based on the era and context visible in the photo.',
      removeRedeye: 'Remove red-eye from this photograph. Replace any red/glowing eyes with natural, realistic eye colors while keeping everything else exactly the same.',
    }

    if (TASK_PROMPTS[action]) {
      if (!imageUrl) return res.status(400).json({ error: `imageUrl is required for ${action}` })
      const taskPrompt = safePrompt ? `${TASK_PROMPTS[action]} Additional: ${safePrompt}` : TASK_PROMPTS[action]
      const parts = [{ text: taskPrompt }]
      if (imageUrl.startsWith('data:')) {
        const [header, b64] = imageUrl.split(',')
        const mime = header.match(/data:(.*?);/)?.[1] || 'image/png'
        parts.push({ inlineData: { mimeType: mime, data: b64 } })
      }
      const data = await callGemini(apiKey, safeModel, parts, imageConfig)
      const urls = extractImages(data)
      if (urls.length === 0) return res.status(500).json({ error: `${action} produced no output` })
      return res.status(200).json({ urls })
    }

  } catch (err) {
    console.error('ai-image error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Image processing failed. Please try again.' })
  }
}
