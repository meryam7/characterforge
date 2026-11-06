// Security test suite (run against local or STAGING, never needed on production):
//   node scripts/security-test.mjs                                          -> local (npm run dev)
//   BASE=https://staging.characterforge-3u3.pages.dev node scripts/security-test.mjs
// Covers: headers/HTTPS, cookie flags, CSRF, deny-by-default, IDOR (object-level authz), SQL injection, XSS payload
// handling, input validation, rate limiting + alerts, MFA (TOTP, replay, recovery codes), admin MFA enforcement,
// session revocation, and that logs never contain secrets.
import { BASE, Client, designForm, done, freshStep, ok, PASSWORD, RUN, register, totp } from './lib/client.mjs'

const t0 = Date.now()
const anon = new Client()
const health = (await anon.call('GET', '/api/health')).data
const ADMIN = { development: 'admin-local@example.com', staging: 'admin-staging@example.com' }[health.env]
console.log(`environment: ${health.env}`)
const cleanup = []

// ---------------------------------------------------------------- headers & transport
const h = (await anon.call('GET', '/api/health')).headers
ok(h.get('strict-transport-security')?.includes('max-age=63072000'), 'HSTS on API')
ok(h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY', 'nosniff + frame deny on API')
ok(h.get('content-security-policy')?.includes("default-src 'none'"), 'CSP on API')
ok(h.get('cache-control') === 'no-store', 'API responses not cached')
ok(!!h.get('x-request-id'), 'request id for log correlation')
if (BASE.startsWith('https://')) {
  const page = await fetch(BASE + '/')
  const csp = page.headers.get('content-security-policy') ?? ''
  ok(csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'") && !csp.includes('unsafe-eval'), 'strict CSP on the website')
  const http = await fetch(BASE.replace('https://', 'http://') + '/', { redirect: 'manual' })
  ok([301, 302, 307, 308].includes(http.status) && (http.headers.get('location') ?? '').startsWith('https://'), `HTTP redirects to HTTPS (${http.status})`)
}

// ---------------------------------------------------------------- cookies
const a = await register('sec-a')
cleanup.push(a)
const sc = a.res.setCookies.join('\n')
ok(/__Host-session=[^;]+;.*HttpOnly/i.test(sc) && /__Host-session=.*Secure/i.test(sc) && /__Host-session=.*SameSite=Lax/i.test(sc) && /__Host-session=.*Path=\//i.test(sc), 'session cookie: __Host-, Secure, HttpOnly, SameSite=Lax, Path=/')
const csrfLine = a.res.setCookies.find((l) => l.startsWith('__Host-csrf')) ?? ''
ok(/Secure/i.test(csrfLine) && /SameSite=Strict/i.test(csrfLine) && !/HttpOnly/i.test(csrfLine), 'CSRF cookie: Secure, SameSite=Strict, readable by the page')

// ---------------------------------------------------------------- CSRF
const noToken = await a.call('POST', '/api/characters', { json: { name: 'x' }, csrf: false })
ok(noToken.status === 403, `POST without CSRF token -> 403 (${noToken.status})`)
const wrongToken = await a.call('POST', '/api/characters', { json: { name: 'x' }, headers: { 'X-CSRF-Token': 'forged' } })
ok(wrongToken.status === 403, 'forged CSRF token -> 403')
const evilOrigin = await a.call('POST', '/api/characters', { json: { name: 'x' }, headers: { Origin: 'https://evil.example' } })
ok(evilOrigin.status === 403, 'cross-site Origin -> 403')

// ---------------------------------------------------------------- deny by default
for (const [m, p] of [['GET', '/api/characters'], ['GET', '/api/history'], ['GET', '/api/ai/status'], ['GET', '/api/admin/security/summary'], ['POST', '/api/characters']]) {
  ok((await anon.call(m, p, { json: m === 'POST' ? {} : undefined })).status === 401, `anonymous ${m} ${p} -> 401`)
}

// ---------------------------------------------------------------- IDOR / object-level authorization
const ch = (await a.call('POST', '/api/characters', { json: { name: 'Private hero' } })).data
const d = (await a.call('POST', `/api/characters/${ch.id}/designs`, { form: designForm() })).data
const b = await register('sec-b')
cleanup.push(b)
const probes = [
  ['GET', `/api/characters/${ch.id}`], ['DELETE', `/api/characters/${ch.id}`], ['GET', `/api/characters/${ch.id}/designs`],
  ['POST', `/api/characters/${ch.id}/exported`], ['POST', `/api/designs/${d.id}/publish`], ['DELETE', `/api/designs/${d.id}/publish`],
]
for (const [m, p] of probes) {
  const r = await b.call(m, p, { json: m === 'POST' ? { detail: 'x' } : undefined })
  ok(r.status === 404, `other user ${m} ${p} -> 404 (${r.status})`)
}
ok((await b.call('POST', `/api/characters/${ch.id}/designs`, { form: designForm() })).status === 404, "other user can't upload into someone's character")
ok((await b.call('POST', '/api/ai/generate', { json: { character_id: ch.id } })).status === 404, "other user can't spend AI on someone's character")
ok((await b.call('GET', d.image_url)).status === 404, "other user can't load a private image")
ok((await anon.call('GET', d.image_url)).status === 404, "visitor can't load a private image")
ok((await b.call('GET', '/api/history')).data.items.length === 0, 'history shows only your own events')
ok((await b.call('GET', '/api/characters')).data.length === 0, 'character list shows only your own')
ok(!JSON.stringify((await anon.call('GET', '/api/gallery')).data).includes('@'), 'gallery never exposes emails')

// ---------------------------------------------------------------- SQL injection
const sqli = ["' OR '1'='1", "admin'--", "x'); DROP TABLE users;--", '1 OR 1=1']
for (const p of sqli) {
  const r = await anon.call('POST', '/api/auth/login', { json: { email: p, password: p } })
  ok(r.status === 401 || r.status === 429, `login with SQL payload ${JSON.stringify(p)} -> ${r.status}`)
}
const evil = (await a.call('POST', '/api/characters', { json: { name: "Robert'); DROP TABLE characters;--", description: "' OR 1=1 --" } })).data
ok(evil.name === "Robert'); DROP TABLE characters;--", 'SQL payload stored as plain text')
ok((await a.call('GET', '/api/characters')).status === 200, 'tables intact after payloads')
ok((await a.call('GET', '/api/history?before=1%20OR%201=1')).status === 422, 'non-numeric query param rejected')
ok((await a.call('GET', `/api/characters/${ch.id}%20OR%201=1`)).status === 404, 'injected path id rejected')

// ---------------------------------------------------------------- XSS payloads (stored as text; React renders text)
const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>'
const xc = await a.call('POST', '/api/characters', { json: { name: xss, description: 'javascript:alert(3)' } })
ok(xc.status === 201 && xc.data.name === xss && xc.headers.get('content-type').startsWith('application/json'), 'XSS payload returned as inert JSON text')
const ctl = (await a.call('POST', '/api/characters', { json: { name: 'Bad\u0000‮name\u0007' } })).data
ok(ctl.name === 'Badname', `control/bidi characters stripped (${JSON.stringify(ctl.name)})`)

// ---------------------------------------------------------------- input validation
ok((await a.call('POST', '/api/characters', { json: { name: 'x'.repeat(121) } })).status === 422, 'too-long name -> 422')
ok((await a.call('POST', '/api/characters', { json: { name: 123 } })).status === 422, 'wrong type -> 422')
ok((await a.call('POST', '/api/characters', { raw: 'name=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status === 415, 'wrong content type -> 415')
ok((await a.call('POST', '/api/characters', { raw: '{not json', headers: { 'Content-Type': 'application/json' } })).status === 400, 'malformed JSON -> 400')
ok((await a.call('POST', '/api/characters', { raw: 'x'.repeat(5 * 1024 * 1024), headers: { 'Content-Type': 'application/json' } })).status === 413, 'body > 4 MB -> 413')
ok((await a.call('POST', '/api/ai/inpaint', { json: { design_id: d.id, prompt: 'x', image_b64: 'AAAA', mask: ['<script>'] } })).status === 422, 'bad AI mask -> 422')
const fake = new FormData()
fake.append('image', new Blob(['<html><script>alert(1)</script>'], { type: 'text/html' }), 'x.html')
fake.append('thumb', new Blob(['x'], { type: 'text/html' }), 'x.html')
fake.append('kind', 'generate'); fake.append('source', 'mock')
ok((await a.call('POST', `/api/characters/${ch.id}/designs`, { form: fake })).status === 415, 'HTML upload disguised as image -> 415')
ok((await anon.call('POST', '/api/auth/register', { json: { email: `weak-${RUN}@example.com`, password: 'password123', display_name: 'Weak' } })).status === 422, 'weak password rejected')

// ---------------------------------------------------------------- MFA (any user)
const m = await register('sec-mfa')
cleanup.push(m)
const setup = (await m.call('POST', '/api/auth/mfa/setup')).data
ok(/^[A-Z2-7]{32}$/.test(setup.secret) && setup.otpauth_uri.startsWith('otpauth://totp/'), 'MFA setup returns a TOTP secret')
ok((await m.call('POST', '/api/auth/mfa/enable', { json: { code: '000000' } })).status === 401, 'MFA enable rejects a wrong code')
await freshStep()
const en = await m.call('POST', '/api/auth/mfa/enable', { json: { code: totp(setup.secret) } })
ok(en.status === 200 && en.data.recovery_codes?.length === 10 && en.data.user.mfa_enabled, 'MFA enabled + 10 recovery codes')
const m2 = new Client()
const step1 = (await m2.call('POST', '/api/auth/login', { json: { email: m.email, password: PASSWORD } })).data
ok(step1.status === 'mfa_required' && !m2.jar.has('__Host-session'), 'password alone gives NO session when MFA is on')
ok((await m2.call('POST', '/api/auth/mfa/verify', { json: { challenge: step1.challenge, code: '123456' } })).status === 401, 'wrong MFA code rejected')
const usedCode = totp(setup.secret)
const replay = await m2.call('POST', '/api/auth/mfa/verify', { json: { challenge: step1.challenge, code: usedCode } })
ok(replay.status === 401, 'code already used to enable MFA cannot be replayed')
await new Promise((r) => setTimeout(r, 30000 - (Date.now() % 30000) + 300))
const good = await m2.call('POST', '/api/auth/mfa/verify', { json: { challenge: step1.challenge, code: totp(setup.secret) } })
ok(good.status === 200 && m2.jar.has('__Host-session') && good.data.user.mfa_verified, 'correct TOTP -> MFA session')
const m3 = new Client()
const s3 = (await m3.call('POST', '/api/auth/login', { json: { email: m.email, password: PASSWORD } })).data
const rc = en.data.recovery_codes[0]
ok((await m3.call('POST', '/api/auth/mfa/verify', { json: { challenge: s3.challenge, code: rc } })).status === 200, 'recovery code works once')
const m4 = new Client()
const s4 = (await m4.call('POST', '/api/auth/login', { json: { email: m.email, password: PASSWORD } })).data
ok((await m4.call('POST', '/api/auth/mfa/verify', { json: { challenge: s4.challenge, code: rc } })).status === 401, 'used recovery code rejected')
for (let i = 0; i < 4; i++) await m4.call('POST', '/api/auth/mfa/verify', { json: { challenge: s4.challenge, code: '000000' } })
const dead = await m4.call('POST', '/api/auth/mfa/verify', { json: { challenge: s4.challenge, code: en.data.recovery_codes[1] } })
ok(dead.status === 401 && /expired|too many/i.test(dead.data.detail), 'MFA challenge dies after 5 attempts, even for a valid code')
m.res = { data: { recovery_codes: en.data.recovery_codes } }

// ---------------------------------------------------------------- sessions
const pw = await register('sec-pw')
cleanup.push(pw)
const other = new Client()
await other.call('POST', '/api/auth/login', { json: { email: pw.email, password: PASSWORD } })
const NEW_PW = 'An0ther-long-passphrase'
ok((await pw.call('POST', '/api/auth/password', { json: { current_password: 'wrong', new_password: NEW_PW } })).status === 401, 'password change needs the current password')
ok((await pw.call('POST', '/api/auth/password', { json: { current_password: PASSWORD, new_password: NEW_PW } })).status === 200, 'password changed')
ok((await other.call('GET', '/api/auth/me')).status === 401, 'other sessions revoked after password change')
ok((await pw.call('GET', '/api/auth/me')).status === 200, 'current session kept')
pw.password = NEW_PW
const stolen = a.jar.get('__Host-session')
await a.call('POST', '/api/auth/logout')
const thief = new Client()
thief.jar.set('__Host-session', stolen)
ok((await thief.call('GET', '/api/auth/me')).status === 401, 'logged-out session token is dead server-side')
await a.call('POST', '/api/auth/login', { json: { email: a.email, password: PASSWORD } })
ok((await a.call('DELETE', '/api/auth/me', { json: { password: 'nope' } })).status === 401, 'account deletion needs the password')

// ---------------------------------------------------------------- brute force -> rate limit + alert
const target = `victim-${RUN}@example.com`
let limited = false
for (let i = 0; i < 12; i++) {
  const r = await anon.call('POST', '/api/auth/login', { json: { email: target, password: `guess-${i}` } })
  if (r.status === 429) limited = true
}
ok(limited, 'login brute force -> 429')

// ---------------------------------------------------------------- admin: MFA mandatory, logs, alerts
if (ADMIN) {
  const adm = new Client()
  let res = await adm.call('POST', '/api/auth/login', { json: { email: ADMIN, password: PASSWORD } })
  if (res.status === 401) res = await adm.call('POST', '/api/auth/register', { json: { email: ADMIN, password: PASSWORD, display_name: 'Admin' } })
  ok(res.data.status === 'mfa_enrol_required' && !adm.jar.has('__Host-session'), 'admin gets no session before MFA enrolment')
  const es = (await adm.call('POST', '/api/auth/mfa/enrol/start', { json: { challenge: res.data.challenge } })).data
  await freshStep()
  const fin = await adm.call('POST', '/api/auth/mfa/enrol/finish', { json: { challenge: res.data.challenge, code: totp(es.secret) } })
  ok(fin.status === 200 && fin.data.user.is_admin && fin.data.user.mfa_verified, 'admin enrolled MFA -> MFA session')
  const sum = await adm.call('GET', '/api/admin/security/summary')
  ok(sum.status === 200, 'admin (MFA) can open the security console')
  const alerts = sum.data.recent_alerts.map((x) => x.type)
  ok(alerts.includes('brute_force_account'), `brute force raised an alert (${alerts.slice(0, 6).join(', ')})`)
  ok(alerts.includes('recovery_code_used'), 'recovery-code login raised an alert')
  const ev = (await adm.call('GET', '/api/admin/security/events?limit=200')).data.items
  const types = new Set(ev.map((e) => e.type))
  ok(['login_failed', 'csrf_failed', 'access_denied', 'mfa_failed', 'rate_limited', 'password_changed', 'mfa_enabled'].every((t) => types.has(t)), `events logged: ${[...types].join(', ')}`)
  const blob = JSON.stringify(ev)
  const secrets = [PASSWORD, NEW_PW, setup.secret, es.secret, rc, stolen, target, a.email]
  ok(secrets.every((s) => !blob.includes(s)), 'security log contains no passwords, MFA secrets, codes, session tokens or emails')
  ok((await b.call('GET', '/api/admin/security/summary')).status === 404, 'non-admin cannot see the security console')
  const del = await adm.call('DELETE', '/api/auth/me', { json: { password: PASSWORD, code: fin.data.recovery_codes[0] } })
  ok(del.status === 200, 'admin test account removed (password + MFA recovery code)')
} else {
  console.log('note: admin checks skipped (no ADMIN email configured for this environment)')
}

// ---------------------------------------------------------------- cleanup
for (const c of cleanup) {
  const fresh = new Client()
  const r = await fresh.call('POST', '/api/auth/login', { json: { email: c.email, password: c.password ?? PASSWORD } })
  if (r.data.status === 'mfa_required') {
    await fresh.call('POST', '/api/auth/mfa/verify', { json: { challenge: r.data.challenge, code: m.res.data.recovery_codes[2] } })
  }
  const code = r.data.status === 'mfa_required' ? m.res.data.recovery_codes[3] : undefined
  await fresh.call('DELETE', '/api/auth/me', { json: { password: c.password ?? PASSWORD, code } })
}
done('security', t0)
