const METAL_ENHANCERS = [
  // Classic metal vibes
  'with dramatic lightning bolts crackling across a blood-red sky',
  'with chrome skulls reflecting neon purple light in a hall of mirrors',
  'with a wall of Marshall amplifier stacks stretching into infinity behind everything',
  'emerging from a volcanic eruption of molten chrome and liquid fire',
  'with 80s hair metal concert pyrotechnics exploding in the background',

  // Weird and surreal
  'riding a flaming motorcycle through a cathedral made of electric guitars',
  'surrounded by levitating chrome lobsters shooting lasers from their eyes',
  'inside a giant pinball machine made of bones and neon tubing',
  'reflected in the chrome hubcap of a monster truck parked on the moon',
  'tattooed on the bicep of a giant robot arm reaching out of the ocean',
  'projected onto storm clouds by a lighthouse made of stacked Marshall amps',
  'growing out of a crack in a vinyl record the size of a continent',
  'printed on the sail of a Viking longship crewed by skeleton musicians',
  'displayed on a jumbotron at a sold-out arena where the audience is all crabs',
  'carved into the side of a mountain by a laser beam from a flying V guitar',

  // Cosmic and apocalyptic
  'with a black hole swirling behind it made of purple fire and chrome debris',
  'floating in the void of space surrounded by asteroid fragments shaped like pentagrams',
  'silhouetted against a supernova explosion with twin suns and a rings of fire',
  'on an altar in a ruined temple with columns made of twisted iron and chain',
  'at the epicenter of a nuclear blast frozen in time with a mushroom cloud of sparks',

  // Creatures and characters
  'being carried by a flock of ravens made of liquid mercury',
  'guarded by a three-headed hydra wearing spiked leather armor',
  'with a spectral wolf howling on a cliff edge wreathed in blue lightning',
  'held aloft by skeletal hands bursting through cracked earth',
  'observed by a cybernetic kraken rising from an ocean of blood',
  'surrounded by demon butterflies with stained-glass wings on fire',

  // Textures and materials
  'rendered in hammered black iron with rivets and chains',
  'made of dripping candle wax, rusted iron, and shattered stained glass',
  'with surfaces of polished obsidian reflecting hellfire',
  'wrapped in barbed wire with roses growing through the thorns',
  'encrusted with gemstones that glow from within like trapped souls',
  'built from the wreckage of a thousand guitars welded into new forms',

  // Atmospheric
  'in a fog-choked graveyard lit only by a single flickering amp tube',
  'backstage at the greatest concert never played, smoke machines going full blast',
  'during a thunderstorm where every lightning bolt is shaped like a guitar solo',
  'in a neon-drenched alley where the puddles reflect a different dimension',
  'at the bottom of the Mariana Trench lit by bioluminescent heavy metal coral',
  'inside a snow globe filled with ash and tiny floating chrome pentagrams',

  // Absurd and chaotic
  'wearing a tiny leather jacket and sunglasses regardless of what it is',
  'with an inexplicable flaming bowling ball rolling through the scene',
  'photobombed by a headbanging lobster playing a double-neck bass',
  'with the entire scene reflected in a single drop of White Russian',
  'where gravity has reversed and everything falls upward into a vortex of sparks',
  'but everything casts a shadow shaped like a different heavy metal band logo',
  'with a mosh pit happening in the background even if the scene makes no sense',
  'and somewhere in the image there is a tiny door leading to another dimension',
]

function addMetalFlair(prompt) {
  const primary = METAL_ENHANCERS[Math.floor(Math.random() * METAL_ENHANCERS.length)]
  if (Math.random() < 0.4) {
    let secondary
    do { secondary = METAL_ENHANCERS[Math.floor(Math.random() * METAL_ENHANCERS.length)] } while (secondary === primary)
    return `${prompt}, ${primary}, also ${secondary}`
  }
  return `${prompt}, ${primary}`
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
