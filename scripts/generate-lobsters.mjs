/**
 * Generate 25 "stock image" style photos of heavy metal lobsters
 * using the Nano Banana API (nanobananaapi.dev).
 *
 * Usage:
 *   NANO_BANANA_API_KEY=your_key node scripts/generate-lobsters.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'lobsters')

const API_URL = 'https://api.nanobananaapi.dev/v1/images/generate'
const API_KEY = process.env.NANO_BANANA_API_KEY

if (!API_KEY) {
  console.error('Error: NANO_BANANA_API_KEY environment variable is required.')
  console.error('Usage: NANO_BANANA_API_KEY=your_key node scripts/generate-lobsters.mjs')
  process.exit(1)
}

const PROMPTS = [
  { file: 'lobster_01.png', prompt: 'A photorealistic heavy metal lobster wearing a tiny suit sitting at the head of a corporate board meeting table, presenting a PowerPoint slide, stock photo style, professional lighting, 4k' },
  { file: 'lobster_02.png', prompt: 'A photorealistic heavy metal lobster with long hair headbanging while shredding an electric guitar on stage, pyrotechnics in background, concert photography style, 4k' },
  { file: 'lobster_03.png', prompt: 'A photorealistic heavy metal lobster wearing a leather jacket riding a Harley Davidson motorcycle down a desert highway, dramatic sunset, stock photo style, 4k' },
  { file: 'lobster_04.png', prompt: 'A photorealistic heavy metal lobster sitting nervously in a dentist chair with a tiny bib, a dentist examining its teeth, fluorescent lighting, stock photo humor style, 4k' },
  { file: 'lobster_05.png', prompt: 'A photorealistic heavy metal lobster with reading glasses sitting at a desk surrounded by tax forms and receipts, looking stressed, home office stock photo style, 4k' },
  { file: 'lobster_06.png', prompt: 'A photorealistic heavy metal lobster crowd surfing in a chaotic mosh pit at a metal concert, stage lights, concert photography, 4k' },
  { file: 'lobster_07.png', prompt: 'A photorealistic heavy metal lobster with a sweatband doing deadlifts at a gym, straining hard, motivational fitness stock photo style, 4k' },
  { file: 'lobster_08.png', prompt: 'Two photorealistic heavy metal lobsters in wedding attire posing for a wedding photo in a garden, one in a veil, romantic stock photo style, 4k' },
  { file: 'lobster_09.png', prompt: 'A photorealistic heavy metal lobster lead singer screaming into a microphone on a massive festival stage with thousands of fans, dramatic stage lighting, concert photography, 4k' },
  { file: 'lobster_10.png', prompt: 'A photorealistic heavy metal lobster looking bored and annoyed waiting in line at the DMV, holding a number ticket, fluorescent overhead lights, mundane stock photo style, 4k' },
  { file: 'lobster_11.png', prompt: 'A photorealistic heavy metal lobster in a recording studio wearing headphones, adjusting knobs on a mixing console, professional music production stock photo, 4k' },
  { file: 'lobster_12.png', prompt: 'A photorealistic heavy metal lobster pushing a shopping cart through a grocery store aisle, comparing two products, everyday life stock photo style, 4k' },
  { file: 'lobster_13.png', prompt: 'A photorealistic heavy metal lobster being carried by the crowd while crowd surfing at a packed metal show, arms raised, action concert photography, 4k' },
  { file: 'lobster_14.png', prompt: 'A photorealistic heavy metal lobster wearing a chef hat hosting a cooking show, presenting a gourmet dish, TV studio lighting, food show stock photo, 4k' },
  { file: 'lobster_15.png', prompt: 'A photorealistic heavy metal lobster with long flowing hair headbanging violently, hair whipping in a circle, dramatic backlit stage photography, 4k' },
  { file: 'lobster_16.png', prompt: 'A photorealistic heavy metal lobster in a suit nervously sitting across from a hiring manager at a job interview, corporate office stock photo, 4k' },
  { file: 'lobster_17.png', prompt: 'A photorealistic heavy metal lobster band performing on a small bar stage during battle of the bands, energetic crowd, live music photography, 4k' },
  { file: 'lobster_18.png', prompt: 'A photorealistic heavy metal lobster sitting alone in a laundromat reading a magazine while waiting for laundry, mundane everyday stock photo, 4k' },
  { file: 'lobster_19.png', prompt: 'A photorealistic heavy metal lobster doing an epic drum solo behind a massive drum kit with double bass drums, sweat flying, concert photography, 4k' },
  { file: 'lobster_20.png', prompt: 'A photorealistic heavy metal lobster stuck in traffic in a convertible, looking frustrated, urban traffic jam stock photo style, 4k' },
  { file: 'lobster_21.png', prompt: 'A photorealistic heavy metal lobster band posing dramatically for their album cover in an abandoned warehouse, moody dramatic lighting, music promo photo, 4k' },
  { file: 'lobster_22.png', prompt: 'A photorealistic heavy metal lobster walking a small dog in a suburban park on a sunny day, casual lifestyle stock photo, 4k' },
  { file: 'lobster_23.png', prompt: 'A photorealistic heavy metal lobster doing a stage dive off a concert stage into a crowd of outstretched hands, dramatic action shot, concert photography, 4k' },
  { file: 'lobster_24.png', prompt: 'A photorealistic heavy metal lobster in yoga pants doing a warrior pose in a yoga class surrounded by other lobsters, wellness stock photo style, 4k' },
  { file: 'lobster_25.png', prompt: 'A photorealistic heavy metal lobster in full battle armor riding a fire-breathing dragon through a stormy sky, epic fantasy photography style, 4k' },
]

async function generateImage(prompt, filename) {
  console.log(`  Generating: ${filename}...`)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      num: 1,
      model: 'gemini-2.5-flash-image',
      image_size: '1:1',
    }),
  })

  const result = await res.json()

  if (result.code !== 0) {
    throw new Error(`API error for ${filename}: ${result.message}`)
  }

  const imageUrl = Array.isArray(result.data.url) ? result.data.url[0] : result.data.url
  console.log(`  Downloading: ${imageUrl}`)

  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`)

  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const outPath = path.join(OUT_DIR, filename)
  fs.writeFileSync(outPath, buffer)
  console.log(`  Saved: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`)
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  console.log(`Generating ${PROMPTS.length} lobster images...\n`)

  let success = 0
  let failed = 0

  for (const { file, prompt } of PROMPTS) {
    const outPath = path.join(OUT_DIR, file)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      console.log(`  Skipping ${file} (already exists)`)
      success++
      continue
    }

    try {
      await generateImage(prompt, file)
      success++
      await new Promise(r => setTimeout(r, 1500))
    } catch (err) {
      console.error(`  FAILED: ${file} - ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone! ${success} succeeded, ${failed} failed.`)
}

main()
