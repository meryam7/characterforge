// Test HTTP client: per-user cookie jar (session + CSRF), JSON/form helpers, TOTP generator.
import { createHmac } from 'node:crypto'
import { deflateSync } from 'node:zlib'

export const BASE = (process.env.BASE ?? 'http://127.0.0.1:8788').replace(/\/$/, '')
export const RUN = Date.now().toString(36)

let failures = 0
export const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
  return cond
}
export const done = (name, t0) => {
  console.log(`\n${failures ? `${failures} FAILED` : 'ALL PASSED'} (${name}) in ${((Date.now() - t0) / 1000).toFixed(1)}s against ${BASE}`)
  process.exit(failures ? 1 : 0)
}

export class Client {
  constructor() {
    this.jar = new Map()
  }
  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
  }
  absorb(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = line.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const value = pair.slice(i + 1).trim()
      const expired = attrs.some((a) => /max-age=0/i.test(a)) || value === ''
      if (expired) this.jar.delete(name)
      else this.jar.set(name, value)
    }
  }
  async call(method, path, { json, form, headers = {}, csrf = true, raw } = {}) {
    if (csrf && method !== 'GET' && !this.jar.has('__Host-csrf')) await this.call('GET', '/api/auth/csrf')
    const h = { ...headers }
    if (this.jar.size) h.Cookie = this.cookieHeader()
    if (csrf && method !== 'GET' && this.jar.has('__Host-csrf') && !('X-CSRF-Token' in h)) h['X-CSRF-Token'] = this.jar.get('__Host-csrf')
    let body = raw
    if (json !== undefined) {
      h['Content-Type'] ??= 'application/json'
      body = JSON.stringify(json)
    }
    if (form) body = form
    // retry only when the connection was never made (the request can't have reached the server) - flaky networks
    let res
    for (let attempt = 1; ; attempt++) {
      try {
        res = await fetch(BASE + path, { method, headers: h, body, redirect: 'manual' })
        break
      } catch (err) {
        const code = err?.cause?.code ?? ''
        const neverSent = ['UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code) || (method === 'GET' && code === 'ECONNRESET')
        if (!neverSent || attempt >= 4) throw err
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
    this.absorb(res)
    const type = res.headers.get('content-type') ?? ''
    const data = type.includes('json') ? await res.json() : await res.arrayBuffer()
    return { status: res.status, data, headers: res.headers, setCookies: res.headers.getSetCookie?.() ?? [] }
  }
}

export function png(w, h, rgb) {
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
  const rawPx = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rawPx.set(rgb, y * (w * 3 + 1) + 1 + x * 3)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rawPx)), chunk('IEND', Buffer.alloc(0))])
}

export function designForm({ kind = 'generate', prompt = 'battle pose', parent, consistency = 1 } = {}) {
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

export const PASSWORD = 'Sm0ke-test-passphrase'

export async function register(tag, { email } = {}) {
  const c = new Client()
  c.email = email ?? `smoke-${RUN}-${tag}@example.com`
  c.signup = await c.call('POST', '/api/auth/register', { json: { email: c.email, password: PASSWORD, display_name: `Smoke ${tag}`, accept_terms: true } })
  c.res = await completeEmail(c, c.signup)
  return c
}

/** Reads the latest code for an @example.com address from the staging/dev test inbox. */
export async function inboxCode(email, purpose = 'verify') {
  const r = await new Client().call('GET', `/api/test/inbox?email=${encodeURIComponent(email)}&purpose=${purpose}`)
  return r.status === 200 ? r.data.code : null
}

/** If the server asks for email verification, type the code from the test inbox (like a user would). */
export async function completeEmail(client, res) {
  if (res.data?.status !== 'verify_email_required') return res
  const code = await inboxCode(client.email)
  return client.call('POST', '/api/auth/email/verify', { json: { challenge: res.data.challenge, code } })
}

// ---- TOTP (RFC 6238) for MFA tests
function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0
  const out = []
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    value = (value << 5) | A.indexOf(ch); bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}
export function totp(secret, offsetSteps = 0) {
  const step = Math.floor(Date.now() / 30000) + offsetSteps
  const msg = Buffer.alloc(8)
  msg.writeUInt32BE(step, 4)
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0')
}
/** Wait until a fresh 30 s step starts if we're near the end of one (avoids flaky MFA tests). */
export async function freshStep() {
  const left = 30000 - (Date.now() % 30000)
  if (left < 6000) await new Promise((r) => setTimeout(r, left + 200))
}
