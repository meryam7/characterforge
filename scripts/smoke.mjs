// End-to-end API test. Runs against a live server (local `npm run dev` or production).
//   node scripts/smoke.mjs                         -> http://127.0.0.1:8788
//   BASE=https://characterforge.pages.dev node scripts/smoke.mjs
//   AI=1 node scripts/smoke.mjs                    -> also calls Workers AI (uses daily allowance)
// Creates throwaway users and deletes them at the end.
import { deflateSync } from 'node:zlib'

const BASE = (process.env.BASE ?? 'http://127.0.0.1:8788').replace(/\/$/, '')
const RUN = Date.now().toString(36)
let failures = 0
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
}

function png(w, h, rgb) {
  const crcT = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return ~c >>> 0 }
  const chunk = (t, d) => {
    const b = Buffer.alloc(12 + d.length)
    b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8)
    b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length)
    return b
  }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

async function call(method, path, { token, json, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  if (form) body = form
  const res = await fetch(BASE + path, { method, headers, body })
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await res.json() : await res.arrayBuffer()
  return { status: res.status, data, headers: res.headers }
}

async function register(tag) {
  const r = await call('POST', '/api/auth/register', {
    json: { email: `smoke-${RUN}-${tag}@example.com`, password: 'password123', display_name: `Smoke ${tag}` },
  })
  return r.data.token
}

function designForm({ kind = 'generate', prompt = 'battle pose', parent, consistency = 1 } = {}) {
  const f = new FormData()
  f.append('image', new Blob([png(64, 96, [200, 40, 120])], { type: 'image/png' }), 'd.png')
  f.append('thumb', new Blob([png(16, 24, [200, 40, 120])], { type: 'image/png' }), 't.png')
  f.append('kind', kind)
  f.append('source', 'mock')
  f.append('prompt', prompt)
  f.append('consistency', String(consistency))
  f.append('embedding', JSON.stringify([0.5, 0.5, 0.5, 0.5]))
  if (parent) f.append('parent_id', String(parent))
  return f
}

const t0 = Date.now()
const health = await call('GET', '/api/health')
ok(health.status === 200 && health.data.status === 'ok', `health ${JSON.stringify(health.data)}`)
ok((await call('GET', '/')).status === 200, 'frontend served at /')

// auth
const a = await register('a')
ok(typeof a === 'string', 'register')
ok((await call('POST', '/api/auth/register', { json: { email: `smoke-${RUN}-a@example.com`, password: 'password123', display_name: 'Dup' } })).status === 409, 'duplicate email -> 409')
ok((await call('POST', '/api/auth/register', { json: { email: 'bad', password: 'x', display_name: 'x' } })).status === 422, 'validation -> 422')
const login = await call('POST', '/api/auth/login', { json: { email: `SMOKE-${RUN}-A@example.com`, password: 'password123' } })
ok(login.status === 200 && login.data.token, `login (case-insensitive) ${login.status}`)
ok((await call('POST', '/api/auth/login', { json: { email: `smoke-${RUN}-a@example.com`, password: 'wrong-pass' } })).status === 401, 'wrong password -> 401')
ok((await call('GET', '/api/characters')).status === 401, 'no token -> 401')
ok((await call('GET', '/api/auth/me', { token: a })).data.display_name === 'Smoke a', 'me')

// characters + designs
const ch = (await call('POST', '/api/characters', { token: a, json: { name: 'Mira', description: 'silver hair mage', style: 'anime' } })).data
ok(ch.id && ch.seed > 0 && ch.embedding === null, 'create character')
const d1 = await call('POST', `/api/characters/${ch.id}/designs`, { token: a, form: designForm() })
ok(d1.status === 201 && d1.data.image_url.startsWith('/api/files/d/'), `upload design ${d1.status}`)
const img = await call('GET', d1.data.image_url)
ok(img.status === 200 && img.headers.get('content-type') === 'image/png' && img.headers.get('cache-control')?.includes('immutable'), 'serve image')
const d2 = await call('POST', `/api/characters/${ch.id}/designs`, { token: a, form: designForm({ kind: 'edit', prompt: 'red hair', parent: d1.data.id, consistency: 0.8 }) })
ok(d2.status === 201 && d2.data.parent_id === d1.data.id && d2.data.consistency === 0.8, 'upload edit')
const chNow = (await call('GET', `/api/characters/${ch.id}`, { token: a })).data
ok(chNow.design_count === 2 && Array.isArray(chNow.embedding) && chNow.cover_url === d2.data.image_url, 'character stats + identity vector set by first design')
ok((await call('POST', `/api/characters/${ch.id}/exported`, { token: a, json: { detail: 'Godot pack' } })).status === 200, 'log export')
const ref = new FormData()
ref.append('image', new Blob([png(32, 32, [10, 200, 10])], { type: 'image/png' }), 'r.png')
ref.append('thumb', new Blob([png(8, 8, [10, 200, 10])], { type: 'image/png' }), 't.png')
ref.append('embedding', JSON.stringify([1, 0, 0]))
const refRes = await call('POST', `/api/characters/${ch.id}/reference`, { token: a, form: ref })
ok(refRes.status === 200 && refRes.data.reference_url, 'reference upload')
const badFile = new FormData()
badFile.append('image', new Blob(['hello'], { type: 'text/plain' }), 'x.txt')
badFile.append('thumb', new Blob(['hello'], { type: 'text/plain' }), 'x.txt')
ok((await call('POST', `/api/characters/${ch.id}/reference`, { token: a, form: badFile })).status === 415, 'non-image rejected')

// history
const hist = (await call('GET', '/api/history', { token: a })).data
ok(JSON.stringify(hist.items.map((i) => i.action)) === JSON.stringify(['reference', 'exported', 'edited', 'generated', 'created']), `history order ${hist.items.map((i) => i.action)}`)
const page = (await call('GET', '/api/history?limit=2', { token: a })).data
ok(page.items.length === 2 && page.next_before, 'history pagination')

// ownership
const b = await register('b')
ok((await call('GET', `/api/characters/${ch.id}`, { token: b })).status === 404, 'other user cannot read character')
ok((await call('POST', `/api/designs/${d1.data.id}/publish`, { token: b })).status === 404, 'other user cannot publish')
ok((await call('POST', `/api/characters/${ch.id}/designs`, { token: b, form: designForm() })).status === 404, 'other user cannot upload')
ok((await call('GET', '/api/history', { token: b })).data.items.length === 0, 'history is private')

// community
ok((await call('POST', `/api/designs/${d1.data.id}/publish`, { token: a })).data.is_public === true, 'publish')
const gal = (await call('GET', '/api/gallery')).data
ok(gal.items.some((i) => i.id === d1.data.id && i.author === 'Smoke a'), 'public gallery lists it (no login)')
ok((await call('DELETE', `/api/designs/${d1.data.id}/publish`, { token: a })).status === 200, 'unpublish')

// AI (optional)
const status = (await call('GET', '/api/ai/status', { token: a })).data
ok(typeof status.enabled === 'boolean', `ai status ${JSON.stringify(status)}`)
if (process.env.AI === '1') {
  const gen = await call('POST', '/api/ai/generate', { token: a, json: { character_id: ch.id, prompt: 'waving' } })
  ok(gen.status === 200 && gen.headers.get('content-type') === 'image/png' && gen.data.byteLength > 10000, `ai generate ${gen.status} ${gen.data.byteLength ?? JSON.stringify(gen.data)}`)
}

// delete character keeps history
ok((await call('DELETE', `/api/characters/${ch.id}`, { token: a })).status === 200, 'delete character')
const after = (await call('GET', '/api/history', { token: a })).data.items
ok(after[0].action === 'deleted' && !after.some((i) => i.character_exists), 'history survives deletion')
ok((await call('GET', `${d1.data.image_url}?after-delete=${RUN}`)).status === 404, 'design file removed')

// cleanup
for (const t of [a, b]) ok((await call('DELETE', '/api/auth/me', { token: t })).status === 200, 'delete account')
ok((await call('GET', '/api/auth/me', { token: a })).status === 401, 'deleted account token rejected')

console.log(`\n${failures ? `${failures} FAILED` : 'ALL PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)}s against ${BASE}`)
process.exit(failures ? 1 : 0)
