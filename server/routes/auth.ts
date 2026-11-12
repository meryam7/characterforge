/** Authentication: registration, password login, MFA (TOTP + recovery codes), sessions, account management.
 *
 * Login flow:
 *   POST /login {email,password}
 *     → {status:"ok", user}                        (no MFA)            + session cookie
 *     → {status:"mfa_required", challenge}         (MFA enabled)       → POST /mfa/verify {challenge, code}
 *     → {status:"mfa_enrol_required", challenge}   (admin without MFA) → POST /mfa/enrol/start, /mfa/enrol/finish
 *     → {status:"verify_email_required", challenge, email} (email not confirmed yet) → POST /email/verify {challenge, code}
 * Sign-up always ends in "verify_email_required": a 6-digit code is emailed and the account gets no session until the
 * owner of the inbox types it (proves the email address belongs to them). Admins can never get a session without MFA. */
import type { Context } from 'hono'
import { Hono } from 'hono'
import { decryptSecret, encryptSecret, randomToken, sha256 } from '../crypto'
import { isAdmin, rateLimit } from '../db'
import type { AppEnv, UserRow } from '../env'
import { EMAIL, fail, jsonBody, str } from '../http'
import { logEvent } from '../security-log'
import { checkCode, pickLang, sendCode } from '../email'
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from '../security'
import { createSession, destroySession, issueCsrf, revokeSessions } from '../session'
import { newTotpSecret, otpauthUri, verifyTotp } from '../totp'

const CHALLENGE_TTL = 300
const EMAIL_CHALLENGE_TTL = 30 * 60 // time to open the mailbox and type the code
/** Version of the Terms of Use + Privacy Policy users accept at sign-up (frontend/src/lib/legal.ts LEGAL_VERSION). */
export const TERMS_VERSION = '2026-11-10'
const nowSec = () => Math.floor(Date.now() / 1000)

export const userOut = (c: Context<AppEnv>, u: UserRow) => ({
  id: u.id,
  email: u.email,
  display_name: u.display_name,
  is_admin: isAdmin(c.env, u.email),
  mfa_enabled: !!u.mfa_enabled,
  mfa_verified: !!c.get('session')?.mfa,
  email_verified: !!u.email_verified,
  created_at: u.created_at,
})

const auth = new Hono<AppEnv>()

// ------------------------------------------------------------------ helpers
type ChallengeKind = 'mfa_verify' | 'mfa_enrol' | 'email_verify'

async function newChallenge(c: Context<AppEnv>, userId: number, kind: ChallengeKind) {
  const token = randomToken(32)
  await c.env.DB.prepare('INSERT INTO auth_challenges (id_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, kind, nowSec() + (kind === 'email_verify' ? EMAIL_CHALLENGE_TTL : CHALLENGE_TTL))
    .run()
  return token
}

/** Loads a live challenge and counts the attempt (max 5). */
async function useChallenge(c: Context<AppEnv>, token: unknown, kind: ChallengeKind): Promise<UserRow & { ch_hash: string }> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return fail(401, 'Login expired - start again')
  const hash = await sha256(token)
  const row = await c.env.DB.prepare(
    `UPDATE auth_challenges SET attempts = attempts + 1 WHERE id_hash = ? AND kind = ? AND expires_at > ? AND attempts < 5
     RETURNING user_id`,
  )
    .bind(hash, kind, nowSec())
    .first<{ user_id: number }>()
  if (!row) return fail(401, 'Login expired or too many attempts - start again')
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first<UserRow>()
  if (!user) return fail(401, 'Login expired - start again')
  return { ...user, ch_hash: hash }
}

/** a***@gmail.com: enough for the user to recognise the address, without echoing it in full. */
const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, (_, a: string, d: string) => `${a}***${d}`)

/** After the password (or a code) is accepted: next required step, or a session. Order: email → MFA → session. */
async function nextStep(c: Context<AppEnv>, user: UserRow, lang: 'en' | 'fr', status = 200) {
  if (!user.email_verified) {
    const devCode = await sendCode(c, user, 'verify', lang, { reuseRecent: true })
    return c.json(
      { status: 'verify_email_required', challenge: await newChallenge(c, user.id, 'email_verify'), email: maskEmail(user.email), dev_code: devCode },
      status as 200,
    )
  }
  if (isAdmin(c.env, user.email) && !user.mfa_enabled) {
    return c.json({ status: 'mfa_enrol_required', challenge: await newChallenge(c, user.id, 'mfa_enrol') }, status as 200)
  }
  if (user.mfa_enabled) {
    return c.json({ status: 'mfa_required', challenge: await newChallenge(c, user.id, 'mfa_verify') }, status as 200)
  }
  await createSession(c, user.id, false)
  await logEvent(c, 'login_success', 'info', { userId: user.id })
  return c.json({ status: 'ok', user: userOut(c, user) }, status as 200)
}

