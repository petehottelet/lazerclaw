import { put, list } from '@vercel/blob'

export const config = { maxDuration: 60 }

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.5-flash-image'
const BLOB_PREFIX = 'generated-lobsters/'

const LOBSTER_SCENARIOS = [
  'riding a flaming motorcycle through a volcano',
  'conducting a symphony orchestra of crabs',
  'winning a championship wrestling match against a bear',
  'DJing at an underground rave in the ocean',
  'piloting a giant mech suit into battle',
  'performing surgery on a shark',
  'competing in a hot dog eating contest',
  'teaching karate to baby seahorses',
  'robbing a bank with a tiny water gun',
  'accepting an Oscar on stage',
  'fighting a dragon with a butter knife',
  'running for president at a rally',
  'breakdancing at a wedding reception',
  'skydiving without a parachute into a ball pit',
  'arm wrestling an octopus at a bar',
  'delivering pizza on a skateboard in a thunderstorm',
  'refereeing a boxing match between two crabs',
  'painting a self-portrait in an art gallery',
  'driving a monster truck over a row of cars',
  'competing in the Olympics as a pole vaulter',
  'operating a food truck selling lobster rolls',
  'leading a biker gang through the desert',
  'performing stand-up comedy at a packed club',
  'playing poker with a table of suspicious fish',
  'surfing a tidal wave while playing guitar',
  'training for a Rocky-style boxing montage',
  'hosting a cooking competition reality show',
  'excavating dinosaur bones in a desert',
  'working as a bouncer at an exclusive nightclub',
  'streaking across a baseball field',
]

function pickScenario() {
  return LOBSTER_SCENARIOS[Math.floor(Math.random() * LOBSTER_SCENARIOS.length)]
}

async function generateLobsterImage(apiKey) {
  const scenario = pickScenario()
  const prompt = `A photorealistic heavy metal lobster ${scenario}. The lobster should look like a real lobster but in this absurd situation. Heavy metal aesthetic — dramatic lighting, maybe some flames or lightning, intense atmosphere. Cinematic composition, high detail. Square format.`

  const url = `${GEMINI_BASE}/${MODEL}:generateContent`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '1:1' },
    },
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
    console.error('Gemini error:', response.status, errText.slice(0, 500))
    throw new Error(`Gemini API ${response.status}`)
  }

  const data = await response.json()
  const parts = data?.candidates?.[0]?.content?.parts || []

  let imageData = null
  let mimeType = 'image/jpeg'
  for (const part of parts) {
    if (part.inlineData?.data) {
      imageData = part.inlineData.data
      mimeType = part.inlineData.mimeType || 'image/jpeg'
      break
    }
  }

  if (!imageData) throw new Error('No image generated')

  const title = `Lobster ${scenario.charAt(0).toUpperCase() + scenario.slice(1)}`
  return { imageData, mimeType, title, scenario }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured', lobsters: [] })
      }
      const result = await list({ prefix: BLOB_PREFIX })
      const lobsters = result.blobs
        .filter(b => b.size > 0)
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .map(b => {
          const name = b.pathname.replace(BLOB_PREFIX, '').replace(/^\d+_/, '').replace(/\.\w+$/, '').replace(/_/g, ' ')
          return { url: b.url, title: name, uploadedAt: b.uploadedAt }
        })
      return res.status(200).json({ lobsters })
    } catch (err) {
      console.error('List lobsters error:', err?.message, err?.stack)
      return res.status(500).json({ error: `List failed: ${err?.message}`, lobsters: [] })
    }
  }

  if (req.method === 'POST') {
    const apiKey = process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' })
    }

    try {
      const { imageData, mimeType, title } = await generateLobsterImage(apiKey)
      const ext = mimeType.includes('png') ? 'png' : 'jpg'
      const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').slice(0, 80)
      const filename = `${BLOB_PREFIX}${Date.now()}_${safeName}.${ext}`

      const buffer = Buffer.from(imageData, 'base64')
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: mimeType,
      })

      return res.status(200).json({
        url: blob.url,
        title,
        uploadedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Generate lobster error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
