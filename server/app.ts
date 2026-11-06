/** CharaForge API (Hono on Cloudflare Pages Functions). Mounted at /api by functions/api/[[path]].ts
 * Pipeline: request log → security headers → body limit → per-IP limiter → CSRF → session → deny-by-default authz. */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from './env'
import { ApiError } from './http'
import { authenticate, authorize, csrfProtection, generalRateLimit, requestContext, securityHeaders } from './middleware'
import admin from './routes/admin'
import aiRoutes from './routes/ai'
import auth from './routes/auth'
import characters from './routes/characters'
import files from './routes/files'
import { gallery, publish } from './routes/gallery'
import history from './routes/history'

const app = new Hono<AppEnv>().basePath('/api')

app.use('*', async (c, next) => {
  if (!c.env.MFA_ENCRYPTION_KEY || !c.env.LOG_HASH_SALT) {
    console.error(JSON.stringify({ t: 'config_error', missing: ['MFA_ENCRYPTION_KEY', 'LOG_HASH_SALT'].filter((k) => !c.env[k as 'LOG_HASH_SALT']) }))
    return c.json({ detail: 'Server misconfigured' }, 500)
  }
  await next()
})
app.use('*', requestContext)
app.use('*', securityHeaders)
app.use('*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => c.json({ detail: 'Request too large' }, 413) }))
app.use('*', generalRateLimit)
app.use('*', csrfProtection)
app.use('*', authenticate)
app.use('*', authorize)

app.get('/health', (c) => c.json({ status: 'ok', env: c.env.ENVIRONMENT, ai: c.env.AI_ENABLED !== 'false', storage: 'd1' }))
app.route('/auth', auth)
app.route('/characters', characters)
app.route('/designs', publish)
app.route('/history', history)
app.route('/gallery', gallery)
app.route('/ai', aiRoutes)
app.route('/files', files)
app.route('/admin', admin)

app.notFound((c) => c.json({ detail: 'Not found' }, 404))
app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ detail: err.detail, ...err.extra }, err.status as 400)
  // no stack traces or internals to the client; the request id links to the log line
  console.error(JSON.stringify({ t: 'error', rid: c.get('requestId'), error: String(err).slice(0, 300) }))
  return c.json({ detail: 'Internal server error', request_id: c.get('requestId') }, 500)
})

export default app
