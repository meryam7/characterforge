// Functional end-to-end API test (cookie sessions + CSRF).
//   node scripts/smoke.mjs                                   -> http://127.0.0.1:8788
//   BASE=https://staging.characterforge-3u3.pages.dev node scripts/smoke.mjs
//   AI=1 ...                                                 -> also calls Workers AI (uses daily allowance)
// Creates throwaway users and deletes them at the end.
import { BASE, Client, designForm, done, ok, PASSWORD, png, register, RUN } from './lib/client.mjs'

const t0 = Date.now()
const anon = new Client()
const health = await anon.call('GET', '/api/health')
ok(health.status === 200 && health.data.status === 'ok', `health ${JSON.stringify(health.data)}`)
ok((await anon.call('GET', '/')).status === 200, 'frontend served at /')

// auth
const a = await register('a')
ok(a.res.status === 201 && a.res.data.status === 'ok' && a.jar.has('__Host-session'), 'register -> session cookie')
ok(!('token' in a.res.data), 'no token in response body (cookie only)')
ok((await anon.call('POST', '/api/auth/register', { json: { email: a.email, password: PASSWORD, display_name: 'Dup' } })).status === 409, 'duplicate email -> 409')
const login = new Client()
const lr = await login.call('POST', '/api/auth/login', { json: { email: a.email.toUpperCase(), password: PASSWORD } })
ok(lr.status === 200 && lr.data.status === 'ok' && login.jar.has('__Host-session'), `login (case-insensitive) ${lr.status}`)
ok((await anon.call('GET', '/api/characters')).status === 401, 'no session -> 401')
ok((await a.call('GET', '/api/auth/me')).data.display_name === 'Smoke a', 'me')

// characters + designs
const ch = (await a.call('POST', '/api/characters', { json: { name: 'Mira', description: 'silver hair mage', style: 'anime' } })).data
ok(ch.id && ch.seed > 0 && ch.embedding === null, 'create character')
const d1 = await a.call('POST', `/api/characters/${ch.id}/designs`, { form: designForm() })
ok(d1.status === 201 && d1.data.image_url.startsWith('/api/files/d/'), `upload design ${d1.status}`)
const img = await a.call('GET', d1.data.image_url)
ok(img.status === 200 && img.headers.get('content-type') === 'image/png' && img.headers.get('cache-control')?.startsWith('private'), 'owner can load private image')
const d2 = await a.call('POST', `/api/characters/${ch.id}/designs`, { form: designForm({ kind: 'edit', prompt: 'red hair', parent: d1.data.id, consistency: 0.8 }) })
ok(d2.status === 201 && d2.data.parent_id === d1.data.id && d2.data.consistency === 0.8, 'upload edit')
const chNow = (await a.call('GET', `/api/characters/${ch.id}`)).data
ok(chNow.design_count === 2 && Array.isArray(chNow.embedding) && chNow.cover_url === d2.data.image_url, 'character stats + identity vector')
ok((await a.call('POST', `/api/characters/${ch.id}/exported`, { json: { detail: 'Godot pack' } })).status === 200, 'log export')
const ref = new FormData()
ref.append('image', new Blob([png(32, 32, [10, 200, 10])], { type: 'image/png' }), 'r.png')
ref.append('thumb', new Blob([png(8, 8, [10, 200, 10])], { type: 'image/png' }), 't.png')
ref.append('embedding', JSON.stringify([1, 0, 0]))
ok((await a.call('POST', `/api/characters/${ch.id}/reference`, { form: ref })).status === 200, 'reference upload')

// history
const hist = (await a.call('GET', '/api/history')).data
ok(JSON.stringify(hist.items.map((i) => i.action)) === JSON.stringify(['reference', 'exported', 'edited', 'generated', 'created']), `history order ${hist.items.map((i) => i.action)}`)
ok((await a.call('GET', '/api/history?limit=2')).data.next_before, 'history pagination')

// community
ok((await a.call('POST', `/api/designs/${d1.data.id}/publish`)).data.is_public === true, 'publish')
const gal = (await anon.call('GET', '/api/gallery')).data
ok(gal.items.some((i) => i.id === d1.data.id && i.author === 'Smoke a'), 'public gallery lists it (no login)')
ok((await anon.call('GET', d1.data.image_url)).status === 200, 'shared image visible to visitors')
ok((await a.call('DELETE', `/api/designs/${d1.data.id}/publish`)).status === 200, 'unpublish')
ok((await anon.call('GET', `${d1.data.image_url}`)).status === 404, 'unshared image hidden again')

// AI
const status = (await a.call('GET', '/api/ai/status')).data
ok(typeof status.enabled === 'boolean', `ai status ${JSON.stringify(status)}`)
if (process.env.AI === '1') {
  const gen = await a.call('POST', '/api/ai/generate', { json: { character_id: ch.id, prompt: 'waving' } })
  ok(gen.status === 200 && gen.headers.get('content-type') === 'image/png' && gen.data.byteLength > 10000, `ai generate ${gen.status} ${gen.data.byteLength ?? JSON.stringify(gen.data)}`)
}

// delete keeps history
ok((await a.call('DELETE', `/api/characters/${ch.id}`)).status === 200, 'delete character')
const after = (await a.call('GET', '/api/history')).data.items
ok(after[0].action === 'deleted' && !after.some((i) => i.character_exists), 'history survives deletion')
ok((await a.call('GET', `${d1.data.image_url}?x=${RUN}`)).status === 404, 'design file removed')

// logout + cleanup
ok((await login.call('POST', '/api/auth/logout')).status === 200, 'logout')
ok((await login.call('GET', '/api/auth/me')).status === 401, 'session gone after logout')
ok((await a.call('DELETE', '/api/auth/me', { json: { password: PASSWORD } })).status === 200, 'delete account')
ok((await a.call('GET', '/api/auth/me')).status === 401, 'deleted account session rejected')

done('smoke', t0)
