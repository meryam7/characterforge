/** Request pipeline (order matters, see app.ts):
 *  requestContext → securityHeaders → bodyLimit → generalRateLimit → csrfProtection → authenticate → authorize
 * Every request is logged (one JSON line, no bodies/headers/secrets) and checked against an explicit allow-list:
 * anything not public requires a valid session; /api/admin/* also requires an admin with an MFA-verified session. */
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { pseudonym, safeEqual } from './crypto'
import { isAdmin } from './db'
import type { AppEnv } from './env'
import { fail } from './http'
import { logEvent } from './security-log'
import { csrfCookie, issueCsrf, loadSession } from './session'

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Routes reachable without logging in. Everything else is denied by default. */
const PUBLIC: [string, RegExp][] = [
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/auth\/csrf$/],
  ['POST', /^\/api\/auth\/(register|login)$/],
  ['POST', /^\/api\/auth\/mfa\/(verify|enrol\/start|enrol\/finish)$/], // need a short-lived login challenge instead
  ['GET', /^\/api\/gallery$/],
  ['GET', /^\/api\/files\/[drt]\/[a-f0-9]{32}\.(webp|png|jpg)$/], // owner or public design only (checked in route)
]

export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const started = Date.now()
  const rid = crypto.randomUUID()
  c.set('requestId', rid)
  c.set('ipHash', await pseudonym(c.req.header('cf-connecting-ip') ?? 'local', c.env.LOG_HASH_SALT || 'dev'))
  try {
    await next()
  } finally {
    c.header('X-Request-Id', rid)
    // one line per request: no query string, no bodies, no headers, no cookies
    console.log(JSON.stringify({
      t: 'req', rid, env: c.env.ENVIRONMENT, m: c.req.method, p: new URL(c.req.url).pathname.slice(0, 120),
      s: c.res.status, u: c.get('user')?.id ?? null, ip: c.get('ipHash'), ms: Date.now() - started,
    }))
  }
})

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  const h = c.res.headers
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  h.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store')
})

// ------------------------------------------------------------------ cheap per-isolate limiter for every request
const hits = new Map<string, { start: number; n: number }>()
function bump(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const e = hits.get(key)
  if (!e || now - e.start > windowMs) {
    hits.set(key, { start: now, n: 1 })
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k)
    return true
  }
  e.n++
  return e.n <= max
}

const lastLogged = new Map<string, number>()
/** Log a rate-limit event at most once per minute per key (avoids write amplification during floods). */
export async function logRateLimited(c: Context<AppEnv>, key: string) {
  const now = Date.now()
  if ((lastLogged.get(key) ?? 0) > now - 60_000) return
  lastLogged.set(key, now)
  await logEvent(c, 'rate_limited', 'warn', { subject: key.split(':')[0], detail: { limit: key.split(':')[0] } })
}

export const generalRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const key = `api-ip:${c.get('ipHash')}`
  if (!bump(key, 300, 60_000)) {
    await logRateLimited(c, key)
    return c.json({ detail: 'Too many requests - slow down and try again in a minute' }, 429)
  }
  await next()
})

export const csrfProtection = createMiddleware<AppEnv>(async (c, next) => {
  if (UNSAFE.has(c.req.method)) {
    const origin = c.req.header('origin')
    const expected = new URL(c.req.url).origin
    const cookie = csrfCookie(c)
    const header = c.req.header('x-csrf-token') ?? ''
    const badOrigin = origin !== undefined && origin !== expected
    if (badOrigin || !cookie || !safeEqual(cookie, header)) {
      await logEvent(c, 'csrf_failed', 'warn', { detail: { method: c.req.method, reason: badOrigin ? 'origin' : 'token' } })
      return c.json({ detail: 'Security check failed - reload the page and try again' }, 403)
    }
  } else {
    issueCsrf(c) // make sure the browser has a CSRF token before its first POST
  }
  await next()
})

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const s = await loadSession(c)
  if (s) {
    c.set('user', s.user)
    c.set('session', s.session)
  }
  await next()
})

export const authorize = createMiddleware<AppEnv>(async (c, next) => {
  const path = new URL(c.req.url).pathname
  const isPublic = PUBLIC.some(([m, re]) => m === c.req.method && re.test(path))
  const user = c.get('user')
  if (!isPublic && !user) fail(401, 'Please log in')
  if (path.startsWith('/api/admin/')) {
    if (!user || !isAdmin(c.env, user.email)) {
      await logEvent(c, 'access_denied', 'warn', { detail: { area: 'admin' } })
      fail(404, 'Not found')
    }
    if (!c.get('session').mfa) fail(403, 'Admin area requires a session verified with MFA - log in again')
  }
  await next()
})

/** For routes that need the logged-in user (always true after authorize for non-public routes). */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) fail(401, 'Please log in')
  await next()
})
