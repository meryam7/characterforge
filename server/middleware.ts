import { createMiddleware } from 'hono/factory'
import type { AppEnv, UserRow } from './env'
import { fail } from './http'
import { readToken } from './security'

/** Requires "Authorization: Bearer <token>" and loads the user into c.get('user'). */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const [scheme, token] = (c.req.header('authorization') ?? '').split(' ')
  const id = scheme?.toLowerCase() === 'bearer' && token ? await readToken(token, c.env.JWT_SECRET) : null
  const user = id === null ? null : await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
  if (!user) fail(401, 'Please log in')
  c.set('user', user!)
  await next()
})
