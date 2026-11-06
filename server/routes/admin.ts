/** Admin security console. Reachable only by ADMIN_EMAILS users with an MFA-verified session (see middleware.authorize). */
import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { int, str } from '../http'

const r = new Hono<AppEnv>()

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
