export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' })
  }

  try {
    const { system, messages, snapshot, referenceImages } = req.body
    if (!system || !messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing system prompt or messages array' })
    }

    const anthropicMessages = messages.map(m => {
      if (m.role === 'user' && (m.snapshot || m.images)) {
        const content = []
        if (m.snapshot) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: m.snapshot },
          })
        }
        if (m.images && Array.isArray(m.images)) {
          for (const img of m.images) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.data },
            })
          }
        }
        content.push({ type: 'text', text: m.content })
        return { role: 'user', content }
      }
      return { role: m.role, content: m.content }
    })

    if (snapshot || (referenceImages && referenceImages.length > 0)) {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1]
      if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
        const content = []
        if (snapshot) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: snapshot },
          })
        }
        if (referenceImages && Array.isArray(referenceImages)) {
          for (const img of referenceImages) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType || 'image/png', data: img.data },
            })
          }
        }
        content.push({ type: 'text', text: lastMsg.content })
        anthropicMessages[anthropicMessages.length - 1] = { role: 'user', content }
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000)
    let response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 8192,
          system,
          messages: anthropicMessages,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
