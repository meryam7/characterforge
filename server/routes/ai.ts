/** Workers AI proxy. Returns PNG bytes; the browser normalises, scores and uploads the result as a design.
 * Any failure answers {"detail", "fallback": true} so the browser switches to its procedural engine. */
import type { Context } from 'hono'
import { Hono } from 'hono'
import * as ai from '../ai'
import { ownedCharacter, ownedDesign, rateLimit } from '../db'
import type { AppEnv, Env } from '../env'
import { fail, int, jsonBody, str, today } from '../http'
import { requireUser } from '../middleware'

const r = new Hono<AppEnv>()
r.use('*', requireUser)

const B64 = /^[A-Za-z0-9+/]+={0,2}$/ // checked on the whole string
const MAX_B64 = 2_000_000

const enabled = (env: Env) => env.AI_ENABLED !== 'false' && !!env.AI
const dailyLimit = (env: Env) => Number(env.AI_DAILY_LIMIT || '40')

async function used(db: D1Database, uid: number) {
  const row = await db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').bind(uid, today()).first<{ count: number }>()
  return row?.count ?? 0
}

async function guard(c: Context<AppEnv>, uid: number) {
  const env = c.env
  if (!enabled(env)) fail(503, 'AI generation is switched off', { fallback: true })
  await rateLimit(c, `ai:${uid}`, 6, 60)
  if ((await used(env.DB, uid)) >= dailyLimit(env)) {
    fail(429, `Daily AI limit reached (${dailyLimit(env)} images). Preview art is used until tomorrow.`, { fallback: true })
  }
}

async function finish(env: Env, uid: number, bytes: ReadableStream | Uint8Array | ArrayBuffer) {
  const row = await env.DB.prepare(
    'INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count',
  )
    .bind(uid, today())
    .first<{ count: number }>()
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-AI-Remaining': String(Math.max(dailyLimit(env) - (row?.count ?? 0), 0)),
    },
  })
}

function aiFailed(err: unknown): never {
  console.error('[ai]', err)
  return fail(503, 'The AI model is busy right now. Preview art was used instead.', { fallback: true })
}

r.get('/status', async (c) => {
  const limit = dailyLimit(c.env)
  return c.json({ enabled: enabled(c.env), daily_limit: limit, remaining: Math.max(limit - (await used(c.env.DB, c.get('user').id)), 0) })
})

/** body: {character_id, prompt, anchor_b64?}  anchor = 512x768 PNG of the reference/first design (identity lock) */
r.post('/generate', async (c) => {
  const uid = c.get('user').id
  const body = await jsonBody(c.req.raw)
  const ch = await ownedCharacter(c, int(body.character_id, 'character_id')!)
  const extra = str(body.prompt, 'prompt', { max: 500, optional: true })
  const anchor = typeof body.anchor_b64 === 'string' && body.anchor_b64 ? body.anchor_b64 : null
  if (anchor && (anchor.length > MAX_B64 || !B64.test(anchor))) fail(422, 'anchor_b64: invalid image')
  await guard(c, uid)
  try {
    const out = await ai.generate(c.env, ai.buildPrompt(ch.description || ch.name, ch.style, extra), ch.seed, anchor)
    return finish(c.env, uid, out)
  } catch (err) {
    return aiFailed(err)
  }
})

/** body: {design_id, prompt, image_b64 (512x768 PNG), mask (PNG bytes as number[], white = repaint)} */
r.post('/inpaint', async (c) => {
  const uid = c.get('user').id
  const body = await jsonBody(c.req.raw)
  const { character } = await ownedDesign(c, int(body.design_id, 'design_id')!)
  const prompt = str(body.prompt, 'prompt', { min: 1, max: 500 })
  const image = typeof body.image_b64 === 'string' ? body.image_b64 : ''
  if (!image || image.length > MAX_B64 || !B64.test(image)) fail(422, 'image_b64: invalid image')
  const mask = body.mask
  if (!Array.isArray(mask) || mask.length < 60 || mask.length > 400_000 || !mask.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    fail(422, 'mask: must be PNG bytes')
  }
  await guard(c, uid)
  try {
    const desc = character.description || character.name
    const out = await ai.inpaint(c.env, ai.buildPrompt(desc, character.style, prompt), character.seed, image, mask as number[])
    return finish(c.env, uid, out)
  } catch (err) {
    return aiFailed(err)
  }
})

export default r
