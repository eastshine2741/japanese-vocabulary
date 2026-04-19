import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const EVAL_BASE = 'src/experiments/prompt-eval'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'prompt-eval-fs',
      configureServer(server) {
        server.middlewares.use('/api/prompt-eval/save-result', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end()
            return
          }
          let body = ''
          req.on('data', (chunk: string) => (body += chunk))
          req.on('end', () => {
            try {
              const { mode, filename, data } = JSON.parse(body)
              const dir = path.resolve(server.config.root, EVAL_BASE, mode, 'output')
              fs.mkdirSync(dir, { recursive: true })
              const filePath = path.join(dir, filename)
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, path: `${mode}/output/${filename}` }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(e) }))
            }
          })
        })
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
