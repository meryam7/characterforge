/** Public community gallery + per-design publish/unpublish. */
import { Hono } from 'hono'
import { designOut, fileUrl, isAdmin, ownedDesign, recordActivity } from '../db'
import type { AppEnv, CharacterRow, DesignRow } from '../env'
import { fail, int, now } from '../http'
import { requireUser } from '../middleware'

export const gallery = new Hono<AppEnv>()

gallery.get('/', async (c) => {
  const before = int(c.req.query('before'), 'before', true)
  const limit = Math.min(Math.max(int(c.req.query('limit'), 'limit', true) ?? 24, 1), 60)
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.image_key, d.prompt, d.kind, d.source, d.published_at, d.created_at,
            ch.name AS character_name, ch.style, u.display_name AS author
     FROM designs d JOIN characters ch ON ch.id = d.character_id JOIN users u ON u.id = ch.user_id
     WHERE d.is_public = 1 ${before !== null ? 'AND d.id < ?' : ''}
     ORDER BY d.id DESC LIMIT ?`,
  )
    .bind(...(before !== null ? [before] : []), limit + 1)
    .all<DesignRow & { character_name: string; style: string; author: string }>()
  const page = results.slice(0, limit)
  c.header('Cache-Control', 'public, max-age=30')
  return c.json({
    items: page.map((d) => ({
      id: d.id, image_url: fileUrl(d.image_key), prompt: d.prompt, kind: d.kind, source: d.source,
      character_name: d.character_name, style: d.style, author: d.author, published_at: d.published_at ?? d.created_at,
    })),
    next_before: results.length > limit ? page[page.length - 1].id : null,
  })
})

export const publish = new Hono<AppEnv>()
publish.use('*', requireUser)

publish.post('/:id{[0-9]+}/publish', async (c) => {
  const uid = c.get('user').id
  const { design, character } = await ownedDesign(c.env.DB, uid, Number(c.req.param('id')))
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
  if (!row || (!mine && !isAdmin(c.env, user.email))) return fail(404, 'Design not found')
  if (row.is_public) {
    const stmts = [c.env.DB.prepare('UPDATE designs SET is_public = 0, published_at = NULL WHERE id = ?').bind(id)]
    if (mine) {
      const ch = { id: row.character_id, name: row.character_name } as Pick<CharacterRow, 'id' | 'name'>
      stmts.push(recordActivity(c.env.DB, user.id, 'unpublished', ch, { designId: id, detail: 'removed from the community gallery' }))
    }
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})
