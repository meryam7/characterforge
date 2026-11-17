import react from '@vitejs/plugin-react'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const API_PORT = 8788
const apiUp = () =>
  new Promise<boolean>((resolve) => {
    const sock = net.connect(API_PORT, '127.0.0.1')
    sock.once('connect', () => { sock.destroy(); resolve(true) })
    sock.once('error', () => resolve(false))
  })

const STAGING = 'https://staging.characterforge-3u3.pages.dev'
const ROOT = path.resolve(__dirname, '..')
/** Windows Smart App Control / Device Guard can block workerd.exe (the local Cloudflare runtime). */
const workerdRuns = () => {
  if (process.platform !== 'win32') return true
  const exe = path.join(ROOT, 'node_modules', '@cloudflare', 'workerd-windows-64', 'bin', 'workerd.exe')
  const r = spawnSync(exe, ['--version'], { timeout: 15000 })
  return !r.error && r.status === 0
}
/** Where /api goes in dev: the local API, or the staging API when the local runtime can't run on this PC. */
async function pickApi(command: string): Promise<'local' | 'staging'> {
  if (command !== 'serve' || process.env.CHARAFORGE_API === 'local' || (await apiUp())) return 'local'
  if (process.env.CHARAFORGE_API === 'staging' || !workerdRuns()) {
    console.warn(`
  Local API engine (workerd.exe) is blocked on this PC (Windows Smart App Control).
  /api now goes to the STAGING server: ${STAGING}
  (staging accounts and data, real emails, real AI).
`)
    return 'staging'
  }
  return 'local'
}

/** Dev only: if the API (wrangler on :8788) isn't running, start it (scripts/dev.mjs --api-only), so starting just the
 * website never ends in "API not running" errors. Stopped together with Vite. */
function autoApi(): Plugin {
  return {
    name: 'charaforge-auto-api',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.CHARAFORGE_NO_AUTO_API || (await apiUp())) return
      const root = ROOT
      const child = spawn(process.execPath, [path.join(root, 'scripts', 'dev.mjs'), '--api-only'], { cwd: root, stdio: 'inherit' })
      const stop = () => { if (child.exitCode === null) child.kill() }
      server.httpServer?.once('close', stop)
      process.once('exit', stop)
      process.once('SIGINT', () => { stop(); process.exit(0) })
    },
  }
}

// In dev, /api is forwarded to `npm run dev` at the repo root (wrangler pages dev on :8788).
// index.html uses %VITE_SITE_URL% (from .env.production / .env.staging) for social-preview tags.
export default defineConfig(async ({ mode, command }) => {
  const api = await pickApi(command)
  process.env.VITE_SITE_URL ||= loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || 'http://localhost:5173'
  return {
  plugins: [react(), ...(api === 'local' ? [autoApi()] : [])],
  server: {
    port: 5173,
    proxy: {
      '/api': api === 'staging' ? {
        target: STAGING,
        changeOrigin: true,
        headers: { Origin: STAGING, Referer: `${STAGING}/` }, // staging accepts only its own origin (CSRF check)
      } : {
        target: 'http://127.0.0.1:8788',
        // API not running -> clear JSON message instead of a bare "Internal Server Error"
        configure: (proxy) =>
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ detail: 'The local API server is starting. Wait a few seconds and try again.' }))
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
