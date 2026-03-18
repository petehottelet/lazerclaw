import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, relative, extname } from 'path'

const BUCKET = process.env.S3_BUCKET || 'your-s3-bucket-name'
const REGION = process.env.S3_REGION || 'us-east-1'
const CONCURRENCY = 20
const CLIPART_ROOT = process.env.CLIPART_ROOT || './clipart'
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const EXCLUDE_DIRS = new Set(['bad', 'edit'])

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.csv': 'text/csv',
}

function walkDir(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.name.startsWith('.')) continue
    if (entry.name.endsWith('.lnk')) continue
    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else if (entry.isFile()) {
      results.push(full)
    }
  }
  return results
}

function getImageFiles(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.endsWith('.lnk')) continue
      const full = join(dir, entry.name)
      if (entry.isFile() && IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
        results.push(full)
      }
    }
  } catch (_) {}
  return results
}

function walkCurated(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.lnk')) continue
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkCurated(full))
    } else if (entry.isFile() && IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      results.push(full)
    }
  }
  return results
}

function collectGoodFiles(folderPath) {
  const subDirs = readdirSync(folderPath, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name)
  if (subDirs.includes('good')) {
    const goodFiles = getImageFiles(join(folderPath, 'good'))
    try { goodFiles.push(...getImageFiles(join(folderPath, 'fixed'))) } catch (_) {}
    return goodFiles
  }
  return walkCurated(folderPath)
}

function collectCuratedClipart() {
  const topDirs = readdirSync(CLIPART_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('-- '))
    .map(e => e.name)

  const files = []
  for (const folder of topDirs) {
    const folderPath = join(CLIPART_ROOT, folder)
    const good = collectGoodFiles(folderPath)
    for (const f of good) {
      const rel = relative(CLIPART_ROOT, f).replace(/\\/g, '/')
      files.push({ local: f, s3Key: `clipart/${rel}` })
    }
  }
  return files
}

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch { return false }
}

async function uploadFile(localPath, s3Key) {
  const ext = extname(localPath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'
  const body = readFileSync(localPath)

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }))
}

async function uploadDir(localDir, s3Prefix, { skipExisting = true } = {}) {
  const files = walkDir(localDir)
  console.log(`Found ${files.length} files in ${localDir}`)

  let uploaded = 0, skipped = 0, errors = 0
  const queue = [...files]

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift()
      const rel = relative(localDir, file).replace(/\\/g, '/')
      const key = s3Prefix ? `${s3Prefix}/${rel}` : rel

      try {
        if (skipExisting && await exists(key)) {
          skipped++
          process.stdout.write(`\r  Uploaded: ${uploaded} | Skipped: ${skipped} | Errors: ${errors} | Remaining: ${queue.length}`)
          continue
        }
        await uploadFile(file, key)
        uploaded++
        process.stdout.write(`\r  Uploaded: ${uploaded} | Skipped: ${skipped} | Errors: ${errors} | Remaining: ${queue.length}`)
      } catch (e) {
        errors++
        console.error(`\n  Error uploading ${key}: ${e.message}`)
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)
  console.log(`\n  Done: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`)
}

async function uploadFileList(fileList, { skipExisting = true } = {}) {
  console.log(`Found ${fileList.length} curated files`)

  let uploaded = 0, skipped = 0, errors = 0
  const queue = [...fileList]

  async function worker() {
    while (queue.length > 0) {
      const { local, s3Key } = queue.shift()
      try {
        if (skipExisting && await exists(s3Key)) {
          skipped++
          process.stdout.write(`\r  Uploaded: ${uploaded} | Skipped: ${skipped} | Errors: ${errors} | Remaining: ${queue.length}`)
          continue
        }
        await uploadFile(local, s3Key)
        uploaded++
        process.stdout.write(`\r  Uploaded: ${uploaded} | Skipped: ${skipped} | Errors: ${errors} | Remaining: ${queue.length}`)
      } catch (e) {
        errors++
        console.error(`\n  Error uploading ${s3Key}: ${e.message}`)
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker())
  await Promise.all(workers)
  console.log(`\n  Done: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`)
}

const mode = process.argv[2]

const ASSETS_ROOT = process.env.ASSETS_ROOT || './assets'

if (mode === 'motion') {
  console.log('=== Uploading motion content ===')
  await uploadDir(join(ASSETS_ROOT, 'motion'), 'motion')
} else if (mode === 'audio') {
  console.log('=== Uploading original audio (high quality) ===')
  await uploadDir(join(ASSETS_ROOT, 'audio'), 'audio')
} else if (mode === 'clipart') {
  console.log('=== Uploading curated clip art (good images only) ===')
  const files = collectCuratedClipart()
  await uploadFileList(files)
} else if (mode === 'artworks') {
  console.log('=== Uploading artworks ===')
  await uploadDir(join(ASSETS_ROOT, 'artworks'), 'artworks')
} else if (mode === 'patterns') {
  console.log('=== Uploading patterns ===')
  await uploadDir(join(ASSETS_ROOT, 'patterns'), 'patterns')
} else {
  console.log('Usage: node scripts/upload-s3.mjs <motion|audio|clipart|artworks|patterns>')
  console.log('Environment variables: S3_BUCKET, S3_REGION, ASSETS_ROOT, CLIPART_ROOT')
  process.exit(1)
}
