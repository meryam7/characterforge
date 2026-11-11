import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// In dev, /api is forwarded to `npm run dev` at the repo root (wrangler pages dev on :8788).
// index.html uses %VITE_SITE_URL% (from .env.production / .env.staging) for social-preview tags.
export default defineConfig(({ mode }) => {
  process.env.VITE_SITE_URL ||= loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || 'http://localhost:5173'
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        // API not running -> clear JSON message instead of a bare "Internal Server Error"
        configure: (proxy) =>
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ detail: 'The local API server is not running. Start everything with: npm run dev' }))
            }
          }),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], konva: ['konva', 'react-konva', 'use-image'] },
      },
    },
  },
  }
})
