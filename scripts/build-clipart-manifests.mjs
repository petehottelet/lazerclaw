import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, relative, extname } from 'path'

const CLIPART_ROOT = process.env.CLIPART_ROOT || './clipart'
const BUCKET = process.env.S3_BUCKET || 'your-s3-bucket-name'
const REGION = process.env.S3_REGION || 'us-east-1'
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const EXCLUDE_DIRS = new Set(['bad', 'edit'])
const LOCAL_MANIFEST_DIR = 'scripts/clipart-manifests'
const UPLOAD = process.argv.includes('--upload')

let s3
if (UPLOAD) {
  s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
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
    .filter(e => e.isDirectory())
    .map(e => e.name)

  if (subDirs.includes('good')) {
    const goodFiles = getImageFiles(join(folderPath, 'good'))
    const fixedPath = join(folderPath, 'fixed')
    try { goodFiles.push(...getImageFiles(fixedPath)) } catch (_) {}
    return goodFiles
  }

  return walkCurated(folderPath)
}

function prettifyLabel(name) {
  return name
    .replace(/^\d{8}_/, '')
    .replace(/^BANANAS-\d+_/, '')
    .replace(/^BANANAS-XX_/, '')
    .replace(/^pre-bananas_/, '')
    .replace(/^pete_/, '')
    .replace(/^bananas_\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

console.log(`Scanning curated clip art...${UPLOAD ? ' (will upload to S3)' : ' (local only, use --upload for S3)'}\n`)

if (!existsSync(LOCAL_MANIFEST_DIR)) mkdirSync(LOCAL_MANIFEST_DIR, { recursive: true })

const topDirs = readdirSync(CLIPART_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('-- '))
  .map(e => e.name)

const catMeta = []

for (const folder of topDirs) {
  const folderPath = join(CLIPART_ROOT, folder)
  const goodFiles = collectGoodFiles(folderPath)

  if (goodFiles.length === 0) {
    console.log(`  SKIP  ${folder} (0 good images)`)
    continue
  }

  const id = folder.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  const label = prettifyLabel(folder)

  const manifest = goodFiles.map(f => {
    return relative(folderPath, f).replace(/\\/g, '/')
  })

  catMeta.push({ id, label, folder, count: manifest.length })

  const body = JSON.stringify(manifest)
  const localPath = join(LOCAL_MANIFEST_DIR, `${id}.json`)
  writeFileSync(localPath, body)
  console.log(`  ${id}: ${manifest.length} files (${(body.length / 1024).toFixed(1)} KB)`)

  if (UPLOAD) {
    const key = `clipart/_manifests/${id}.json`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=3600',
    }))
    process.stdout.write(' [uploaded]')
  }
}

catMeta.sort((a, b) => a.label.localeCompare(b.label))

const totalCount = catMeta.reduce((s, c) => s + c.count, 0)
console.log(`\n=== SUMMARY ===`)
console.log(`Categories: ${catMeta.length}`)
console.log(`Good images: ${totalCount.toLocaleString()}`)

const metaOutput = 'src/data/clipartCategories.js'
const metaContent = `export const CLIPART_CATEGORIES = ${JSON.stringify(catMeta, null, 2)}\n`
writeFileSync(metaOutput, metaContent)
console.log(`Wrote ${metaOutput}`)

if (!UPLOAD) {
  console.log(`\nManifests saved locally to ${LOCAL_MANIFEST_DIR}/`)
  console.log('Run with --upload flag to push manifests to S3')
}

console.log('Done!')
