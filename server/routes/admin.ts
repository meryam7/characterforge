/** Admin security console. Reachable only by ADMIN_EMAILS users with an MFA-verified session (see middleware.authorize). */
import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { isAdmin } from '../db'
import { fail, int, jsonBody, str } from '../http'
import { logEvent } from '../security-log'

const r = new Hono<AppEnv>()

// Defence in depth: enforce admin + MFA inside the admin router too, so no path trick can skip the global check.
r.use('*', async (c, next) => {
  const user = c.get('user')
  if (!user || !isAdmin(c.env, user.email)) {
    await logEvent(c, 'access_denied', 'warn', { detail: { area: 'admin' } })
    fail(404, 'Not found')
  }
  if (!c.get('session')?.mfa) fail(403, 'Admin area requires a session verified with MFA - log in again')
  await next()
})

/** Moderation queue: shared designs with open reports, most reported first. */
r.get('/reports', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT r.design_id, COUNT(*) AS reports, GROUP_CONCAT(DISTINCT r.reason) AS reasons,
            SUBSTR(GROUP_CONCAT(NULLIF(r.note, ''), ' | '), 1, 600) AS notes, MAX(r.created_at) AS last_report_at,
            d.image_key, d.is_public, d.prompt, ch.name AS character_name, u.display_name AS author, u.id AS author_id
     FROM reports r JOIN designs d ON d.id = r.design_id JOIN characters ch ON ch.id = d.character_id JOIN users u ON u.id = ch.user_id
     WHERE r.status = 'open' GROUP BY r.design_id ORDER BY reports DESC, last_report_at DESC LIMIT 100`,
  ).all<{ image_key: string }>()
  return c.json({ items: results.map(({ image_key, ...row }) => ({ ...row, image_url: `/api/files/${image_key}` })) })
})

/** body {action: "dismiss" | "remove"}. remove = take the design out of the community gallery. */
r.post('/reports/:designId{[0-9]+}/resolve', async (c) => {
  const id = Number(c.req.param('designId'))
  const body = await jsonBody(c.req.raw)
  const action = str(body.action, 'action', { pattern: /^(dismiss|remove)$/ })
  const db = c.env.DB
  const stmts = [
    db.prepare("UPDATE reports SET status = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE design_id = ? AND status = 'open'")
      .bind(action === 'remove' ? 'removed' : 'dismissed', id),
  ]
  if (action === 'remove') stmts.push(db.prepare('UPDATE designs SET is_public = 0, published_at = NULL WHERE id = ?').bind(id))
  const [res] = await db.batch(stmts)
  if (!res.meta.changes) fail(404, 'No open reports for this design')
  await logEvent(c, action === 'remove' ? 'admin_takedown' : 'report_dismissed', action === 'remove' ? 'alert' : 'info', {
    detail: { design: id, via: 'reports' },
  })
  return c.json({ ok: true })
})

r.get('/security/summary', async (c) => {
  const since = Math.floor(Date.now() / 1000) - 86400
  const db = c.env.DB
  const [counts, alerts, users, sessions] = await db.batch([
    db.prepare('SELECT type, severity, COUNT(*) AS n FROM security_events WHERE ts > ? GROUP BY type, severity ORDER BY n DESC').bind(since),
    db.prepare("SELECT id, type, detail, created_at FROM security_events WHERE severity = 'alert' ORDER BY id DESC LIMIT 20"),
    db.prepare('SELECT COUNT(*) AS n, SUM(mfa_enabled) AS mfa FROM users'),
    db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?').bind(Math.floor(Date.now() / 1000)),
  ])
  return c.json({
    last_24h: counts.results,
    recent_alerts: alerts.results,
    users: users.results[0],
    active_sessions: (sessions.results[0] as { n: number }).n,
  })
})

r.get('/security/events', async (c) => {
  const before = int(c.req.query('before'), 'before', true)
  const severity = str(c.req.query('severity'), 'severity', { optional: true, pattern: /^(info|warn|alert)$/ })
  const limit = Math.min(Math.max(int(c.req.query('limit'), 'limit', true) ?? 50, 1), 200)
  const where: string[] = []
  const args: (string | number)[] = []
  if (before !== null) where.push('id < ?') && args.push(before)
  if (severity) where.push('severity = ?') && args.push(severity)
  const { results } = await c.env.DB.prepare(
    `SELECT id, type, severity, user_id, subject, ip_hash, path, detail, created_at FROM security_events
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`,
  )
    .bind(...args, limit + 1)
    .all<{ id: number }>()
  const page = results.slice(0, limit)
  return c.json({ items: page, next_before: results.length > limit ? page[page.length - 1].id : null })
})

export default r