const mfaKey = (c: Context<AppEnv>) => c.env.MFA_ENCRYPTION_KEY || fail(500, 'Server misconfigured: MFA key missing')

/** TOTP code or one-time recovery code. Returns which one matched, or null. */
async function checkSecondFactor(c: Context<AppEnv>, user: UserRow, code: unknown): Promise<'totp' | 'recovery' | null> {
  if (typeof code !== 'string' || !user.mfa_secret) return null
  const clean = code.trim().toLowerCase()
  if (/^\d{6}$/.test(clean)) {
    const step = await verifyTotp(await decryptSecret(user.mfa_secret, mfaKey(c)), clean, user.mfa_last_step)
    if (step === null) return null
    await c.env.DB.prepare('UPDATE users SET mfa_last_step = ? WHERE id = ?').bind(step, user.id).run()
    return 'totp'
  }
  if (/^[a-z2-7]{5}-[a-z2-7]{5}$/.test(clean)) {
    const used = await c.env.DB.prepare(
      `UPDATE mfa_recovery_codes SET used_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE user_id = ? AND code_hash = ? AND used_at IS NULL RETURNING user_id`,
    )
      .bind(user.id, await sha256(clean))
      .first()
    return used ? 'recovery' : null
  }
  return null
}

function recoveryCodes(): string[] {
  const abc = 'abcdefghijklmnopqrstuvwxyz234567'
  return Array.from({ length: 10 }, () => {
    const b = crypto.getRandomValues(new Uint8Array(10))
    const s = [...b].map((x) => abc[x & 31]).join('')
    return `${s.slice(0, 5)}-${s.slice(5)}`
  })
}

async function enableMfa(c: Context<AppEnv>, user: UserRow) {
  const codes = recoveryCodes()
  const db = c.env.DB
  await db.batch([
    db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').bind(user.id),
    db.prepare('DELETE FROM mfa_recovery_codes WHERE user_id = ?').bind(user.id),
    ...(await Promise.all(codes.map(async (code) =>
      db.prepare('INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)').bind(user.id, await sha256(code))))),
    revokeSessions(db, user.id), // every older session must log in again with MFA
  ])
  await logEvent(c, 'mfa_enabled', 'info', { userId: user.id })
  return codes
}

async function startEnrolment(c: Context<AppEnv>, user: UserRow) {
  const secret = newTotpSecret()
  await c.env.DB.prepare('UPDATE users SET mfa_secret = ?, mfa_enabled = 0, mfa_last_step = 0 WHERE id = ?')
    .bind(await encryptSecret(secret, mfaKey(c)), user.id)
    .run()
  // shown once so the user can scan it; never logged
  return { secret, otpauth_uri: otpauthUri(secret, user.email) }
}

async function requirePassword(c: Context<AppEnv>, user: UserRow, password: unknown) {
  if (typeof password !== 'string' || !(await verifyPassword(password, user.password_hash))) {
    await logEvent(c, 'reauth_failed', 'warn', { userId: user.id })
    fail(401, 'Wrong password')
  }
}

// ------------------------------------------------------------------ public
auth.get('/csrf', (c) => c.json({ csrf: issueCsrf(c) }))

auth.post('/register', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254, pattern: EMAIL }).toLowerCase()
  const name = str(body.display_name, 'display name', { min: 2, max: 40 })
  const problem = passwordProblem(body.password, email)
  if (problem) fail(422, problem)
  if (body.accept_terms !== true) fail(422, 'accept_terms: you must accept the Terms of Use and Privacy Policy')
  await rateLimit(c, `register:${c.get('ipHash')}`, Number(c.env.SIGNUP_LIMIT_PER_HOUR || 20), 3600)
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) {
    fail(409, "An account with this email already exists. If it's yours, use \"Forgot password?\"")
  }
  const user = await c.env.DB.prepare(
    "INSERT INTO users (email, display_name, password_hash, terms_version, terms_accepted_at) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING *",
  )
    .bind(email, name, await hashPassword(body.password as string), TERMS_VERSION)
    .first<UserRow>()
  await logEvent(c, 'account_created', 'info', { userId: user!.id })
  // no session yet: the code sent by email must be confirmed first
  return nextStep(c, user!, pickLang(body.lang), 201)
})

