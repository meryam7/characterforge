/** Community gallery: public listing + single design (share pages), likes, "start from this" (remix), reports,
 * and per-design publish/unpublish. Only designs their owners chose to share are ever exposed. */
import type { Context } from 'hono'
import { Hono } from 'hono'
import { characterOut, designOut, fileUrl, isAdmin, ownedDesign, rateLimit, recordActivity } from '../db'
import type { AppEnv, CharacterRow, DesignRow } from '../env'
import { fail, int, jsonBody, now, str } from '../http'
import { requireUser } from '../middleware'
import { logEvent } from '../security-log'

export const REPORT_REASONS = ['nsfw', 'violence', 'hate', 'copyright', 'spam', 'other'] as const
const AUTO_ALERT_REPORTS = 3 // open reports on one design that raise a moderation alert

type PublicRow = DesignRow & { character_name: string; style: string; author: string; liked: number | null }

const PUBLIC_SELECT = `SELECT d.id, d.image_key, d.prompt, d.kind, d.source, d.published_at, d.created_at, d.like_count,
   ch.name AS character_name, ch.style, u.display_name AS author,
   (SELECT 1 FROM likes l WHERE l.design_id = d.id AND l.user_id = ?) AS liked
 FROM designs d JOIN characters ch ON ch.id = d.character_id JOIN users u ON u.id = ch.user_id`

const publicOut = (d: PublicRow & { like_count: number }) => ({
  id: d.id, image_url: fileUrl(d.image_key), prompt: d.prompt, kind: d.kind, source: d.source,
  character_name: d.character_name, style: d.style, author: d.author, published_at: d.published_at ?? d.created_at,
  like_count: d.like_count, liked_by_me: !!d.liked,
})

/** A shared design or 404 (never reveals private designs). */
async function publicDesign(c: Context<AppEnv>, id: number) {
  const row = await c.env.DB.prepare(`${PUBLIC_SELECT} WHERE d.id = ? AND d.is_public = 1`)
    .bind(c.get('user')?.id ?? 0, id)
    .first<PublicRow & { like_count: number }>()
  return row ?? fail(404, 'Design not found')
}

export const gallery = new Hono<AppEnv>()

/** ?sort=new (cursor: before) | popular (cursor: offset) */
gallery.get('/', async (c) => {
  const sort = str(c.req.query('sort'), 'sort', { optional: true, pattern: /^(new|popular)$/ }) || 'new'
  const limit = Math.min(Math.max(int(c.req.query('limit'), 'limit', true) ?? 24, 1), 60)
  const viewer = c.get('user')?.id ?? 0
  let results: (PublicRow & { like_count: number })[]
  let next: { next_before: number | null; next_offset: number | null }
  if (sort === 'popular') {
    const offset = Math.min(int(c.req.query('offset'), 'offset', true) ?? 0, 2000)
    ;({ results } = await c.env.DB.prepare(`${PUBLIC_SELECT} WHERE d.is_public = 1 ORDER BY d.like_count DESC, d.id DESC LIMIT ? OFFSET ?`)
      .bind(viewer, limit + 1, offset)
      .all<PublicRow & { like_count: number }>())
    next = { next_before: null, next_offset: results.length > limit ? offset + limit : null }
  } else {
    const before = int(c.req.query('before'), 'before', true)
    ;({ results } = await c.env.DB.prepare(
      `${PUBLIC_SELECT} WHERE d.is_public = 1 ${before !== null ? 'AND d.id < ?' : ''} ORDER BY d.id DESC LIMIT ?`,
    )
      .bind(viewer, ...(before !== null ? [before] : []), limit + 1)
      .all<PublicRow & { like_count: number }>())
    next = { next_before: results.length > limit ? results[limit - 1].id : null, next_offset: null }
  }
  // per-viewer "liked" flags -> never cache in shared caches when logged in
  c.header('Cache-Control', viewer ? 'private, no-store' : 'public, max-age=30')
  return c.json({ items: results.slice(0, limit).map(publicOut), ...next })
})

gallery.get('/:id{[0-9]+}', async (c) => {
  const d = await publicDesign(c, Number(c.req.param('id')))
  c.header('Cache-Control', c.get('user') ? 'private, no-store' : 'public, max-age=30')
  return c.json(publicOut(d))
})

gallery.post('/:id{[0-9]+}/like', requireUser, async (c) => {
  const uid = c.get('user').id
  const d = await publicDesign(c, Number(c.req.param('id')))
  await rateLimit(c, `like:${uid}`, 120, 3600)
  const db = c.env.DB
  const [, , row] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO likes (user_id, design_id) VALUES (?, ?)').bind(uid, d.id),
    db.prepare('UPDATE designs SET like_count = (SELECT COUNT(*) FROM likes WHERE design_id = ?) WHERE id = ?').bind(d.id, d.id),
    db.prepare('SELECT like_count FROM designs WHERE id = ?').bind(d.id),
  ])
  return c.json({ liked: true, like_count: (row.results[0] as { like_count: number }).like_count })
})

gallery.delete('/:id{[0-9]+}/like', requireUser, async (c) => {
  const uid = c.get('user').id
  const id = Number(c.req.param('id'))
  const db = c.env.DB
  const [, , row] = await db.batch([
    db.prepare('DELETE FROM likes WHERE user_id = ? AND design_id = ?').bind(uid, id),
    db.prepare('UPDATE designs SET like_count = (SELECT COUNT(*) FROM likes WHERE design_id = ?) WHERE id = ?').bind(id, id),
    db.prepare('SELECT like_count FROM designs WHERE id = ? AND is_public = 1').bind(id),
  ])
  const n = (row.results[0] as { like_count: number } | undefined)?.like_count
  return n === undefined ? fail(404, 'Design not found') : c.json({ liked: false, like_count: n })
})

