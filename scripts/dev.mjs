// Local development in one command:  npm run dev
//   → API (wrangler pages dev) on http://127.0.0.1:8788 + website (Vite, hot reload) on http://localhost:5173
// No Cloudflare login needed (no AI binding locally: preview art is used). Ctrl+C stops both.
// Local data lives in ~/.charaforge/dev-state (outside OneDrive, which can lock SQLite files).
//   node scripts/dev.mjs --migrate-only   apply database migrations and exit
//   node scripts/dev.mjs --api-only       start only the API (port 8788)
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE = path.join(os.homedir(), '.charaforge', 'dev-state')
const WRANGLER = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const VITE = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js')
const args = process.argv.slice(2)
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' }
const say = (m) => console.log(`\x1b[35m[dev]\x1b[0m ${m}`)

for (const [file, hint] of [[WRANGLER, 'npm install'], [VITE, 'npm --prefix frontend install']]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${path.relative(root, file)} - run: ${hint}`)
    process.exit(1)
  }
}

// 1. local secrets (never committed; random values are fine for local dev)
const devVars = path.join(root, '.dev.vars')
if (!fs.existsSync(devVars)) {
  fs.writeFileSync(devVars, `MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\nLOG_HASH_SALT=${randomBytes(24).toString('base64url')}\n`)
  say('created .dev.vars with local secrets')
}

// 2. database migrations (idempotent)
fs.mkdirSync(STATE, { recursive: true })
say(`database: ${STATE}`)
const mig = spawnSync(process.execPath, [WRANGLER, 'd1', 'migrations', 'apply', 'characterforge', '--local', '--persist-to', STATE], {
  cwd: root, env: { ...env, CI: '1' }, encoding: 'utf8',
})
if (mig.status !== 0) {
  console.error(mig.stdout, mig.stderr)
  console.error('Database migration failed (see above).')
  process.exit(1)
}
say(/No migrations to apply/.test(mig.stdout) ? 'database up to date' : 'database migrated')
if (args.includes('--migrate-only')) process.exit(0)

// 3. the API serves frontend/dist too: build it once if missing
if (!fs.existsSync(path.join(root, 'frontend', 'dist', 'index.html'))) {
  say('building the website once (frontend/dist)...')
  const b = spawnSync(process.execPath, [VITE, 'build'], { cwd: path.join(root, 'frontend'), env, stdio: 'inherit' })
  if (b.status !== 0) process.exit(1)
}

// 4. start servers
const children = []
const start = (name, color, cmd, cmdArgs, cwd) => {
  const child = spawn(process.execPath, [cmd, ...cmdArgs], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `
  const pipe = (stream, out) => {
    let buf = ''
    stream.on('data', (d) => {
      buf += d
      const lines = buf.split(/\r?\n/)
      buf = lines.pop()
      for (const l of lines) if (l.trim()) out.write(prefix + l + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    say(`${name} stopped (code ${code}) - stopping everything`)
    shutdown(code ?? 1)
  })
  children.push(child)
}
let stopping = false
function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const c of children) if (c.exitCode === null) c.kill()
  setTimeout(() => process.exit(code), 500)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('api', 36, WRANGLER, ['pages', 'dev', '--port', '8788', '--ip', '127.0.0.1', '--persist-to', STATE], root)
if (!args.includes('--api-only')) start('web', 32, VITE, ['--port', '5173'], path.join(root, 'frontend'))
say('open http://localhost:5173  (API: http://127.0.0.1:8788). Ctrl+C to stop.')
say('email codes are printed in the [api] lines (email_log_mode); AI uses preview art locally.')