auth.post('/login', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254 }).toLowerCase()
  await rateLimit(c, `login-ip:${c.get('ipHash')}`, 60, 600)
  await rateLimit(c, `login-email:${await sha256(email)}`, 10, 600)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  const ok = await verifyPassword(typeof body.password === 'string' ? body.password : '', user?.password_hash ?? DUMMY_HASH)
  if (!user || !ok) {
    await logEvent(c, 'login_failed', 'warn', { userId: user?.id ?? null, subject: email, detail: { known_account: !!user } })
    fail(401, 'Wrong email or password')
  }
  return nextStep(c, user!, pickLang(body.lang))
})

// ------------------------------------------------------------------ email ownership
auth.post('/email/verify', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await useChallenge(c, body.challenge, 'email_verify')
  await rateLimit(c, `email-code:${user.id}`, 20, 3600)
  if (!(await checkCode(c.env.DB, user.id, 'verify', body.code))) {
    await logEvent(c, 'email_code_failed', 'warn', { userId: user.id, subject: user.email })
    fail(401, 'Wrong or expired code')
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM auth_challenges WHERE id_hash = ?').bind(user.ch_hash),
  ])
  await logEvent(c, 'email_verified', 'info', { userId: user.id })
  return nextStep(c, { ...user, email_verified: 1 }, pickLang(body.lang))
})

auth.post('/email/resend', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await useChallenge(c, body.challenge, 'email_verify')
  await rateLimit(c, `email-send:${user.id}`, 5, 3600)
  await rateLimit(c, `email-send-ip:${c.get('ipHash')}`, 20, 3600)
  const devCode = await sendCode(c, user, 'verify', pickLang(body.lang))
  return c.json({ ok: true, dev_code: devCode })
})

// ------------------------------------------------------------------ forgot / reset password (code by email)
/** Always answers the same way, so it can't be used to find out which emails have an account. */
auth.post('/password/forgot', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254 }).toLowerCase()
  await rateLimit(c, `forgot-ip:${c.get('ipHash')}`, 10, 3600)
  await rateLimit(c, `forgot:${await sha256(email)}`, 3, 3600)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (user) {
    try {
      await sendCode(c, user, 'reset', pickLang(body.lang))
    } catch {
      /* cooldown or provider error: same answer either way */
    }
    await logEvent(c, 'password_reset_requested', 'info', { userId: user.id })
  }
  return c.json({ ok: true })
})

auth.post('/password/reset', async (c) => {
  const body = await jsonBody(c.req.raw)
  const email = str(body.email, 'email', { max: 254 }).toLowerCase()
  await rateLimit(c, `reset-ip:${c.get('ipHash')}`, 30, 3600)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (!user || !(await checkCode(c.env.DB, user.id, 'reset', body.code))) {
    await logEvent(c, 'password_reset_failed', 'warn', { userId: user?.id ?? null, subject: email })
    fail(400, 'Wrong or expired code')
  }
  const problem = passwordProblem(body.new_password, email)
  if (problem) fail(422, problem)
  await c.env.DB.batch([
    // receiving the code also proves the address is theirs
    c.env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'), email_verified = 1 WHERE id = ?")
      .bind(await hashPassword(body.new_password as string), user!.id),
    revokeSessions(c.env.DB, user!.id), // log out everywhere (a thief's session too)
  ])
  await logEvent(c, 'password_reset', 'warn', { userId: user!.id })
  return c.json({ ok: true }) // MFA (if enabled) is still required at the next login
})

auth.post('/mfa/verify', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await useChallenge(c, body.challenge, 'mfa_verify')
  await rateLimit(c, `mfa:${user.id}`, 20, 600)
  const factor = await checkSecondFactor(c, user, body.code)
  if (!factor) {
    await logEvent(c, 'mfa_failed', 'warn', { userId: user.id, subject: user.email })
    fail(401, 'Wrong code')
  }
  await c.env.DB.prepare('DELETE FROM auth_challenges WHERE id_hash = ?').bind(user.ch_hash).run()
  await createSession(c, user.id, true)
  await logEvent(c, factor === 'recovery' ? 'recovery_code_used' : isAdmin(c.env, user.email) ? 'admin_login' : 'login_success', 'info', {
    userId: user.id, detail: { mfa: factor },
  })
  c.set('session', { idHash: '', mfa: true, expiresAt: 0 })
  return c.json({ status: 'ok', user: userOut(c, { ...user, mfa_enabled: 1 }) })
})

auth.post('/mfa/enrol/start', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await useChallenge(c, body.challenge, 'mfa_enrol')
  return c.json(await startEnrolment(c, user))
})

