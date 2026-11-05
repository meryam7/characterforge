/** CharaForge API (Hono on Cloudflare Pages Functions). Mounted at /api by functions/api/[[path]].ts */
import { Hono } from 'hono'
import type { AppEnv } from './env'
import { ApiError } from './http'
import aiRoutes from './routes/ai'
import auth from './routes/auth'
import characters from './routes/characters'
import files from './routes/files'
import { gallery, publish } from './routes/gallery'
import history from './routes/history'

const app = new Hono<AppEnv>().basePath('/api')

app.use('*', async (c, next) => {
  if (!c.env.JWT_SECRET) {
    return c.json({ detail: 'Server misconfigured: JWT_SECRET is not set' }, 500)
  }
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
})

app.get('/health', (c) => c.json({ status: 'ok', ai: c.env.AI_ENABLED !== 'false', storage: 'd1' }))
app.route('/auth', auth)
app.route('/characters', characters)
app.route('/designs', publish)
app.route('/history', history)
app.route('/gallery', gallery)
app.route('/ai', aiRoutes)
app.route('/files', files)

app.notFound((c) => c.json({ detail: 'Not found' }, 404))
app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ detail: err.detail, ...err.extra }, err.status as 400)
  console.error(err)
  return c.json({ detail: 'Internal server error' }, 500)
})

export default app
