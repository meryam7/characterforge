import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// index.html uses %VITE_SITE_URL% for social-preview tags; default it so builds never break.
process.env.VITE_SITE_URL ||= 'http://localhost:5173'

// In dev, /api is forwarded to `npm run dev` at the repo root (wrangler pages dev on :8788).
export default defineConfig({
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
})
