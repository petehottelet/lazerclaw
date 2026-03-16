import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { drawFrameToCanvas } from './motionMedia'

const FPS = 30
const DURATION_SECONDS = 5
const BITRATE = 10_000_000
const AUDIO_SAMPLE_RATE = 48000
const AUDIO_BITRATE = 128_000

export function hasAnimatedObjects(canvas) {
  if (!canvas) return false
  const check = (objs) => objs.some(obj =>
    obj._dtoolAnimated || (obj._objects && check(obj._objects))
  )
  return check(canvas.getObjects())
}

function waitForNextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

function ensureEven(n) {
  return n % 2 === 0 ? n : n + 1
}

async function fetchAudioBuffer(url, sampleRate) {
  const offlineCtx = new OfflineAudioContext(2, sampleRate * DURATION_SECONDS, sampleRate)
  const resp = await fetch(url)
  const arrayBuf = await resp.arrayBuffer()
  return await offlineCtx.decodeAudioData(arrayBuf)
}

async function mixAudioTracks(audioTracks, audioElementsRef) {
  if (!audioTracks || audioTracks.length === 0) return null

  const offlineCtx = new OfflineAudioContext(2, AUDIO_SAMPLE_RATE * DURATION_SECONDS, AUDIO_SAMPLE_RATE)

  for (const track of audioTracks) {
    try {
      const el = audioElementsRef.current?.[track.id]
      const url = track.url || el?.src
      if (!url) continue

      const buf = await fetchAudioBuffer(url, AUDIO_SAMPLE_RATE)
      const source = offlineCtx.createBufferSource()
      source.buffer = buf
      source.loop = true

      const gain = offlineCtx.createGain()
      gain.gain.value = track.volume ?? 1
      source.connect(gain)
      gain.connect(offlineCtx.destination)
      source.start(0)
    } catch (err) {
      console.warn('Failed to decode audio track:', track.name, err)
    }
  }

  try {
    return await offlineCtx.startRendering()
  } catch {
    return null
  }
}

function audioBufferToChunks(renderedBuffer, chunkDurationSec = 0.04) {
  const numChannels = renderedBuffer.numberOfChannels
  const sampleRate = renderedBuffer.sampleRate
  const totalSamples = renderedBuffer.length
  const samplesPerChunk = Math.floor(sampleRate * chunkDurationSec)
  const chunks = []

  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const remaining = Math.min(samplesPerChunk, totalSamples - offset)
    const data = new Float32Array(remaining * numChannels)

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = renderedBuffer.getChannelData(ch)
      for (let i = 0; i < remaining; i++) {
        data[ch * remaining + i] = channelData[offset + i]
      }
    }

    chunks.push({
      data,
      numberOfFrames: remaining,
      numberOfChannels: numChannels,
      sampleRate,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
    })
  }
  return chunks
}

