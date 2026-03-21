export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.NANO_BANANA_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'NANO_BANANA_API_KEY not configured on server' })
  }

  try {
    const { action, prompt, imageUrl, num, aspectRatio, model } = req.body || {}

    const ALLOWED_MODELS = [
      'gemini-2.5-flash-image', 'gemini-2.5-flash-image-hd',
      'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image-preview-2k',
      'gemini-3-pro-image-preview', 'gemini-3-pro-image-preview-4k',
    ]
    const ALLOWED_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']

    const safeModel = ALLOWED_MODELS.includes(model) ? model : 'gemini-2.5-flash-image'
    const safeRatio = ALLOWED_RATIOS.includes(aspectRatio) ? aspectRatio : '1:1'
    const safeNum = Math.max(1, Math.min(4, parseInt(num) || 1))
    const safePrompt = typeof prompt === 'string' ? prompt.slice(0, 4000) : ''

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.length > 10000) {
      return res.status(400).json({ error: 'Image URL too long' })
    }

    const ALLOWED_ACTIONS = ['generate', 'edit', 'removeBackground', 'restore', 'colorize', 'removeRedeye']
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Unknown action: ${String(action).slice(0, 50)}` })
    }

    if (action === 'generate') {
      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: safePrompt,
          num: safeNum,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('NanoBanana API error:', response.status, errText)
        return res.status(response.status).json({ error: `API returned ${response.status}: ${errText.slice(0, 200)}` })
      }

      const data = await response.json()
      console.log('NanoBanana API response keys:', Object.keys(data), 'code:', data.code)

      if (data.code !== undefined && data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Image generation failed' })
      }

      let urls = []
      if (data.data?.url) {
        urls = Array.isArray(data.data.url) ? data.data.url : [data.data.url]
      } else if (data.data?.images) {
        urls = data.data.images.map(i => i.url || i)
      } else if (data.images) {
        urls = data.images.map(i => i.url || i)
      } else if (data.url) {
        urls = Array.isArray(data.url) ? data.url : [data.url]
      }

      if (urls.length === 0) {
        console.error('No URLs found in response:', JSON.stringify(data).slice(0, 500))
        return res.status(500).json({ error: 'No image URLs in API response' })
      }

      return res.status(200).json({ urls })
    }

    if (action === 'edit') {
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required for editing' })
      }

      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Edit this image: ${safePrompt}. Source image: ${imageUrl}`,
          num: 1,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ error: errText })
      }

      const data = await response.json()
      if (data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Image editing failed' })
      }

      const urls = Array.isArray(data.data?.url) ? data.data.url : [data.data?.url]
      return res.status(200).json({ urls })
    }

    if (action === 'removeBackground') {
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required for background removal' })
      }

      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Remove the background from this image completely, leaving only the main subject on a transparent/white background. Make a clean cutout with precise edges. Source image: ${imageUrl}`,
          num: 1,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ error: errText })
      }

      const data = await response.json()
      if (data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Background removal failed' })
      }

      const urls = Array.isArray(data.data?.url) ? data.data.url : [data.data?.url]
      return res.status(200).json({ urls })
    }

    if (action === 'restore') {
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required for restoration' })
      }

      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Restore and enhance this damaged/old photo. Fix scratches, tears, fading, noise, and color degradation while preserving the original content. Make it look like a professionally restored photograph. Source image: ${imageUrl}`,
          num: 1,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ error: errText })
      }

      const data = await response.json()
      if (data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Photo restoration failed' })
      }

      const urls = Array.isArray(data.data?.url) ? data.data.url : [data.data?.url]
      return res.status(200).json({ urls })
    }

    if (action === 'colorize') {
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required for colorization' })
      }

      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Colorize this black and white photograph with realistic, natural colors. Accurately predict and apply appropriate colors for skin tones, clothing, environments, and objects based on the era and context visible in the photo. Source image: ${imageUrl}`,
          num: 1,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ error: errText })
      }

      const data = await response.json()
      if (data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Colorization failed' })
      }

      const urls = Array.isArray(data.data?.url) ? data.data.url : [data.data?.url]
      return res.status(200).json({ urls })
    }

    if (action === 'removeRedeye') {
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required for red-eye removal' })
      }

      const response = await fetch('https://api.nanobananaapi.dev/v1/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Remove red-eye from this photograph. Replace any red/glowing eyes caused by camera flash with natural, realistic eye colors while keeping everything else in the photo exactly the same. Source image: ${imageUrl}`,
          num: 1,
          model: safeModel,
          image_size: safeRatio,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ error: errText })
      }

      const data = await response.json()
      if (data.code !== 0) {
        return res.status(400).json({ error: data.message || 'Red-eye removal failed' })
      }

      const urls = Array.isArray(data.data?.url) ? data.data.url : [data.data?.url]
      return res.status(200).json({ urls })
    }

  } catch (err) {
    console.error('ai-image error:', err)
    return res.status(500).json({ error: 'Image processing failed. Please try again.' })
  }
}
