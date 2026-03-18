import { readdirSync, writeFileSync, statSync, existsSync } from 'fs'
import { join, relative, extname, basename } from 'path'

const CLIPART_ROOT = 'G:\\~01_Selects\\ClipArt'
const OUTPUT = 'scripts/curated-clipart-manifest.json'
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

const EXCLUDE_FOLDERS = new Set(['bad', 'edit', '-- 20250708_BANANAS-37_flux_watercolor_vibrant'])

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
    if (EXCLUDE_FOLDERS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkCurated(full))
    } else if (entry.isFile() && IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      results.push(full)
    }
  }
  return results
}

console.log('Scanning ClipArt folders...\n')

const topDirs = readdirSync(CLIPART_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.') && !EXCLUDE_FOLDERS.has(e.name))
  .map(e => e.name)

const report = { categories: [], summary: { totalGood: 0, totalSkipped: 0, totalCategories: 0 } }

for (const folder of topDirs) {
  const folderPath = join(CLIPART_ROOT, folder)
  const subDirs = readdirSync(folderPath, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)

  const hasGoodBad = subDirs.includes('good') && subDirs.includes('bad')
  const hasGoodOnly = subDirs.includes('good') && !subDirs.includes('bad')
  const hasFixed = subDirs.includes('fixed')

  let goodFiles = []
  let strategy = ''

  if (hasGoodBad || hasGoodOnly) {
    strategy = 'good-subfolder'
    goodFiles = getImageFiles(join(folderPath, 'good'))
    if (hasFixed) {
      goodFiles.push(...getImageFiles(join(folderPath, 'fixed')))
    }
  } else {
    strategy = 'all-curated'
    goodFiles = walkCurated(folderPath)
  }

  if (goodFiles.length === 0) {
    console.log(`  SKIP  ${folder} (0 good images)`)
    continue
  }

  const allFiles = walkCurated(folderPath)
  const skipped = allFiles.length - goodFiles.length

  const filenames = goodFiles.map(f => basename(f))
  const relativePaths = goodFiles.map(f => relative(CLIPART_ROOT, f).replace(/\\/g, '/'))

  report.categories.push({
    folder,
    strategy,
    goodCount: goodFiles.length,
    skippedCount: hasGoodBad ? skipped : 0,
    files: relativePaths,
  })

  report.summary.totalGood += goodFiles.length
  report.summary.totalSkipped += hasGoodBad ? skipped : 0
  report.summary.totalCategories++

  const marker = hasGoodBad ? '✓ CURATED' : '  ALL'
  console.log(`  ${marker}  ${folder}: ${goodFiles.length} good${hasGoodBad ? ` (${skipped} rejected)` : ''}`)
}

console.log(`\n=== SUMMARY ===`)
console.log(`Categories: ${report.summary.totalCategories}`)
console.log(`Good images: ${report.summary.totalGood.toLocaleString()}`)
console.log(`Skipped (bad/edit): ${report.summary.totalSkipped.toLocaleString()}`)
console.log(`Reduction: ${((report.summary.totalSkipped / (report.summary.totalGood + report.summary.totalSkipped)) * 100).toFixed(1)}% removed\n`)

writeFileSync(OUTPUT, JSON.stringify(report, null, 2))
console.log(`Wrote curated manifest to ${OUTPUT}`)
console.log(`(${(statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`)
