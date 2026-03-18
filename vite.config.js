import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function serveLocalClipartManifests() {
  return {
    name: 'serve-local-clipart-manifests',
    configureServer(server) {
      server.middlewares.use('/clipart-manifests', async (req, res, next) => {
        try {
          const filePath = join(__dirname, 'scripts', 'clipart-manifests', decodeURIComponent(req.url.slice(1)))
          const content = await readFile(filePath)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(content)
        } catch {
          next()
        }
      })
    },
  }
}

const S3_BUCKET = process.env.VITE_S3_BUCKET || 'your-s3-bucket-name'
const S3_REGION = process.env.VITE_S3_REGION || 'us-east-1'

export default defineConfig({
  plugins: [react(), serveLocalClipartManifests()],
  server: {
    proxy: {
      '/s3-proxy': {
        target: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-proxy/, ''),
      },
    },
  },
})