export async function exportMp4(canvasState, onProgress) {
  const canvas = canvasState.canvasRef.current
  if (!canvas) throw new Error('No canvas')
  const CANVAS_W = canvasState.canvasW
  const CANVAS_H = canvasState.canvasH

  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Your browser does not support VideoEncoder (WebCodecs API). Please use Chrome 94+.')
  }

  const audioTracks = canvasState.audioTracks || []
  const audioElementsRef = canvasState.audioElementsRef
  const hasAudio = audioTracks.length > 0 && typeof AudioEncoder !== 'undefined'

  let renderedAudio = null
  if (hasAudio) {
    try {
      onProgress?.(0)
      renderedAudio = await mixAudioTracks(audioTracks, audioElementsRef)
    } catch (err) {
      console.warn('Audio mixing failed, exporting without audio:', err)
    }
  }

  const active = canvas.getActiveObject()
  if (active) canvas.discardActiveObject()

  const overlayVis = canvas.overlayImage?.visible
  if (canvas.overlayImage) canvas.overlayImage.visible = false

  const savedVpt = [...canvas.viewportTransform]
  const savedW = canvas.width
  const savedH = canvas.height

  const lowerCanvasEl = canvas.lowerCanvasEl || canvas.getElement()
  const snapshot = document.createElement('canvas')
  snapshot.width = lowerCanvasEl.width
  snapshot.height = lowerCanvasEl.height
  snapshot.getContext('2d').drawImage(lowerCanvasEl, 0, 0)
  const wrapper = lowerCanvasEl.parentElement
  snapshot.style.cssText = `position:absolute;top:0;left:0;width:${lowerCanvasEl.clientWidth}px;height:${lowerCanvasEl.clientHeight}px;z-index:50;pointer-events:none;`
  if (wrapper) {
    const prevPos = wrapper.style.position
    if (!prevPos || prevPos === 'static') wrapper.style.position = 'relative'
    wrapper.appendChild(snapshot)
    wrapper._dtoolPrevPos = prevPos
  }

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  canvas.setDimensions({ width: CANVAS_W, height: CANVAS_H })
  canvas._dtoolExporting = true

  const restoreCanvas = () => {
    canvas._dtoolExporting = false
    canvas.setViewportTransform(savedVpt)
    canvas.setDimensions({ width: savedW, height: savedH })
    if (canvas.overlayImage) canvas.overlayImage.visible = overlayVis
    if (active) canvas.setActiveObject(active)
    canvas.renderAll()
    if (snapshot.parentElement) snapshot.remove()
    if (wrapper && wrapper._dtoolPrevPos !== undefined) {
      wrapper.style.position = wrapper._dtoolPrevPos || ''
      delete wrapper._dtoolPrevPos
    }
  }

  try {
    const totalFrames = FPS * DURATION_SECONDS

    const encW = ensureEven(CANVAS_W)
    const encH = ensureEven(CANVAS_H)

    const muxerConfig = {
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: encW,
        height: encH,
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    }

    if (renderedAudio) {
      muxerConfig.audio = {
        codec: 'aac',
        numberOfChannels: renderedAudio.numberOfChannels,
        sampleRate: renderedAudio.sampleRate,
      }
    }

    const muxer = new Muxer(muxerConfig)

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('VideoEncoder error:', e),
    })

    const codecString = await pickCodec(encW, encH)

    videoEncoder.configure({
      codec: codecString,
      width: encW,
      height: encH,
      bitrate: BITRATE,
      framerate: FPS,
      latencyMode: 'quality',
      avc: { format: 'avc' },
    })

    let audioEncoder = null
    if (renderedAudio) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => console.error('AudioEncoder error:', e),
      })
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: renderedAudio.numberOfChannels,
        sampleRate: renderedAudio.sampleRate,
        bitrate: AUDIO_BITRATE,
      })
    }

    const offscreen = new OffscreenCanvas(encW, encH)
    const offCtx = offscreen.getContext('2d')
    offCtx.imageSmoothingEnabled = true
    offCtx.imageSmoothingQuality = 'high'

    const lowerCanvas = lowerCanvasEl

    const hasMotion = hasAnimatedObjects(canvas)

    for (let i = 0; i < totalFrames; i++) {
      await waitForNextFrame()

      if (hasMotion) {
        const tickObj = (obj, parent) => {
          if (obj._dtoolAnimated) {
            if (obj._dtoolMediaType === 'video') {
              const videoEl = obj._dtoolMediaElement
              const proxyCvs = obj._dtoolProxyCanvas
              if (videoEl && proxyCvs && videoEl.readyState >= 2) {
                const ctx = proxyCvs.getContext('2d')
                ctx.clearRect(0, 0, proxyCvs.width, proxyCvs.height)
                ctx.drawImage(videoEl, 0, 0)
              }
            } else if (obj._dtoolFrameAnimator) {
              const animator = obj._dtoolFrameAnimator
              animator.tick(performance.now())
              const proxyCvs = obj._dtoolProxyCanvas
              if (proxyCvs) {
                drawFrameToCanvas(proxyCvs, animator.getCurrentFrame())
              }
            }
            obj.dirty = true
            obj.set('dirty', true)
            if (parent) { parent.dirty = true; parent.set('dirty', true) }
          }
          if (obj._objects) obj._objects.forEach(child => tickObj(child, obj))
        }
        canvas.getObjects().forEach(obj => tickObj(obj, null))
      }

      canvas.renderAll()

      offCtx.clearRect(0, 0, encW, encH)
      const srcW = lowerCanvas.width
      const srcH = lowerCanvas.height
      offCtx.drawImage(lowerCanvas, 0, 0, srcW, srcH, 0, 0, encW, encH)

      const frame = new VideoFrame(offscreen, {
        timestamp: (i / FPS) * 1_000_000,
        duration: (1 / FPS) * 1_000_000,
      })

      const keyFrame = i % FPS === 0
      videoEncoder.encode(frame, { keyFrame })
      frame.close()

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalFrames) * 100))
      }

      if (videoEncoder.encodeQueueSize > 8) {
        await new Promise(r => setTimeout(r, 10))
      }
    }

    if (audioEncoder && renderedAudio) {
      const audioChunks = audioBufferToChunks(renderedAudio)
      for (const chunk of audioChunks) {
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: chunk.sampleRate,
          numberOfFrames: chunk.numberOfFrames,
          numberOfChannels: chunk.numberOfChannels,
          timestamp: chunk.timestamp,
          data: chunk.data,
        })
        audioEncoder.encode(audioData)
        audioData.close()

        if (audioEncoder.encodeQueueSize > 10) {
          await new Promise(r => setTimeout(r, 5))
        }
      }
      await audioEncoder.flush()
      audioEncoder.close()
    }

    await videoEncoder.flush()
    videoEncoder.close()
    muxer.finalize()

    restoreCanvas()

    const { buffer } = muxer.target
    const blob = new Blob([buffer], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'design.mp4'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    restoreCanvas()
    throw err
  }
}

async function pickCodec(width, height) {
  const candidates = [
    'avc1.640028',
    'avc1.4d0028',
    'avc1.42001f',
  ]
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: BITRATE,
        framerate: FPS,
      })
      if (support.supported) return codec
    } catch {}
  }
  return 'avc1.42001f'
}
