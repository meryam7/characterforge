# CharaForge — Claude guide

AI character design studio: description + optional reference image → consistent character designs → click a region →
AI repaint → export (PNG, transparent PNG, sprite sheet, Godot 4 pack). It also has accounts (MFA), a per-user **history**,
an opt-in public **community gallery** (likes, "start from this" remix, reports + moderation, `/d/<id>` share pages with
social previews), **English + French UI**, and Privacy/Terms/Content-Policy pages.
**Live:** https://characterforge-3u3.pages.dev — 100% Cloudflare free tier (Pages + Pages Functions + D1 + Workers AI).
Staging (testing env): https://staging.characterforge-3u3.pages.dev. Repo: https://github.com/meryam7/characterforge. Small codebase: **read only what the task needs** and use the maps below.

## Architecture in one breath
`frontend/` (React SPA, static on Pages) does **all pixel work in the browser** (`src/lib/engine/`): placeholder
drawing, region selection, compositing, background removal, zips. `server/` (Hono, run by
`functions/api/[[path]].ts`) handles auth, D1 storage (images are BLOBs in D1), history, gallery, and proxies
**Workers AI** (`/api/ai/*`). The free plan allows about 10 ms CPU per request, so **never do image processing on the server**.

## Never read / search these
`node_modules/` (root + frontend), `package-lock.json`, `frontend/dist/`, `.wrangler/`, `.dev.vars` (secret), `backups/` (encrypted DB dumps),
`frontend/public/og-image.png`.

## File map
| Need | File |
|---|---|
| Hono app, middleware order, route mounting, error format | `server/app.ts` |
| Request log, security headers, CSRF, authn, **deny-by-default authz (PUBLIC list)** | `server/middleware.ts` |
| Cookie sessions + CSRF token | `server/session.ts` |
| Security event log, redaction, anomaly alerts | `server/security-log.ts` |
| TOTP (MFA) · AES-GCM/hash helpers | `server/totp.ts` · `server/crypto.ts` |
| Bindings/row types (`Env`, `UserRow`...) | `server/env.ts` |
| Validation + `ApiError`/`fail()` + time helpers | `server/http.ts` |
| Ownership checks, files, history `recordActivity`, rate limit, output shapes | `server/db.ts` |
| PBKDF2 passwords, password policy | `server/security.ts` |
| Email codes (verification, password reset), Resend/Brevo delivery | `server/email.ts` (setup: `docs/EMAIL.md`) |
| Workers AI models, prompt building, `STYLES`, `NEGATIVE` | `server/ai.ts` |
| Routes | `server/routes/{auth,characters,history,gallery,ai,files,admin}.ts` |
| DB schema | `migrations/*.sql` (D1) |
| Pages config: production + staging (preview) bindings, vars | `wrangler.toml` |
| App shell (auth, hash views, `run()`) | `frontend/src/App.tsx` |
| API client (cookies + `X-CSRF-Token`, `ApiError`) | `frontend/src/lib/api.ts` · types `lib/types.ts` |
| Browser image engine | `frontend/src/lib/engine/{index,image,mock,select,identity,exporting}.ts` |
| UI components | `frontend/src/components/*` (see `frontend/CLAUDE.md`) |
| i18n: provider + switcher · French dictionary | `frontend/src/lib/i18n.tsx` · `frontend/src/lib/i18n.fr.ts` |
| Legal texts EN/FR (+ operator placeholders) | `frontend/src/lib/legal.ts` |
| Share page with social tags (`/d/<id>`) | `functions/d/[id].ts` |
| Tests: functional · security (78 checks) · static checks | `scripts/smoke.mjs` · `scripts/security-test.mjs` · `scripts/check-security.mjs` |
| Encrypted backup · restore test | `scripts/backup.mjs` · `scripts/restore-test.mjs` |

Deeper docs (open on demand): `docs/ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`, `AI_PIPELINE.md`, `FRONTEND.md`,
`EXPORT_GODOT.md`, `KNOWN_ISSUES.md`, `RECIPES.md`, `DEPLOY.md`, `LAUNCH.md`, **`SECURITY.md`**, `BACKUP.md`, `EMAIL.md`. Server area guide: `server/CLAUDE.md`.

