# Security

How CharaForge is protected, where each control lives, and how it is tested.
Run the checks: `npm run check:security` (static), `npm run test:security` (78 live checks; run against staging).

## Controls

| Requirement | Implementation | Tested by |
|---|---|---|
| **Secrets only on the backend** | Cloudflare Pages encrypted secrets per environment (`MFA_ENCRYPTION_KEY`, `LOG_HASH_SALT`, `ALERT_WEBHOOK_URL`). Read only in `server/` via `c.env`. The frontend has no secrets (`VITE_SITE_URL` is public). Locally they come from `.dev.vars` (git-ignored) | `check-security.mjs` fails if a secret name, token, webhook or server-only field appears in `frontend/dist` |
| **Authentication** | email + password (PBKDF2-SHA256 100k, unique salt, constant-time compare, dummy hash for unknown emails, 10+ chars, common-password list) → server-side **session** (`server/session.ts`) | smoke + security tests |
| **Session cookies** | `__Host-session`: Secure, HttpOnly, SameSite=Lax, Path=/, 30 d absolute, 7 d idle. Only the SHA-256 of the token is stored. Rotated at login, deleted at logout. Password change and MFA enable revoke other sessions | "session cookie flags", "logged-out session token is dead", "other sessions revoked" |
| **CSRF** | double-submit `__Host-csrf` (Secure, SameSite=Strict) → `X-CSRF-Token` on every POST/PUT/PATCH/DELETE + `Origin` check (`middleware.csrfProtection`). No state-changing GETs. JSON endpoints require `application/json` | "POST without CSRF token", "forged token", "cross-site Origin" |
| **MFA** | TOTP (RFC 6238, ±1 step, replay guard via `mfa_last_step`), secrets AES-256-GCM encrypted at rest, 10 one-time recovery codes (SHA-256). **Mandatory for admins**: an admin never gets a session without it (enrolment at first login). Login challenges: 5 min, 5 attempts | full MFA block of `security-test.mjs` + browser test |
| **Authorization on every request** | deny-by-default: `middleware.authorize` lets only the `PUBLIC` list through without a session (matched on the decoded router path). `/api/admin/*` needs admin + MFA session, checked globally **and** inside the admin router. Object level: every row goes through `ownedCharacter`/`ownedDesign` (404, logged as `access_denied`). Images are served only to the owner or for shared designs | "anonymous … -> 401", 12 IDOR probes, encoded admin paths |
| **Users only see their own data** | all queries are scoped to `user_id`. The gallery shows only opted-in designs and display names (never emails). History, characters, files and AI are per user | IDOR + "gallery never exposes emails" |
| **Input validation** | `server/http.ts`: types, lengths, patterns, Unicode NFC, control/bidi characters stripped, positive integers only, JSON content type, 4 MB body limit, image MIME whitelist + 1.5 MB, strict base64/mask validation for AI | validation block (422/413/415) |
| **Parameterized queries** | every query uses `prepare('… ?').bind(…)`. The only interpolations are `?` placeholder lists and constant clauses | `check-security.mjs` (fails on any other interpolation, verified with a planted injection) + SQL-payload tests |
| **XSS / output encoding** | React escapes all text output. No `dangerouslySetInnerHTML`/`innerHTML`/`eval`. Strict CSP (`frontend/public/_headers`: `script-src 'self'`, no inline/eval, `object-src 'none'`, `frame-ancestors 'none'`). API: JSON + `nosniff` + `CSP default-src 'none'`. Stored files: `CSP sandbox` | static scan, browser test (payload `<img onerror>` stored and shown as text, never executed, 0 CSP violations) |
| **HTTPS** | Cloudflare terminates TLS. HTTP redirects to HTTPS. HSTS 2 years + preload. `upgrade-insecure-requests`. `__Host-` cookies require HTTPS | "HTTP redirects to HTTPS", "HSTS" |
| **Rate limiting** | per IP on every API call (300/min, in memory) + D1-backed limits: login 60/10 min per IP and 10/10 min per account, sign-up 20/h per IP, MFA 20/10 min, AI 6/min + daily quota, uploads 60/min. Keys are hashed | "login brute force -> 429" |
| **Security logs & alerts** | `server/security-log.ts`: events (login ok/failed, MFA, CSRF, access denied, rate limited, password/MFA changes, admin actions, deletions) in `security_events` + one JSON log line per request (request id, path, status, user id, hashed IP; no bodies, headers or cookies). Redaction of any password/token/secret/code/cookie keys. IPs and emails are keyed hashes. **Alerts** when thresholds are crossed (brute force per account/IP, MFA guessing, IDOR probing, CSRF, abuse) and for recovery-code use, MFA disable and admin takedowns, written as `alert` events and sent to `ALERT_WEBHOOK_URL` if set. Admin console: Settings → Security | "brute force raised an alert", "security log contains no passwords, MFA secrets, codes, session tokens or emails" |
| **Dependencies** | `npm run audit` in CI (fails on high/critical), Dependabot weekly (`.github/dependabot.yml`), lockfiles committed | 2026-11-06: Vite 5→7.3.7 fixed 1 high + 1 moderate (dev server only). Both packages 0 vulnerabilities |
| **Backups** | daily encrypted (AES-256-GCM, scrypt key) D1 exports + D1 Time Travel. Restore tested in a scratch database. See `BACKUP.md` | `restore-test.mjs` (counts, image bytes, fingerprint, integrity) |
| **Testing environment** | staging = separate Pages environment, D1 database and secrets. Every change goes staging → tests → production (`DEPLOY.md`) | CI `staging` job |

## Security review: 2026-11-06 (commit 6f5e0f4)
Reviewed: sessions, CSRF, MFA flows, authorization, files, admin, SQL, logging, crypto.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | **Admin authorization bypass via percent-encoded path.** `authorize` checked `/api/admin/` on the raw URL, but the router decodes paths, so `GET /api/%61dmin/security/summary` returned the security console to any logged-in user (confirmed on staging) | Medium (data exposure: security log, user counts) | **Fixed**: authorization uses the decoded `c.req.path`, and the admin router re-checks admin + MFA itself. Regression test with 4 encoded or odd paths. Never reached production (it shipped only to staging) |

Examined and found sound: MFA enrolment cannot overwrite an enabled factor; challenges are single-purpose, expire, and are attempt-limited atomically; no session fixation (cookies rotated at login); recovery codes are 50-bit random, hashed and consumed atomically; file access is checked against ownership and public designs; all SQL is bound; logs hold no secrets or raw PII.

## Accepted risks / follow-ups
- The per-IP general limiter is in memory (per isolate). Durable limits cover the sensitive endpoints. For stronger DDoS
  protection, add a custom domain and Cloudflare WAF rate-limiting rules.
- There's no email verification or password reset yet (needs an email provider). Account recovery is via MFA recovery codes only.
- Staging is publicly reachable (test data only). Protect it with Cloudflare Access (free for up to 50 users) if needed.
- The edge doesn't cache shared images any more (private by default). That's a small cost in D1 reads.
- The browser test leaves no data, but some earlier failed runs left MFA-protected test accounts on staging (example.com).
