import { readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative, extname, basename, dirname } from 'path'

const CLIPART_ROOT = 'G:\\~01_Selects\\ClipArt'
const OUTPUT = 'src/data/clipartIndex.json'

function walkDir(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (entry.name.endsWith('.lnk')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else if (entry.isFile() && ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extname(entry.name).toLowerCase())) {
      results.push(full)
    }
  }
  return results
}

console.log('Scanning clip art directory...')
const allFiles = walkDir(CLIPART_ROOT)
console.log(`Found ${allFiles.length} image files`)

const categories = {}

for (const file of allFiles) {
  const rel = relative(CLIPART_ROOT, file).replace(/\\/g, '/')
  const parts = rel.split('/')
  const catName = parts.length > 1 ? parts[0] : 'Uncategorized'

  if (!categories[catName]) {
    categories[catName] = {
      id: catName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
      label: catName
        .replace(/^\d{8}_/, '')
        .replace(/^BANANAS-\d+_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()),
      files: [],
    }
  }

  categories[catName].files.push(rel)
}

const cats = Object.values(categories).sort((a, b) => a.label.localeCompare(b.label))
const totalFiles = cats.reduce((s, c) => s + c.files.length, 0)

console.log(`${Object.keys(categories).length} categories, ${totalFiles} total files`)

writeFileSync(OUTPUT, JSON.stringify(cats))
console.log(`Wrote index to ${OUTPUT} (${(statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`)
