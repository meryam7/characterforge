# HTTP API (`server/`, base `/api`)

**Auth uses cookies, not tokens.** `__Host-session` (HttpOnly, Secure, SameSite=Lax) is set by login/register/MFA.
**CSRF:** every POST/PUT/PATCH/DELETE must send `X-CSRF-Token` equal to the `__Host-csrf` cookie (any GET, e.g.
`GET /auth/csrf`, issues it). A cross-site `Origin` header is rejected.
**Deny by default:** only the routes marked "public" work without a session. `/admin/*` also needs an admin email
and an MFA-verified session. Other users' rows return 404 (and the attempt is logged).
Errors look like `{"detail": string, ...}`. 401 = log in, 403 = CSRF/MFA required, 413 = body > 4 MB, 415 = wrong
content type, 422 = validation, 429 = rate limited. Times are ISO-8601 UTC ending in `Z`. Every response has `X-Request-Id`.

## Shapes (server ↔ frontend/src/lib/types.ts)
```ts
User        { id, email, display_name, is_admin, mfa_enabled, mfa_verified, created_at }
LoginResult { status:'ok', user, recovery_codes? } | { status:'mfa_required', challenge } | { status:'mfa_enrol_required', challenge }
MfaSetup    { secret, otpauth_uri }
Character   { id, name, description, style, seed, embedding|null, reference_url|null, cover_url|null, design_count, created_at }
Design      { id, character_id, parent_id|null, kind, source, prompt, consistency|null, image_url, is_public, created_at }
Activity    { id, action, character_id|null, character_name, design_id|null, detail, thumb_url|null, character_exists, created_at }
PublicDesign { id, image_url, prompt, kind, source, character_name, style, author, published_at }
SecuritySummary { last_24h[], recent_alerts[], users{n,mfa}, active_sessions }    SecurityEvent { id, type, severity, user_id, subject, ip_hash, path, detail, created_at }
```

## Auth & account
| Route | Access | Notes |
|---|---|---|
| GET `/auth/csrf` | public | `{csrf}` + cookie |
| POST `/auth/register` `{email, password(10-128, not common), display_name}` | public | 20/h per IP. Admin emails → `mfa_enrol_required` (no session) |
| POST `/auth/login` `{email, password}` | public | 60/10 min per IP, 10/10 min per account. Constant-time for unknown emails |
| POST `/auth/mfa/verify` `{challenge, code}` | public (challenge) | TOTP or recovery code. 5 tries per challenge, 5 min TTL, replay-protected |
| POST `/auth/mfa/enrol/start` / `/enrol/finish` `{challenge, code?}` | public (challenge) | first-time admin MFA, returns `recovery_codes` once |
| GET `/auth/me` · POST `/auth/logout` · POST `/auth/sessions/revoke` | session | revoke = sign out other devices |
| POST `/auth/password` `{current_password, new_password}` | session | revokes other sessions |
| POST `/auth/mfa/setup` → POST `/auth/mfa/enable` `{code}` | session | optional MFA for everyone. Enable revokes all sessions and issues a fresh MFA session |
| POST `/auth/mfa/disable` `{password, code}` | session | not allowed for admins |
| DELETE `/auth/me` `{password, code?}` | session | wipes all user data |

## App
| Route | Access | Notes |
|---|---|---|
| GET `/health` | public | `{status, env, ai, storage}` |
| GET/POST `/characters`, GET/DELETE `/characters/:id` | session + owner | |
| POST `/characters/:id/reference` (multipart image, thumb, embedding) | owner | WebP/PNG/JPEG ≤ 1.5 MB |
| GET/POST `/characters/:id/designs` (multipart image, thumb, kind, source, prompt, parent_id?, consistency?, embedding?) | owner | 60/min |
| POST `/characters/:id/exported` `{detail, design_id?}` | owner | history only |
| GET/DELETE `/history` | session | own entries only |
| GET `/gallery` | public | never exposes emails |
| POST/DELETE `/designs/:id/publish` | owner. DELETE also admin + MFA | admin takedown is logged as an alert |
| GET `/ai/status` · POST `/ai/generate` · POST `/ai/inpaint` | session (+owner) | 6/min. Base64 and mask strictly validated. `fallback:true` on failure |
| GET `/files/:prefix/:name` | owner, or anyone if the design is shared | `CSP: sandbox`, private cache for owners |
| GET `/admin/security/summary` · `/admin/security/events?before&severity&limit` | admin + MFA session | |

## Growth & trust (added 2026-11-10)
| Route | Access | Notes |
|---|---|---|
| GET `/gallery?sort=new/popular &before or &offset &limit` | public | items include `like_count`, `liked_by_me`; `next_before` (new) / `next_offset` (popular) |
| GET `/gallery/:id` | public | one shared design (404 if private) |
| POST / DELETE `/gallery/:id/like` | session | idempotent; returns `{liked, like_count}` · 120/h |
| POST `/gallery/:id/remix` | session | "start from this": new character of yours, shared image copied as its reference (`remixed_from`) · 20/h |
| POST `/gallery/:id/report` `{reason: nsfw, violence, hate, copyright, spam, other, note?}` | session | one per user+design, not your own; 3 open reports → `content_reported` alert · 20/day |
| GET `/admin/reports` · POST `/admin/reports/:designId/resolve` `{action: "dismiss" or "remove"}` | admin + MFA | moderation queue; remove = unpublish + `admin_takedown` alert |
| GET `/d/:id` (not under /api) | public | SPA HTML with og/twitter tags of the shared design |
`POST /auth/register` now requires `accept_terms: true` (stored as `terms_version` + `terms_accepted_at`).
