import JSZip from 'jszip'
import { saveAs } from 'file-saver'

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',')
  if (parts.length < 2) throw new Error('Invalid data URL format')
  const match = parts[0].match(/:(.*?);/)
  if (!match) throw new Error('Invalid data URL MIME format')
  const mime = match[1]
  const bstr = atob(parts[1])
  const arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) {
    arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([arr], { type: mime })
}

async function fetchAsBlob(url) {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.blob()
}

function fabricObjToSvg(obj) {
  const svg = obj.toSVG()
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(obj.width * (obj.scaleX || 1))}" height="${Math.ceil(obj.height * (obj.scaleY || 1))}" viewBox="0 0 ${obj.width} ${obj.height}">
${svg}
</svg>`
}

function getImageDataUrl(fabricImg) {
  const el = fabricImg._element || fabricImg.getElement?.()
  if (!el) return null
  try {
    const c = document.createElement('canvas')
    c.width = el.naturalWidth || el.width
    c.height = el.naturalHeight || el.height
    const ctx = c.getContext('2d')
    ctx.drawImage(el, 0, 0)
    const fmt = 'image/png'
    return c.toDataURL(fmt)
  } catch {
    return null
  }
}

export async function exportDesignZip(canvasState) {
  const zip = new JSZip()
  const assetsFolder = zip.folder('assets')

  const canvas = canvasState.canvasRef.current
  if (!canvas) throw new Error('No canvas')

  const objects = canvas.getObjects()
  const assetMap = new Map()
  let assetCounter = 0

  for (const obj of objects) {
    const id = obj._dtoolId || `obj_${assetCounter}`

    const lt = (obj.type || '').toLowerCase()
    if (lt === 'image') {
      const existingAsset = canvasState.assets.find(a => a.id === obj._dtoolAssetId)

      if (existingAsset && existingAsset.dataUrl) {
        const blob = dataUrlToBlob(existingAsset.dataUrl)
        const filename = existingAsset.filename || `image_${assetCounter}.png`
        assetsFolder.file(filename, blob)
        assetMap.set(id, filename)
        assetCounter++
      } else {
        const src = obj.getSrc?.() || ''
        if (src.startsWith('data:')) {
          const blob = dataUrlToBlob(src)
          const ext = src.includes('image/png') ? 'png' : src.includes('image/svg') ? 'svg' : 'jpg'
          const filename = `image_${assetCounter}.${ext}`
          assetsFolder.file(filename, blob)
          assetMap.set(id, filename)
          assetCounter++
        } else if (src) {
          try {
            const dataUrl = getImageDataUrl(obj)
            if (dataUrl) {
              const blob = dataUrlToBlob(dataUrl)
              let origName = src.split('/').pop().split('?')[0]
              if (!origName) origName = `image_${assetCounter}.png`
              assetsFolder.file(origName, blob)
              assetMap.set(id, origName)
              assetCounter++
            } else {
              const blob = await fetchAsBlob(src)
              let origName = src.split('/').pop().split('?')[0]
              if (!origName) origName = `image_${assetCounter}.png`
              assetsFolder.file(origName, blob)
              assetMap.set(id, origName)
              assetCounter++
            }
          } catch (err) {
            console.warn(`Could not fetch image asset: ${src}`, err)
          }
        }
      }
    } else if (lt === 'path' || lt === 'polygon' || lt === 'circle' ||
               lt === 'rect' || lt === 'ellipse' || lt === 'triangle') {
      try {
        const svgContent = fabricObjToSvg(obj)
        const filename = `shape_${assetCounter}.svg`
        assetsFolder.file(filename, svgContent)
        assetMap.set(id, filename)
        assetCounter++
      } catch (err) {
        console.warn(`Could not export shape:`, err)
      }
    }
  }

  const previewDataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 1,
    left: 0,
    top: 0,
    width: canvasState.canvasW,
    height: canvasState.canvasH,
  })
  assetsFolder.file('preview.png', dataUrlToBlob(previewDataUrl))

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'design-export.zip')
}