auth.post('/mfa/enrol/finish', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await useChallenge(c, body.challenge, 'mfa_enrol')
  if (!(await checkSecondFactor(c, user, body.code))) {
    await logEvent(c, 'mfa_failed', 'warn', { userId: user.id, subject: user.email, detail: { during: 'enrolment' } })
    fail(401, 'Wrong code - check the time on your phone and try again')
  }
  const codes = await enableMfa(c, user)
  await c.env.DB.prepare('DELETE FROM auth_challenges WHERE id_hash = ?').bind(user.ch_hash).run()
  await createSession(c, user.id, true)
  c.set('session', { idHash: '', mfa: true, expiresAt: 0 })
  return c.json({ status: 'ok', user: userOut(c, { ...user, mfa_enabled: 1 }), recovery_codes: codes })
})

// ------------------------------------------------------------------ logged in (authorize middleware guarantees a user)
auth.get('/me', (c) => c.json(userOut(c, c.get('user'))))

auth.post('/logout', async (c) => {
  await destroySession(c)
  return c.json({ ok: true })
})

/** Sign out of every other device. */
auth.post('/sessions/revoke', async (c) => {
  await revokeSessions(c.env.DB, c.get('user').id, c.get('session').idHash).run()
  await logEvent(c, 'sessions_revoked', 'info')
  return c.json({ ok: true })
})

auth.post('/password', async (c) => {
  const user = c.get('user')
  const body = await jsonBody(c.req.raw)
  await rateLimit(c, `reauth:${user.id}`, 10, 600)
  await requirePassword(c, user, body.current_password)
  const problem = passwordProblem(body.new_password, user.email)
  if (problem) fail(422, problem)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?")
      .bind(await hashPassword(body.new_password as string), user.id),
    revokeSessions(c.env.DB, user.id, c.get('session').idHash),
  ])
  await logEvent(c, 'password_changed', 'info')
  return c.json({ ok: true })
})

/** Optional MFA for everyone (mandatory for admins). Step 1: get a secret to scan. */
auth.post('/mfa/setup', async (c) => {
  const user = c.get('user')
  if (user.mfa_enabled) fail(409, 'MFA is already enabled')
  await rateLimit(c, `mfa:${user.id}`, 20, 600)
  return c.json(await startEnrolment(c, user))
})

/** Step 2: confirm with a code from the app. Returns 10 one-time recovery codes (shown once). */
auth.post('/mfa/enable', async (c) => {
  const body = await jsonBody(c.req.raw)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.get('user').id).first<UserRow>()
  if (!user || user.mfa_enabled) fail(409, 'MFA is already enabled')
  await rateLimit(c, `mfa:${user!.id}`, 20, 600)
  if (!(await checkSecondFactor(c, user!, body.code))) {
    await logEvent(c, 'mfa_failed', 'warn', { userId: user!.id, subject: user!.email, detail: { during: 'setup' } })
    fail(401, 'Wrong code - check the time on your phone and try again')
  }
  const codes = await enableMfa(c, user!)
  await createSession(c, user!.id, true) // the current session was revoked with the others; issue a fresh MFA one
  c.set('session', { idHash: '', mfa: true, expiresAt: 0 })
  return c.json({ user: userOut(c, { ...user!, mfa_enabled: 1 }), recovery_codes: codes })
})

auth.post('/mfa/disable', async (c) => {
  const user = c.get('user')
  if (isAdmin(c.env, user.email)) fail(403, 'Admins cannot turn off MFA')
  const body = await jsonBody(c.req.raw)
  await rateLimit(c, `mfa:${user.id}`, 20, 600)
  await requirePassword(c, user, body.password)
  if (!(await checkSecondFactor(c, user, body.code))) {
    await logEvent(c, 'mfa_failed', 'warn', { subject: user.email, detail: { during: 'disable' } })
    fail(401, 'Wrong code')
  }
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_last_step = 0 WHERE id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM mfa_recovery_codes WHERE user_id = ?').bind(user.id),
  ])
  await logEvent(c, 'mfa_disabled', 'warn')
  return c.json({ ok: true })
})

/** Permanently delete the account (password + MFA code if enabled). */
auth.delete('/me', async (c) => {
  const user = c.get('user')
  const body = await jsonBody(c.req.raw)
  await rateLimit(c, `reauth:${user.id}`, 10, 600)
  await requirePassword(c, user, body.password)
  if (user.mfa_enabled && !(await checkSecondFactor(c, user, body.code))) fail(401, 'Wrong MFA code')
  const uid = user.id
  const db = c.env.DB
  await db.batch([
    db.prepare('DELETE FROM designs WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)').bind(uid),
    db.prepare('DELETE FROM characters WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM activities WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM files WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
    db.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ])
  await logEvent(c, 'account_deleted', 'info', { userId: uid })
  await destroySession(c)
  return c.json({ ok: true })
})

export default auth
