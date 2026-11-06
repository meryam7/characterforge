/** Cookie sessions + CSRF tokens.
 * - Session cookie: __Host-session, Secure, HttpOnly, SameSite=Lax, Path=/. Value = random 256-bit token;
 *   the DB stores only its SHA-256, so a database leak doesn't leak usable sessions.
 * - CSRF cookie: __Host-csrf, Secure, SameSite=Strict, readable by JS (double-submit). Every POST/PUT/PATCH/DELETE
 *   must echo it in the X-CSRF-Token header (checked in middleware.ts together with the Origin header). */
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { randomToken, sha256 } from './crypto'
import type { AppEnv, SessionInfo, UserRow } from './env'

export const SESSION_TTL = 30 * 86400 // absolute lifetime
export const SESSION_IDLE = 7 * 86400 // logged out after 7 days without activity
const nowSec = () => Math.floor(Date.now() / 1000)

export async function createSession(c: Context<AppEnv>, userId: number, mfa: boolean) {
  const token = randomToken(32)
  const now = nowSec()
  await c.env.DB.prepare(
    'INSERT INTO sessions (id_hash, user_id, mfa, expires_at, last_seen, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(await sha256(token), userId, mfa ? 1 : 0, now + SESSION_TTL, now, c.get('ipHash') ?? null, (c.req.header('user-agent') ?? '').slice(0, 120))
    .run()
  setCookie(c, 'session', token, { prefix: 'host', httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL })
  issueCsrf(c, true) // rotate the CSRF token at every login
}

export async function loadSession(c: Context<AppEnv>): Promise<{ user: UserRow; session: SessionInfo } | null> {
  const token = getCookie(c, 'session', 'host')
  if (!token || token.length > 100) return null
  const idHash = await sha256(token)
  const row = await c.env.DB.prepare(
    `SELECT s.mfa AS s_mfa, s.expires_at AS s_exp, s.last_seen AS s_seen, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
  )
    .bind(idHash)
    .first<UserRow & { s_mfa: number; s_exp: number; s_seen: number }>()
  const now = nowSec()
  if (!row || row.s_exp < now || row.s_seen < now - SESSION_IDLE) {
    if (row) c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(idHash).run())
    deleteCookie(c, 'session', { prefix: 'host', path: '/', secure: true })
    return null
  }
  if (row.s_seen < now - 600) {
    // sliding idle timeout, written at most every 10 min to save D1 writes
    c.executionCtx.waitUntil(c.env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').bind(now, idHash).run())
  }
  const { s_mfa, s_exp, s_seen: _seen, ...user } = row
  return { user: user as UserRow, session: { idHash, mfa: s_mfa === 1, expiresAt: s_exp } }
}

export async function destroySession(c: Context<AppEnv>) {
  const s = c.get('session')
  if (s) await c.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(s.idHash).run()
  deleteCookie(c, 'session', { prefix: 'host', path: '/', secure: true })
}

/** Ends every session of a user except (optionally) the current one. */
export const revokeSessions = (db: D1Database, userId: number, keepIdHash?: string) =>
  keepIdHash
    ? db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').bind(userId, keepIdHash)
    : db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId)

export function issueCsrf(c: Context<AppEnv>, rotate = false): string {
  const existing = getCookie(c, 'csrf', 'host')
  if (existing && !rotate) return existing
  const token = randomToken(24)
  setCookie(c, 'csrf', token, { prefix: 'host', httpOnly: false, secure: true, sameSite: 'Strict', path: '/', maxAge: SESSION_TTL })
  return token
}

export const csrfCookie = (c: Context<AppEnv>) => getCookie(c, 'csrf', 'host')
