/** Email codes: generation, hashing, delivery (Resend or Brevo), checking.
 * Config: EMAIL_PROVIDER = resend | brevo | log, EMAIL_FROM (e.g. "CharaForge <no-reply@yourdomain.com>"),
 * secret EMAIL_API_KEY. "log" (dev/staging only) prints the code to the Functions log instead of sending it.
 * Outside production, codes for @example.com addresses go to the test_inbox table (for automated tests). */
import type { Context } from 'hono'
import { sha256 } from './crypto'
import type { AppEnv, Env } from './env'
import { fail } from './http'

export type CodePurpose = 'verify' | 'reset'
export const CODE_TTL = 15 * 60
export const RESEND_COOLDOWN = 60
const MAX_ATTEMPTS = 5
const nowSec = () => Math.floor(Date.now() / 1000)

const isProd = (env: Env) => env.ENVIRONMENT === 'production'
const isTestAddress = (email: string) => /@example\.com$/i.test(email)

export function newCode(): string {
  // uniform 6 digits (rejection sampling avoids modulo bias)
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= 4_294_000_000)
  return String(n % 1_000_000).padStart(6, '0')
}

const codeHash = (userId: number, purpose: CodePurpose, code: string) => sha256(`${userId}:${purpose}:${code}`)

const TEXT = {
  en: {
    verify: { subject: 'Your CharaForge verification code', intro: 'Welcome to CharaForge! Enter this code to confirm your email address:' },
    reset: { subject: 'Reset your CharaForge password', intro: 'Use this code to choose a new CharaForge password:' },
    expires: 'The code expires in 15 minutes.',
    ignore: "If you didn't ask for this, you can ignore this email: nothing will change on your account.",
  },
  fr: {
    verify: { subject: 'Votre code de vérification CharaForge', intro: "Bienvenue sur CharaForge ! Saisissez ce code pour confirmer votre adresse e-mail :" },
    reset: { subject: 'Réinitialisez votre mot de passe CharaForge', intro: 'Utilisez ce code pour choisir un nouveau mot de passe CharaForge :' },
    expires: 'Le code expire dans 15 minutes.',
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien ne changera sur votre compte.",
  },
}

function render(purpose: CodePurpose, code: string, lang: 'en' | 'fr') {
  const t = TEXT[lang]
  const subject = t[purpose].subject
  const text = `${t[purpose].intro}\n\n${code}\n\n${t.expires}\n${t.ignore}\n\nCharaForge`
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#0b0614;font-family:Arial,sans-serif;color:#ede9fe">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#120a20;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#c4b5fd">CharaForge</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.5">${t[purpose].intro}</td></tr>
<tr><td style="padding:20px 0;font-size:34px;letter-spacing:8px;font-weight:bold;color:#ffffff;text-align:center">${code}</td></tr>
<tr><td style="font-size:13px;color:#a78bfa;line-height:1.5">${t.expires}<br>${t.ignore}</td></tr>
</table></td></tr></table></body></html>`
  return { subject, text, html }
}

async function deliver(env: Env, to: string, msg: { subject: string; text: string; html: string }): Promise<void> {
  const provider = (env.EMAIL_PROVIDER || 'log').toLowerCase()
  const from = env.EMAIL_FROM || 'CharaForge <no-reply@example.com>'
  if (provider === 'log') {
    if (isProd(env)) throw new Error('EMAIL_PROVIDER=log is not allowed in production')
    console.log(JSON.stringify({ t: 'email_log_mode', to: to.replace(/^(.).*@/, '$1***@'), subject: msg.subject, body: msg.text.split('\n')[2] }))
    return
  }
  if (!env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY is not set')
  let res: Response
  if (provider === 'resend') {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: msg.subject, text: msg.text, html: msg.html }),
    })
  } else if (provider === 'brevo') {
    const m = from.match(/^(.*)<(.+)>$/)
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.EMAIL_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: m ? { name: m[1].trim(), email: m[2].trim() } : { email: from },
        to: [{ email: to }], subject: msg.subject, textContent: msg.text, htmlContent: msg.html,
      }),
    })
  } else {
    throw new Error(`Unknown EMAIL_PROVIDER "${provider}"`)
  }
  if (!res.ok) throw new Error(`Email provider error ${res.status}`) // body not logged: may echo the address
}

/** Creates a fresh code (older ones of the same purpose are deleted) and sends it. Enforces the resend cooldown. */
export async function sendCode(
  c: Context<AppEnv>, user: { id: number; email: string }, purpose: CodePurpose, lang: 'en' | 'fr',
  opts: { reuseRecent?: boolean } = {},
) {
  const db = c.env.DB
  const last = await db.prepare('SELECT created_at FROM email_codes WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .bind(user.id, purpose)
    .first<{ created_at: number }>()
  if (last && last.created_at > nowSec() - RESEND_COOLDOWN) {
    if (opts.reuseRecent) return // a code was just sent and is still valid: don't spam the inbox, don't error
    fail(429, 'Please wait a minute before asking for a new code', { retry_after: RESEND_COOLDOWN - (nowSec() - last.created_at) })
  }
  const code = newCode()
  const now = nowSec()
  const stmts = [
    db.prepare('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?').bind(user.id, purpose),
    db.prepare('INSERT INTO email_codes (user_id, purpose, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, purpose, await codeHash(user.id, purpose, code), now + CODE_TTL, now),
  ]
  const testInbox = !isProd(c.env) && isTestAddress(user.email)
  if (testInbox) stmts.push(db.prepare('INSERT INTO test_inbox (email, purpose, code) VALUES (?, ?, ?)').bind(user.email.toLowerCase(), purpose, code))
  await db.batch(stmts)
  if (testInbox) return
  try {
    await deliver(c.env, user.email, render(purpose, code, lang))
  } catch (err) {
    console.error(JSON.stringify({ t: 'email_error', purpose, error: String(err).slice(0, 200) }))
    fail(503, "We couldn't send the email right now. Please try again in a few minutes.")
  }
}

/** True if the code is right (and consumes it). Wrong codes count attempts; 5 wrong attempts burn the code. */
export async function checkCode(db: D1Database, userId: number, purpose: CodePurpose, code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return false
  const row = await db.prepare('SELECT id, code_hash, attempts, expires_at FROM email_codes WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1')
    .bind(userId, purpose)
    .first<{ id: number; code_hash: string; attempts: number; expires_at: number }>()
  if (!row || row.expires_at < nowSec() || row.attempts >= MAX_ATTEMPTS) return false
  if (row.code_hash !== (await codeHash(userId, purpose, code.trim()))) {
    await db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run()
    return false
  }
  await db.prepare('DELETE FROM email_codes WHERE id = ?').bind(row.id).run()
  return true
}

export const pickLang = (v: unknown): 'en' | 'fr' => (v === 'fr' ? 'fr' : 'en')
