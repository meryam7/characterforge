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
    proxy: { '/api': 'http://localhost:8788' },
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
