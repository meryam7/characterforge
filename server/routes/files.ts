/** Public image endpoint: /api/files/<key>. Keys are random 128-bit ids and never change, so responses are
 * cached forever in the browser and at Cloudflare's edge (saves D1 reads). */
import { Hono } from 'hono'
import { KEY } from '../db'
import type { AppEnv } from '../env'

const r = new Hono<AppEnv>()

r.get('/:prefix{[drt]}/:name', async (c) => {
  const key = `${c.req.param('prefix')}/${c.req.param('name')}`
  if (!KEY.test(key)) return c.json({ detail: 'Not found' }, 404)

  const cache = (caches as unknown as { default: Cache }).default
  const hit = await cache.match(c.req.raw)
  if (hit) return hit

  const row = await c.env.DB.prepare('SELECT content_type, data FROM files WHERE key = ?')
    .bind(key)
    .first<{ content_type: string; data: ArrayBuffer | number[] }>()
  if (!row) return c.json({ detail: 'Not found' }, 404)
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data)
  const res = new Response(body, {
    headers: { 'Content-Type': row.content_type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
  c.executionCtx.waitUntil(cache.put(c.req.raw, res.clone()))
  return res
})

export default r
