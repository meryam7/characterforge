/** Images: /api/files/<key>. Served only to the owner, or to anyone if the image belongs to a design shared in
 * the community gallery. Private images are never cached by shared caches. */
import { Hono } from 'hono'
import { isAdmin, KEY } from '../db'
import type { AppEnv } from '../env'

const r = new Hono<AppEnv>()

const notFound = () => new Response(JSON.stringify({ detail: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

r.get('/:prefix{[drt]}/:name', async (c) => {
  const key = `${c.req.param('prefix')}/${c.req.param('name')}`
  if (!KEY.test(key)) return notFound()
  const db = c.env.DB
  const row = await db.prepare('SELECT user_id, content_type, data FROM files WHERE key = ?')
    .bind(key)
    .first<{ user_id: number; content_type: string; data: ArrayBuffer | number[] }>()
  if (!row) return notFound()
  const viewer = c.get('user')?.id
  const isOwner = viewer === row.user_id
  const isPublic = !isOwner && !!(await db.prepare('SELECT 1 FROM designs WHERE image_key = ? AND is_public = 1').bind(key).first())
  // moderators (admin + MFA session) may see designs that are in the report queue
  const user = c.get('user')
  const isModerator = !isOwner && !isPublic && !!user && isAdmin(c.env, user.email) && !!c.get('session')?.mfa &&
    !!(await db.prepare("SELECT 1 FROM reports r JOIN designs d ON d.id = r.design_id WHERE d.image_key = ? AND r.status = 'open'").bind(key).first())
  if (!isOwner && !isPublic && !isModerator) return notFound() // same answer as "missing": doesn't reveal that the file exists

  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data)
  return new Response(body, {
    headers: {
      'Content-Type': row.content_type,
      'Content-Disposition': 'inline',
      // a stored file can never act as a web page, even if someone uploads a crafted image
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': isOwner ? 'private, max-age=86400' : isPublic ? 'public, max-age=600' : 'private, no-store',
      Vary: 'Cookie',
    },
  })
})

export default r
