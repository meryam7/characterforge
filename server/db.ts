/** Data access helpers shared by routes: ownership checks, files, history, rate limits, output shapes.
 * ALL SQL uses bound parameters (?). The only interpolations are placeholder lists ('?,?,?') and constant
 * column/clause names - never user input. `npm run check:security` enforces this. */
import type { Context } from 'hono'
import type { ActivityRow, AppEnv, CharacterRow, DesignRow, Env } from './env'
import { fail, now } from './http'
import { logEvent } from './security-log'

// ------------------------------------------------------------------ ownership (object-level authorization)
/** The character if it belongs to the logged-in user; 404 otherwise. Attempts on someone else's row are logged. */
export async function ownedCharacter(c: Context<AppEnv>, id: number): Promise<CharacterRow> {
  const uid = c.get('user').id
  const ch = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ?').bind(id).first<CharacterRow>()
  if (ch && ch.user_id === uid) return ch
  if (ch) await logEvent(c, 'access_denied', 'warn', { detail: { resource: 'character', id } })
  return fail(404, 'Character not found')
}

export async function ownedDesign(c: Context<AppEnv>, id: number): Promise<{ design: DesignRow; character: CharacterRow }> {
  const design = await c.env.DB.prepare('SELECT * FROM designs WHERE id = ?').bind(id).first<DesignRow>()
  if (!design) return fail(404, 'Design not found')
  return { design, character: await ownedCharacter(c, design.character_id) }
}

// ------------------------------------------------------------------ files (images stored in D1)
export const MAX_FILE = 1_500_000 // D1 rows are limited to 2 MB
const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }
export const KEY = /^[drt]\/[a-f0-9]{32}\.(webp|png|jpg)$/

export const fileUrl = (key: string | null) => (key ? `/api/files/${key}` : null)

/** Validates an uploaded image and returns the statement that stores it (run it in a batch). */
export async function prepareFile(db: D1Database, userId: number, prefix: 'd' | 'r' | 't', file: unknown) {
  if (!(file instanceof File)) return fail(422, 'image: file required')
  const ext = TYPES[file.type] ?? fail(415, 'Images must be WebP, PNG or JPEG')
  if (file.size > MAX_FILE) fail(413, 'Image too large (max 1.5 MB)')
  const key = `${prefix}/${crypto.randomUUID().replaceAll('-', '')}.${ext}`
  const data = await file.arrayBuffer()
  const stmt = db.prepare('INSERT INTO files (key, user_id, content_type, data) VALUES (?, ?, ?, ?)').bind(key, userId, file.type, data)
  return { key, stmt }
}

export const deleteFiles = (db: D1Database, keys: (string | null)[]) => {
  const ks = keys.filter((k): k is string => !!k)
  return ks.length ? [db.prepare(`DELETE FROM files WHERE key IN (${ks.map(() => '?').join(',')})`).bind(...ks)] : []
}

// ------------------------------------------------------------------ history
export const ACTIONS = ['created', 'reference', 'generated', 'edited', 'exported', 'published', 'unpublished', 'deleted'] as const
export type Action = (typeof ACTIONS)[number]

export function recordActivity(
  db: D1Database,
  userId: number,
  action: Action,
  ch: { id: number; name: string },
  opts: { designId?: number | null; detail?: string; thumbKey?: string | null } = {},
) {
  return db
    .prepare(
      'INSERT INTO activities (user_id, action, character_id, character_name, design_id, detail, thumb_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(userId, action, ch.id, ch.name, opts.designId ?? null, (opts.detail ?? '').slice(0, 500), opts.thumbKey ?? null)
}

// ------------------------------------------------------------------ rate limiting (fixed window, stored in D1)
/** Durable limiter for sensitive operations (login, register, MFA, AI, uploads). Logs (deduplicated) when it trips. */
export async function rateLimit(c: Context<AppEnv>, key: string, max: number, windowSec: number): Promise<void> {
  const db = c.env.DB
  const nowSec = Math.floor(Date.now() / 1000)
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start <= ?2 - ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(key, nowSec, windowSec)
    .first<{ count: number }>()
  if (row && row.count > max) {
    const { logRateLimited } = await import('./middleware')
    await logRateLimited(c, key)
    fail(429, 'Too many requests - slow down and try again in a minute')
  }
}

export const isAdmin = (env: Env, email: string) =>
  env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())

// ------------------------------------------------------------------ output shapes (mirrored in frontend/src/lib/types.ts)
export function characterOut(ch: CharacterRow, stats: { design_count: number; cover_key: string | null }) {
  return {
    id: ch.id,
    name: ch.name,
    description: ch.description,
    style: ch.style,
    seed: ch.seed,
    embedding: ch.embedding ? (JSON.parse(ch.embedding) as number[]) : null,
    reference_url: fileUrl(ch.reference_key),
    cover_url: fileUrl(stats.cover_key ?? ch.reference_key),
    design_count: stats.design_count,
    created_at: ch.created_at,
  }
}

export const designOut = (d: DesignRow) => ({
  id: d.id,
  character_id: d.character_id,
  parent_id: d.parent_id,
  kind: d.kind,
  source: d.source,
  prompt: d.prompt,
  consistency: d.consistency,
  image_url: fileUrl(d.image_key)!,
  is_public: !!d.is_public,
  created_at: d.created_at,
})

export const activityOut = (a: ActivityRow, alive: Set<number>) => ({
  id: a.id,
  action: a.action,
  character_id: a.character_id,
  character_name: a.character_name,
  design_id: a.design_id,
  detail: a.detail,
  thumb_url: fileUrl(a.thumb_key),
  character_exists: a.character_id !== null && alive.has(a.character_id),
  created_at: a.created_at,
})

export async function characterStats(db: D1Database, id: number) {
  const row = await db
    .prepare(
      'SELECT COUNT(*) AS n, (SELECT image_key FROM designs WHERE character_id = ?1 ORDER BY id DESC LIMIT 1) AS cover FROM designs WHERE character_id = ?1',
    )
    .bind(id)
    .first<{ n: number; cover: string | null }>()
  return { design_count: row?.n ?? 0, cover_key: row?.cover ?? null }
}

export { now }