## Commands (repo root)
```powershell
npm install; npm --prefix frontend install         # once
npm run db:migrate:local                            # once / after new migrations
npm run build; npm run dev                          # full stack on http://127.0.0.1:8788 (local D1)
npm run dev:web                                     # + Vite hot reload on :5173 (proxies /api to :8788)
npm run typecheck                                   # server + frontend tsc
npm run smoke; npm run test:security               # vs :8788 (BASE=https://staging... for staging; AI=1 includes AI)
npm run check:security; npm run audit               # parameterized-SQL / bundle-secret / XSS-sink scan; npm audit
npm run check:i18n                                  # every t('...') string has a French translation
npm run deploy:staging                              # ALWAYS first; test staging; then npm run deploy:production
npm run backup -- characterforge; npm run restore:test -- backups/<file>.cfbk   # needs BACKUP_PASSPHRASE
```
Wrangler auth: `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. Never commit tokens.
Workers AI can't run in local `wrangler pages dev` (its remote proxy returns "internal error"). Locally the app
falls back to placeholder art. Test AI against staging.

## Rules
- **Contract sync**: output shapes in `server/db.ts` (`characterOut`, `designOut`, `activityOut`) and the routes must match
  `frontend/src/lib/types.ts` and `lib/api.ts`. `STYLES` lives in `server/ai.ts` and `types.ts`. History actions live in
  `db.ts ACTIONS`, `types.ts ActivityAction` and `HistoryView META`.
- **Security model (docs/SECURITY.md)**: cookie sessions only (never tokens in JS/localStorage). Routes are denied unless
  listed in `PUBLIC` (`middleware.ts`), matched on the decoded `c.req.path`. Load rows only via `ownedCharacter(c, id)`/
  `ownedDesign(c, id)` (404 + `access_denied` log). Admin = `ADMIN_EMAILS` + `session.mfa`, checked globally AND in the
  admin router. Unsafe methods need CSRF (automatic in `api.ts`).
- SQL: bound parameters (`?`) only. `npm run check:security` fails on any other interpolation (whitelist in the script).
- User text: validate with `str()`/`int()`/`jsonBody()` from `http.ts`. React renders it (never `dangerouslySetInnerHTML`).
- Log security events with `logEvent(c, type, severity, {detail})`. Never put passwords, codes, tokens or emails in `detail`
  (redaction is a safety net). Sensitive limits use `rateLimit(c, key, max, sec)` with hashed keys.
- Record user-visible actions with `recordActivity(...)` in the same `db.batch` as the change.
- Schema change → a new `migrations/000N_*.sql`. Never edit an applied migration. Then run `db:migrate:local` and
  `db:migrate:remote` before deploying code that needs it.
- D1 limits: row ≤ 2 MB (images ≤ 1.5 MB enforced, and the browser uploads WebP), ≤ 100 bound params per statement.
- Workers AI: never put "nsfw" in prompts (the model returns a black image). `toResponse` rejects blank output → `fallback`.
- Frontend: all calls go through `api`. Async UI work goes through `run(label, fn)`. Heavy libs (konva, three) stay lazy.
- **i18n**: every user-visible string goes through `t('English text', {vars})` from `useI18n()`. Add the French to
  `lib/i18n.fr.ts` (`npm run check:i18n` fails otherwise). Server error `detail`s shown to users should get a French
  entry too. AI prompts stay English (the models understand English best).
- Legal: `lib/legal.ts` must describe what the code really does. Bump `LEGAL_VERSION` + `TERMS_VERSION` (auth.ts)
  together on material changes. `OPERATOR`, `CONTACT_EMAIL`, `GOVERNING_LAW` are still placeholders for the owner.
- Accounts are usable only after the emailed 6-digit code is confirmed (`email_verified`). Tests get codes for
  `@example.com` addresses from `/api/test/inbox` (non-production only) via `completeEmail()` in `scripts/lib/client.mjs`.
- Secrets: `MFA_ENCRYPTION_KEY`, `LOG_HASH_SALT`, `EMAIL_API_KEY` (production), optional `ALERT_WEBHOOK_URL`, stored as Pages secrets per environment
  (`.dev.vars` locally), server-only. Vars live in `wrangler.toml`. Deploy staging → test → production, never the reverse.

## Environment notes
Windows 11, Node 24. Git needs `http.sslBackend=schannel` (already set in this repo). Node `fetch` to Cloudflare is
flaky from this machine, so use `node --dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000`.
R2 is not enabled on the account (it needs a card), so images live in D1.

## Keeping docs cheap & correct
Update the one doc that owns a fact in the same task. Put gotchas in `docs/KNOWN_ISSUES.md`.
