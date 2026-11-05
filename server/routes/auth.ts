import { Hono } from 'hono'
import { clientIp, isAdmin, rateLimit } from '../db'
import type { AppEnv, Env, UserRow } from '../env'
import { EMAIL, fail, jsonBody, str } from '../http'
import { requireUser } from '../middleware'
import { createToken, hashPassword, verifyPassword } from '../security'

export const userOut = (env: Env, u: UserRow) => ({
  id: u.id,
  email: u.email,
  display_name: u.display_name,
  is_admin: isAdmin(env, u.email),
  created_at: u.created_at,
})

const auth = new Hono<AppEnv>()

auth.post('/register', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254, pattern: EMAIL }).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8 || password.length > 128) fail(422, 'password: 8 to 128 characters')
  const name = str(body.display_name, 'display name', { min: 2, max: 40 })
  await rateLimit(c.env.DB, `register:${clientIp(c.req.raw)}`, 10, 3600)

  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) {
    fail(409, 'An account with this email already exists')
  }
  const user = await c.env.DB.prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?) RETURNING *')
    .bind(email, name, await hashPassword(password))
    .first<UserRow>()
  return c.json({ token: await createToken(user!.id, c.env.JWT_SECRET), user: userOut(c.env, user!) }, 201)
})

auth.post('/login', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254 }).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  await rateLimit(c.env.DB, `login-ip:${clientIp(c.req.raw)}`, 30, 600)
  await rateLimit(c.env.DB, `login-email:${email}`, 10, 600)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (!user || !(await verifyPassword(password, user.password_hash))) fail(401, 'Wrong email or password')
  return c.json({ token: await createToken(user!.id, c.env.JWT_SECRET), user: userOut(c.env, user!) })
})

auth.get('/me', requireUser, (c) => c.json(userOut(c.env, c.get('user'))))

/** Permanently delete the account with all characters, designs, files and history. */
auth.delete('/me', requireUser, async (c) => {
  const uid = c.get('user').id
  const db = c.env.DB
  await db.batch([
    db.prepare('DELETE FROM designs WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)').bind(uid),
    db.prepare('DELETE FROM characters WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM activities WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM files WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ])
  return c.json({ ok: true })
})

export default auth
