import { parseGIF, decompressFrames } from 'gifuct-js'

/**
 * Decodes a GIF into composited frames using gifuct-js.
 * Each frame is fully composited (handles disposal methods properly).
 */
export async function decodeGif(arrayBuffer) {
  const gif = parseGIF(arrayBuffer)
  const rawFrames = decompressFrames(gif, true)

  if (!rawFrames.length) throw new Error('No frames in GIF')

  const width = gif.lsd.width
  const height = gif.lsd.height

  const compositeCvs = document.createElement('canvas')
  compositeCvs.width = width
  compositeCvs.height = height
  const compositeCtx = compositeCvs.getContext('2d')

  const tempCvs = document.createElement('canvas')
  const tempCtx = tempCvs.getContext('2d')

  const frames = []
  const durations = []

  for (const frame of rawFrames) {
    const { dims, patch, delay, disposalType } = frame

    tempCvs.width = dims.width
    tempCvs.height = dims.height
    const imageData = tempCtx.createImageData(dims.width, dims.height)
    imageData.data.set(patch)
    tempCtx.putImageData(imageData, 0, 0)

    compositeCtx.drawImage(tempCvs, dims.left, dims.top)

    const bmp = await createImageBitmap(compositeCvs)
    frames.push(bmp)
    durations.push(delay <= 0 ? 100 : delay * 10)

    if (disposalType === 2) {
      compositeCtx.clearRect(dims.left, dims.top, dims.width, dims.height)
    } else if (disposalType === 3) {
      compositeCtx.clearRect(0, 0, width, height)
    }
  }

  return { frames, durations, width, height }
}

/**
 * Decodes animated WebP/APNG using ImageDecoder API.
 * Falls back to single-frame if ImageDecoder is unavailable.
 */
export async function decodeAnimatedWebP(blob) {
  if (typeof ImageDecoder !== 'undefined') {
    try {
      const decoder = new ImageDecoder({
        data: blob.stream(),
        type: blob.type || 'image/webp',
      })
      await decoder.completed

      const track = decoder.tracks.selectedTrack
      const frameCount = track.frameCount
      const frames = []
      const durations = []

      for (let i = 0; i < frameCount; i++) {
        const result = await decoder.decode({ frameIndex: i })
        const vf = result.image
        const bmp = await createImageBitmap(vf)
        frames.push(bmp)
        durations.push(Math.max(10, (vf.duration || 100000) / 1000))
        vf.close()
      }

      const width = frames[0]?.width || 1
      const height = frames[0]?.height || 1
      decoder.close()
      return { frames, durations, width, height }
    } catch (e) {
      console.warn('ImageDecoder failed, falling back:', e)
    }
  }

  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
  const bmp = await createImageBitmap(img)
  URL.revokeObjectURL(url)
  return { frames: [bmp], durations: [100], width: bmp.width, height: bmp.height }
}

/**
 * Creates a proxy canvas for fabric.js to render from.
 */
export function createFrameCanvas(width, height) {
  const cvs = document.createElement('canvas')
  cvs.width = width
  cvs.height = height
  return cvs
}

/**
 * Draws a frame (ImageBitmap) to a proxy canvas, fully clearing first.
 */
export function drawFrameToCanvas(cvs, frame) {
  const ctx = cvs.getContext('2d')
  ctx.clearRect(0, 0, cvs.width, cvs.height)
  ctx.drawImage(frame, 0, 0)
}

/**
 * Animation controller that tracks which frame to show and when to advance.
 */
export class FrameAnimator {
  constructor(frames, durations) {
    this.frames = frames
    this.durations = durations
    this.currentFrame = 0
    this.elapsed = 0
    this.lastTimestamp = 0
  }

  tick(timestamp) {
    if (this.frames.length <= 1) return false

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp
      return true
    }

    const dt = timestamp - this.lastTimestamp
    this.lastTimestamp = timestamp
    this.elapsed += dt

    const frameDuration = this.durations[this.currentFrame] || 100
    let changed = false
    while (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
      changed = true
    }
    return changed
  }

  getCurrentFrame() {
    return this.frames[this.currentFrame]
  }

  reset() {
    this.currentFrame = 0
    this.elapsed = 0
    this.lastTimestamp = 0
  }

  getTotalDuration() {
    return this.durations.reduce((s, d) => s + d, 0)
  }

  seekTo(timeS) {
    const totalMs = this.getTotalDuration()
    if (totalMs <= 0) return
    let tMs = (timeS * 1000) % totalMs
    if (tMs < 0) tMs += totalMs
    let acc = 0
    for (let i = 0; i < this.frames.length; i++) {
      const d = this.durations[i] || 100
      if (acc + d > tMs) {
        this.currentFrame = i
        this.elapsed = tMs - acc
        this.lastTimestamp = 0
        return
      }
      acc += d
    }
    this.currentFrame = this.frames.length - 1
    this.elapsed = 0
    this.lastTimestamp = 0
  }
}

/**
 * Prepares a video element, resolving only when it can render frames.
 * Starts playback silently to ensure first frame is decoded.
 */
export function prepareVideoElement(blobUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.src = blobUrl

    let resolved = false
    const onReady = () => {
      if (resolved) return
      resolved = true
      video.pause()
      video.currentTime = 0
      resolve(video)
    }

    video.addEventListener('canplaythrough', onReady)
    video.addEventListener('loadeddata', () => {
      if (video.readyState >= 2) onReady()
    })
    video.addEventListener('playing', () => {
      if (video.readyState >= 2) onReady()
    })
    video.addEventListener('error', () => {
      if (!resolved) {
        resolved = true
        reject(new Error('Video load failed: ' + (video.error?.message || 'unknown')))
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (video.readyState >= 1) resolve(video)
        else reject(new Error('Video load timeout'))
      }
    }, 10000)

    video.load()
    video.play().catch(() => {})
  })
}
