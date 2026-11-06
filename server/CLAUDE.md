# Server — Claude guide (Hono on Cloudflare Pages Functions, `server/`)

Entry: `functions/api/[[path]].ts` → `server/app.ts` (`basePath('/api')`). Bindings: `DB` (D1), `AI` (Workers AI),
vars `ENVIRONMENT`, `AI_ENABLED`, `AI_DAILY_LIMIT`, `ADMIN_EMAILS`; secrets `MFA_ENCRYPTION_KEY`, `LOG_HASH_SALT`,
`ALERT_WEBHOOK_URL?`. Typecheck with `npx tsc -p server`. Security model: `docs/SECURITY.md`.
**Budget: about 10 ms CPU per request (free plan).** Only do I/O here, plus PBKDF2 at login and register.

## Request flow
requestContext (request id, ip hash, one log line) → securityHeaders → bodyLimit (4 MB) → generalRateLimit (300/min/IP) →
csrfProtection → authenticate (cookie → `c.get('user')`/`c.get('session')`) → authorize (PUBLIC list on decoded path,
admin+MFA) → route → `ownedCharacter(c, id)`/`ownedDesign(c, id)` → D1 (prefer one atomic `db.batch`) → `*Out()` → JSON. Errors: `fail(status, detail, extra?)` throws `ApiError`, which
`app.onError` turns into `{"detail": ..., ...extra}`.

## Routes
| Method | Path | File |
|---|---|---|
| GET | `/api/health` | app.ts |
| POST | `/api/auth/register`, `/api/auth/login` (D1 rate limits) | routes/auth.ts |
| GET/DELETE | `/api/auth/me` | routes/auth.ts |
| GET/POST | `/api/characters` | routes/characters.ts |
| GET/DELETE | `/api/characters/:id` | routes/characters.ts |
| POST | `/api/characters/:id/reference` (multipart image, thumb, embedding) | routes/characters.ts |
| GET/POST | `/api/characters/:id/designs` (multipart image, thumb, kind, source, prompt, parent_id, consistency, embedding) | routes/characters.ts |
| POST | `/api/characters/:id/exported` `{detail, design_id?}` | routes/characters.ts |
| GET/DELETE | `/api/history?before&limit&character_id` | routes/history.ts |
| GET | `/api/gallery?before&limit` (public) | routes/gallery.ts |
| POST/DELETE | `/api/designs/:id/publish` (DELETE: owner or admin) | routes/gallery.ts |
| GET | `/api/ai/status` · POST `/api/ai/generate` · POST `/api/ai/inpaint` | routes/ai.ts |
| GET | `/api/files/:prefix/:name` (owner, or anyone for shared designs) | routes/files.ts |
| POST | `/api/auth/{logout,password,sessions/revoke,mfa/setup,mfa/enable,mfa/disable,mfa/verify,mfa/enrol/start,mfa/enrol/finish}`; GET `/api/auth/csrf` | routes/auth.ts |
| GET | `/api/admin/security/{summary,events}` (admin + MFA) | routes/admin.ts |

## Adding a route (checklist)
1. Handler in the right `routes/*.ts`. It's private automatically. If it must be public, add it to `PUBLIC` in
   `middleware.ts` and justify it in `docs/SECURITY.md`.
2. Validate with `jsonBody` + `str`/`int` from `http.ts`, and load rows through `ownedCharacter`/`ownedDesign`.
3. Write with `db.batch([...])`, including `recordActivity(...)` if the user should see it in their history.
4. Return an `*Out` shape, then mirror it in `frontend/src/lib/types.ts` + `api.ts`.
5. Extend `scripts/smoke.mjs` (and `security-test.mjs` with an IDOR probe), run `npm run build && npm run dev`, then
   `npm run smoke && npm run test:security && npm run check:security`.

## Files (images in D1)
`prepareFile(db, uid, 'd'|'r'|'t', File)` validates the type (webp/png/jpeg) and size (≤1.5 MB) and returns `{key, stmt}`. Put the
stmt in your batch. Keys are `d/` designs, `r/` references, `t/` history thumbnails (kept when a character is deleted,
removed by clear-history or account deletion). `deleteFiles(db, keys)` returns statements.

## Workers AI (`ai.ts`, details in `docs/AI_PIPELINE.md`)
`generate()` uses DreamShaper text-to-image, or SD 1.5 inpainting with a full-white mask at strength 0.7 when an anchor
is given (identity lock). `inpaint()` uses SD 1.5 inpainting with the user's mask. Output is always buffered and
blank-checked. On failure the route answers 503/429 with `fallback: true`, and the browser draws placeholder art.
Usage per user per day goes in the `ai_usage` table.
