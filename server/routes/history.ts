import { Hono } from 'hono'
import { activityOut } from '../db'
import type { ActivityRow, AppEnv } from '../env'
import { int } from '../http'
import { requireUser } from '../middleware'

const r = new Hono<AppEnv>()
r.use('*', requireUser)

r.get('/', async (c) => {
  const uid = c.get('user').id
  const before = int(c.req.query('before'), 'before', true)
  const characterId = int(c.req.query('character_id'), 'character_id', true)
  const limit = Math.min(Math.max(int(c.req.query('limit'), 'limit', true) ?? 30, 1), 100)
  const where = ['user_id = ?']
  const args: (number | string)[] = [uid]
  if (before !== null) where.push('id < ?') && args.push(before)
  if (characterId !== null) where.push('character_id = ?') && args.push(characterId)
  const { results } = await c.env.DB.prepare(`SELECT * FROM activities WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`)
    .bind(...args, limit + 1)
    .all<ActivityRow>()
  const page = results.slice(0, limit)
  const ids = [...new Set(page.map((a) => a.character_id).filter((x): x is number => x !== null))]
  const alive = new Set<number>()
  if (ids.length) {
    const { results: rows } = await c.env.DB.prepare(
      `SELECT id FROM characters WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
    )
      .bind(uid, ...ids)
      .all<{ id: number }>()
    rows.forEach((row) => alive.add(row.id))
  }
  return c.json({
    items: page.map((a) => activityOut(a, alive)),
    next_before: results.length > limit ? page[page.length - 1].id : null,
  })
})

r.delete('/', async (c) => {
  const uid = c.get('user').id
  const db = c.env.DB
  await db.batch([
    // thumbnails belong to the history only
    db.prepare("DELETE FROM files WHERE user_id = ? AND key LIKE 't/%'").bind(uid),
    db.prepare('DELETE FROM activities WHERE user_id = ?').bind(uid),
  ])
  return c.json({ ok: true })
})

export default r
