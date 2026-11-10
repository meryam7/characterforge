/** Test inbox for automated tests (scripts/*.mjs). NOT available in production (404).
 * Only @example.com addresses (reserved, can't receive real mail) ever get codes stored here (server/email.ts). */
import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { fail, str } from '../http'

const r = new Hono<AppEnv>()

r.get('/inbox', async (c) => {
  if (c.env.ENVIRONMENT === 'production') return fail(404, 'Not found')
  const email = str(c.req.query('email'), 'email', { max: 254, pattern: /^[^@\s]+@example\.com$/i }).toLowerCase()
  const purpose = str(c.req.query('purpose'), 'purpose', { optional: true, pattern: /^(verify|reset)$/ }) || 'verify'
  const row = await c.env.DB.prepare('SELECT code, created_at FROM test_inbox WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .bind(email, purpose)
    .first<{ code: string; created_at: string }>()
  return row ? c.json(row) : fail(404, 'No message')
})

export default r