/** "Start from this": a new character of yours, with the shared image as its reference (identity anchor). */
gallery.post('/:id{[0-9]+}/remix', requireUser, async (c) => {
  const uid = c.get('user').id
  const d = await publicDesign(c, Number(c.req.param('id')))
  await rateLimit(c, `remix:${uid}`, 20, 3600)
  const db = c.env.DB
  const ext = d.image_key.split('.').pop()
  const refKey = `r/${crypto.randomUUID().replaceAll('-', '')}.${ext}`
  const name = `${d.character_name}`.slice(0, 110) + ' (remix)'
  const description = (d.prompt && d.prompt !== 'base design' ? `${d.character_name}, ${d.prompt}` : d.character_name).slice(0, 2000)
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
  // copy the image bytes inside D1 (no Worker CPU), then create the character pointing at the copy
  const [, created] = await db.batch([
    db.prepare('INSERT INTO files (key, user_id, content_type, data) SELECT ?, ?, content_type, data FROM files WHERE key = ?').bind(refKey, uid, d.image_key),
    db.prepare('INSERT INTO characters (user_id, name, description, style, seed, reference_key, remixed_from) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(uid, name, description, d.style, seed, refKey, d.id),
  ])
  const ch = created.results[0] as CharacterRow
  await recordActivity(db, uid, 'created', ch, { detail: `started from a community design by ${d.author}`.slice(0, 200) }).run()
  return c.json(characterOut(ch, { design_count: 0, cover_key: null }), 201)
})

gallery.post('/:id{[0-9]+}/report', requireUser, async (c) => {
  const uid = c.get('user').id
  const id = Number(c.req.param('id'))
  const body = await jsonBody(c.req.raw)
  const reason = str(body.reason, 'reason', { pattern: new RegExp(`^(${REPORT_REASONS.join('|')})$`) })
  const note = str(body.note, 'note', { optional: true, max: 500 })
  const owner = await c.env.DB.prepare('SELECT ch.user_id FROM designs d JOIN characters ch ON ch.id = d.character_id WHERE d.id = ? AND d.is_public = 1')
    .bind(id)
    .first<{ user_id: number }>()
  if (!owner) fail(404, 'Design not found')
  if (owner!.user_id === uid) fail(400, "You can't report your own design")
  await rateLimit(c, `report:${uid}`, 20, 86400)
  const ins = await c.env.DB.prepare('INSERT OR IGNORE INTO reports (design_id, reporter_id, reason, note) VALUES (?, ?, ?, ?)')
    .bind(id, uid, reason, note)
    .run()
  if (ins.meta.changes) {
    const open = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE design_id = ? AND status = 'open'").bind(id).first<{ n: number }>()
    const n = open?.n ?? 1
    await logEvent(c, n === AUTO_ALERT_REPORTS ? 'content_reported' : 'content_report', n === AUTO_ALERT_REPORTS ? 'alert' : 'info', {
      detail: { design: id, reason, open_reports: n },
    })
  }
  return c.json({ ok: true })
})

export const publish = new Hono<AppEnv>()
publish.use('*', requireUser)

publish.post('/:id{[0-9]+}/publish', async (c) => {
  const uid = c.get('user').id
  const { design, character } = await ownedDesign(c, Number(c.req.param('id')))
  if (!design.is_public) {
    const ts = now()
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE designs SET is_public = 1, published_at = ? WHERE id = ?').bind(ts, design.id),
      recordActivity(c.env.DB, uid, 'published', character, { designId: design.id, detail: 'shared to the community gallery' }),
    ])
    design.is_public = 1
    design.published_at = ts
  }
  return c.json(designOut(design))
})

/** Owner can unpublish; admins (ADMIN_EMAILS) can take down any design. */
publish.delete('/:id{[0-9]+}/publish', async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const row = await c.env.DB.prepare('SELECT d.*, ch.user_id AS owner, ch.name AS character_name FROM designs d JOIN characters ch ON ch.id = d.character_id WHERE d.id = ?')
    .bind(id)
    .first<DesignRow & { owner: number; character_name: string }>()
  const mine = row?.owner === user.id
  if (!row || (!mine && !isAdmin(c.env, user.email))) {
    if (row) await logEvent(c, 'access_denied', 'warn', { detail: { resource: 'design', id } })
    return fail(404, 'Design not found')
  }
  if (!mine && !c.get('session').mfa) fail(403, 'Admin actions require a session verified with MFA')
  if (row.is_public) {
    const stmts = [c.env.DB.prepare('UPDATE designs SET is_public = 0, published_at = NULL WHERE id = ?').bind(id)]
    if (mine) {
      const ch = { id: row.character_id, name: row.character_name } as Pick<CharacterRow, 'id' | 'name'>
      stmts.push(recordActivity(c.env.DB, user.id, 'unpublished', ch, { designId: id, detail: 'removed from the community gallery' }))
    }
    await c.env.DB.batch(stmts)
    if (!mine) await logEvent(c, 'admin_takedown', 'alert', { detail: { design: id, owner: row.owner } })
  }
  return c.json({ ok: true })
})
