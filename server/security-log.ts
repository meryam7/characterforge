/** Security event log + anomaly alerts.
 * Events go to D1 (security_events) and to the Functions log stream as JSON. Values under sensitive keys
 * (password, token, secret, code, cookie, authorization, key...) are always replaced by "[redacted]". */
import type { Context } from 'hono'
import { pseudonym } from './crypto'
import type { AppEnv } from './env'

export type Severity = 'info' | 'warn' | 'alert'

const SENSITIVE = /pass|token|secret|code|cookie|authori[sz]ation|api.?key|otp|session|csrf/i

/** Deep copy with sensitive values removed and long strings truncated. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]'
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1)
    return out
  }
  return value
}

/** Rules: when `type` events for the same subject/ip reach `threshold` within `window` seconds -> alert. */
const RULES: { type: string; by: 'subject' | 'ip_hash'; window: number; threshold: number; alert: string; text: string }[] = [
  { type: 'login_failed', by: 'subject', window: 600, threshold: 5, alert: 'brute_force_account', text: '5 failed logins on one account in 10 min' },
  { type: 'login_failed', by: 'ip_hash', window: 600, threshold: 20, alert: 'brute_force_ip', text: '20 failed logins from one IP in 10 min' },
  { type: 'mfa_failed', by: 'subject', window: 600, threshold: 5, alert: 'mfa_brute_force', text: '5 wrong MFA codes on one account in 10 min' },
  { type: 'access_denied', by: 'ip_hash', window: 600, threshold: 10, alert: 'idor_probe', text: "10 attempts to access other users' data in 10 min" },
  { type: 'csrf_failed', by: 'ip_hash', window: 600, threshold: 5, alert: 'csrf_attack_suspected', text: '5 CSRF failures from one IP in 10 min' },
  { type: 'rate_limited', by: 'ip_hash', window: 600, threshold: 10, alert: 'abuse_suspected', text: 'one IP keeps hitting rate limits' },
]
/** These are alerts on their own. */
const ALWAYS_ALERT = new Set(['recovery_code_used', 'mfa_disabled', 'admin_takedown'])

const nowSec = () => Math.floor(Date.now() / 1000)

export async function logEvent(
  c: Context<AppEnv>,
  type: string,
  severity: Severity,
  opts: { userId?: number | null; subject?: string | null; detail?: Record<string, unknown> } = {},
) {
  const db = c.env.DB
  const ts = nowSec()
  const subject = opts.subject ? await pseudonym(opts.subject, c.env.LOG_HASH_SALT) : null
  const ipHash = c.get('ipHash') ?? null
  const userId = opts.userId ?? c.get('user')?.id ?? null
  const detail = JSON.stringify(redact(opts.detail ?? {}))
  const path = new URL(c.req.url).pathname.slice(0, 120)
  const sev: Severity = ALWAYS_ALERT.has(type) ? 'alert' : severity
  console.log(JSON.stringify({ t: 'security', env: c.env.ENVIRONMENT, type, sev, user: userId, subject, ip: ipHash, path, rid: c.get('requestId'), detail: JSON.parse(detail) }))
  try {
    await db
      .prepare('INSERT INTO security_events (ts, type, severity, user_id, subject, ip_hash, path, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(ts, type, sev, userId, subject, ipHash, path, detail)
      .run()
    if (sev === 'alert') notify(c, type, `${type} (user ${userId ?? '-'})`)
    for (const rule of RULES.filter((r) => r.type === type)) {
      const key = rule.by === 'subject' ? subject : ipHash
      if (!key) continue
      const row = await db
        .prepare(`SELECT COUNT(*) AS n FROM security_events WHERE type = ? AND ${rule.by} = ? AND ts > ?`)
        .bind(type, key, ts - rule.window)
        .first<{ n: number }>()
      if (row?.n === rule.threshold) {
        // fire once when the threshold is crossed
        await db
          .prepare('INSERT INTO security_events (ts, type, severity, user_id, subject, ip_hash, path, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(ts, rule.alert, 'alert', userId, subject, ipHash, path, JSON.stringify({ rule: rule.text, count: row.n }))
          .run()
        console.log(JSON.stringify({ t: 'security', env: c.env.ENVIRONMENT, type: rule.alert, sev: 'alert', subject, ip: ipHash, rule: rule.text }))
        notify(c, rule.alert, rule.text)
      }
    }
    if (Math.random() < 0.01) {
      // retention: 90 days
      c.executionCtx.waitUntil(db.prepare('DELETE FROM security_events WHERE ts < ?').bind(ts - 90 * 86400).run())
    }
  } catch (err) {
    console.error(JSON.stringify({ t: 'security_log_error', error: String(err) }))
  }
}

/** Optional webhook (Discord/Slack compatible). Message contains no personal data or secrets. */
function notify(c: Context<AppEnv>, type: string, text: string) {
  const url = c.env.ALERT_WEBHOOK_URL
  if (!url) return
  const message = `[CharaForge ${c.env.ENVIRONMENT}] SECURITY ALERT ${type}: ${text} at ${new Date().toISOString()}`
  c.executionCtx.waitUntil(
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message, text: message }) })
      .then(() => undefined)
      .catch((err) => console.error(JSON.stringify({ t: 'alert_webhook_error', error: String(err) }))),
  )
}
