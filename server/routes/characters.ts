/** Characters, their designs, reference upload and export logging. Image bytes come from the browser engine. */
import { Hono } from 'hono'
import {
  characterOut, characterStats, deleteFiles, designOut, ownedCharacter, prepareFile, rateLimit, recordActivity,
} from '../db'
import type { AppEnv, CharacterRow, DesignRow } from '../env'
import { fail, int, jsonBody, str } from '../http'
import { requireUser } from '../middleware'

const r = new Hono<AppEnv>()
r.use('*', requireUser)

function parseEmbedding(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v) && v.length > 0 && v.length <= 1024 && v.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      return JSON.stringify(v)
    }
  } catch {
    /* invalid */
  }
  return fail(422, 'embedding: must be a JSON array of numbers')
}

r.get('/', async (c) => {
  const uid = c.get('user').id
  const { results } = await c.env.DB.prepare(
    `SELECT ch.*, (SELECT COUNT(*) FROM designs d WHERE d.character_id = ch.id) AS design_count,
            (SELECT image_key FROM designs d WHERE d.character_id = ch.id ORDER BY d.id DESC LIMIT 1) AS cover_key
     FROM characters ch WHERE ch.user_id = ? ORDER BY ch.id DESC`,
  )
    .bind(uid)
    .all<CharacterRow & { design_count: number; cover_key: string | null }>()
  return c.json(results.map((row) => characterOut(row, row)))
})

r.post('/', async (c) => {
  const uid = c.get('user').id
  const body = await jsonBody(c.req.raw)
  const name = str(body.name, 'name', { min: 1, max: 120 })
  const description = str(body.description, 'description', { max: 2000, optional: true })
  const style = str(body.style, 'style', { max: 60, optional: true }) || 'anime'
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
  const ch = await c.env.DB.prepare('INSERT INTO characters (user_id, name, description, style, seed) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(uid, name, description, style, seed)
    .first<CharacterRow>()
  await recordActivity(c.env.DB, uid, 'created', ch!, { detail: [style, description.slice(0, 200)].filter(Boolean).join(' · ') }).run()
  return c.json(characterOut(ch!, { design_count: 0, cover_key: null }), 201)
})

r.get('/:id{[0-9]+}', async (c) => {
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  return c.json(characterOut(ch, await characterStats(c.env.DB, ch.id)))
})

r.delete('/:id{[0-9]+}', async (c) => {
  const uid = c.get('user').id
  const db = c.env.DB
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  const { results: designs } = await db.prepare('SELECT image_key FROM designs WHERE character_id = ?').bind(ch.id).all<{ image_key: string }>()
  // the history entry reuses the character's latest history thumbnail (history thumbnails are kept)
  const lastThumb = await db
    .prepare('SELECT thumb_key FROM activities WHERE user_id = ? AND character_id = ? AND thumb_key IS NOT NULL ORDER BY id DESC LIMIT 1')
    .bind(uid, ch.id)
    .first<{ thumb_key: string }>()
  await db.batch([
    recordActivity(db, uid, 'deleted', ch, { detail: `${designs.length} designs`, thumbKey: lastThumb?.thumb_key }),
    ...deleteFiles(db, [...designs.map((d) => d.image_key), ch.reference_key]),
    db.prepare('DELETE FROM designs WHERE character_id = ?').bind(ch.id),
    db.prepare('DELETE FROM characters WHERE id = ?').bind(ch.id),
  ])
  return c.json({ ok: true })
})

/** multipart: image (≤768px, WebP/PNG/JPEG), thumb, embedding (JSON array) */
r.post('/:id{[0-9]+}/reference', async (c) => {
  const uid = c.get('user').id
  const db = c.env.DB
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  const form = await c.req.formData()
  const image = await prepareFile(db, uid, 'r', form.get('image'))
  const thumb = await prepareFile(db, uid, 't', form.get('thumb'))
  const embedding = parseEmbedding(form.get('embedding'))
  await db.batch([
    image.stmt,
    thumb.stmt,
    ...deleteFiles(db, [ch.reference_key]),
    db.prepare('UPDATE characters SET reference_key = ?, embedding = ? WHERE id = ?').bind(image.key, embedding, ch.id),
    recordActivity(db, uid, 'reference', ch, { detail: 'reference image uploaded', thumbKey: thumb.key }),
  ])
  const updated = await ownedCharacter(c, ch.id)
  return c.json(characterOut(updated, await characterStats(db, ch.id)))
})

r.get('/:id{[0-9]+}/designs', async (c) => {
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  const { results } = await c.env.DB.prepare('SELECT * FROM designs WHERE character_id = ? ORDER BY id').bind(ch.id).all<DesignRow>()
  return c.json(results.map(designOut))
})

/** multipart: image, thumb, kind (generate|edit), source (ai|mock), prompt, parent_id?, consistency?, embedding?
 *  `embedding` becomes the character's identity vector if it has none yet (first design). */
r.post('/:id{[0-9]+}/designs', async (c) => {
  const uid = c.get('user').id
  const db = c.env.DB
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  await rateLimit(c, `design:${uid}`, 60, 60)
  const form = await c.req.formData()
  const kind = str(form.get('kind'), 'kind', { pattern: /^(generate|edit)$/ }) as 'generate' | 'edit'
  const source = str(form.get('source'), 'source', { pattern: /^(ai|mock)$/ })
  const prompt = str(form.get('prompt'), 'prompt', { max: 500, optional: true }) || (kind === 'generate' ? 'base design' : '')
  const parentId = int(form.get('parent_id'), 'parent_id', true)
  if (parentId !== null) {
    const parent = await db.prepare('SELECT 1 FROM designs WHERE id = ? AND character_id = ?').bind(parentId, ch.id).first()
    if (!parent) fail(404, 'Parent design not found')
  }
  const rawScore = form.get('consistency')
  const consistency = rawScore === null || rawScore === '' ? null : Math.max(-1, Math.min(1, Number(rawScore)))
  if (consistency !== null && Number.isNaN(consistency)) fail(422, 'consistency: must be a number')
  const embedding = ch.embedding ? null : parseEmbedding(form.get('embedding'))

  const image = await prepareFile(db, uid, 'd', form.get('image'))
  const thumb = await prepareFile(db, uid, 't', form.get('thumb'))
  const insert = db
    .prepare(
      'INSERT INTO designs (character_id, parent_id, kind, source, prompt, image_key, consistency) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(ch.id, parentId, kind, source, prompt, image.key, consistency)
  const results = await db.batch<DesignRow>([
    image.stmt,
    thumb.stmt,
    insert,
    ...(embedding ? [db.prepare('UPDATE characters SET embedding = ? WHERE id = ?').bind(embedding, ch.id)] : []),
  ])
  const design = results[2].results[0]
  await recordActivity(db, uid, kind === 'edit' ? 'edited' : 'generated', ch, {
    designId: design.id, detail: `${prompt}${source === 'ai' ? '' : ' (preview art)'}`, thumbKey: thumb.key,
  }).run()
  return c.json(designOut(design), 201)
})

/** The browser builds exports itself; this only records them in the history. body: {detail, design_id?} */
r.post('/:id{[0-9]+}/exported', async (c) => {
  const uid = c.get('user').id
  const ch = await ownedCharacter(c, Number(c.req.param('id')))
  const body = await jsonBody(c.req.raw)
  const detail = str(body.detail, 'detail', { max: 100 })
  const designId = int(body.design_id, 'design_id', true)
  await recordActivity(c.env.DB, uid, 'exported', ch, { designId, detail }).run()
  return c.json({ ok: true })
})

export default r
