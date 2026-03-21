const GALLERY_KEY = 'lazerclaw_image_gallery'
const MAX_IMAGES = 200

export function getGalleryImages() {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]')
  } catch { return [] }
}

export function saveToGallery({ url, prompt, source }) {
  if (!url) return
  try {
    const gallery = getGalleryImages()
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url,
      prompt: prompt || '',
      source: source || 'unknown',
      createdAt: Date.now(),
    }
    gallery.unshift(entry)
    if (gallery.length > MAX_IMAGES) gallery.length = MAX_IMAGES
    localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery))
    window.dispatchEvent(new CustomEvent('gallery-updated'))
    return entry
  } catch (e) {
    console.warn('Failed to save image to gallery:', e)
  }
}

export function removeFromGallery(id) {
  try {
    const gallery = getGalleryImages().filter(img => img.id !== id)
    localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery))
    window.dispatchEvent(new CustomEvent('gallery-updated'))
  } catch {}
}

export function clearGallery() {
  localStorage.removeItem(GALLERY_KEY)
  window.dispatchEvent(new CustomEvent('gallery-updated'))
}
