# CharaForge — Claude guide

AI character design studio: description + optional reference image → consistent character designs → click a region →
AI repaint → export (PNG, transparent PNG, sprite sheet, Godot 4 pack). It also has accounts, a per-user **history**
and an opt-in public **community gallery**.
**Live:** https://characterforge-3u3.pages.dev — 100% Cloudflare free tier (Pages + Pages Functions + D1 + Workers AI).
Repo: https://github.com/meryam7/characterforge. Small codebase: **read only what the task needs** and use the maps below.

## Architecture in one breath
`frontend/` (React SPA, static on Pages) does **all pixel work in the browser** (`src/lib/engine/`): placeholder
drawing, region selection, compositing, background removal, zips. `server/` (Hono, run by
`functions/api/[[path]].ts`) handles auth, D1 storage (images are BLOBs in D1), history, gallery, and proxies
**Workers AI** (`/api/ai/*`). The free plan allows about 10 ms CPU per request, so **never do image processing on the server**.

## Never read / search these
`node_modules/` (root + frontend), `package-lock.json`, `frontend/dist/`, `.wrangler/`, `.dev.vars` (secret),
`frontend/public/og-image.png`.

## File map
| Need | File |
|---|---|
| Hono app, route mounting, error format | `server/app.ts` |
| Bindings/row types (`Env`, `UserRow`...) | `server/env.ts` |
| Validation + `ApiError`/`fail()` + time helpers | `server/http.ts` |
| Ownership checks, files, history `recordActivity`, rate limit, output shapes | `server/db.ts` |
| PBKDF2 passwords + JWT | `server/security.ts` · auth middleware `server/middleware.ts` |
| Workers AI models, prompt building, `STYLES`, `NEGATIVE` | `server/ai.ts` |
| Routes | `server/routes/{auth,characters,history,gallery,ai,files}.ts` |
| DB schema | `migrations/*.sql` (D1) |
| Pages config: D1/AI bindings, vars | `wrangler.toml` |
| App shell (auth, hash views, `run()`) | `frontend/src/App.tsx` |
| API client (`ApiError`, Bearer token) | `frontend/src/lib/api.ts` · types `lib/types.ts` |
| Browser image engine | `frontend/src/lib/engine/{index,image,mock,select,identity,exporting}.ts` |
| UI components | `frontend/src/components/*` (see `frontend/CLAUDE.md`) |
| E2E API test | `scripts/smoke.mjs` |

Deeper docs (open on demand): `docs/ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`, `AI_PIPELINE.md`, `FRONTEND.md`,
`EXPORT_GODOT.md`, `KNOWN_ISSUES.md`, `RECIPES.md`, `DEPLOY.md`, `LAUNCH.md`. Server area guide: `server/CLAUDE.md`.

## Commands (repo root)
```powershell
npm install; npm --prefix frontend install         # once
npm run db:migrate:local                            # once / after new migrations
npm run build; npm run dev                          # full stack on http://127.0.0.1:8788 (local D1)
npm run dev:web                                     # + Vite hot reload on :5173 (proxies /api to :8788)
npm run typecheck                                   # server + frontend tsc
npm run smoke                                       # API e2e vs :8788  (BASE=https://... for prod, AI=1 to include AI)
npm run deploy                                      # build + wrangler pages deploy (needs Cloudflare auth)
```
Wrangler auth: `npx wrangler login`, or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. Never commit tokens.
Workers AI can't run in local `wrangler pages dev` (its remote proxy returns "internal error"). Locally the app
falls back to placeholder art. Test AI against production.

## Rules
- **Contract sync**: output shapes in `server/db.ts` (`characterOut`, `designOut`, `activityOut`) and the routes must match
  `frontend/src/lib/types.ts` and `lib/api.ts`. `STYLES` lives in `server/ai.ts` and `types.ts`. History actions live in
  `db.ts ACTIONS`, `types.ts ActivityAction` and `HistoryView META`.
- Every private route: `requireUser` middleware + `ownedCharacter`/`ownedDesign` (404 if not the owner).
- Record user-visible actions with `recordActivity(...)` in the same `db.batch` as the change.
- Schema change → a new `migrations/000N_*.sql`. Never edit an applied migration. Then run `db:migrate:local` and
  `db:migrate:remote` before deploying code that needs it.
- D1 limits: row ≤ 2 MB (images ≤ 1.5 MB enforced, and the browser uploads WebP), ≤ 100 bound params per statement.
- Workers AI: never put "nsfw" in prompts (the model returns a black image). `toResponse` rejects blank output → `fallback`.
- Frontend: all calls go through `api`. Async UI work goes through `run(label, fn)`. Heavy libs (konva, three) stay lazy.
- Secrets: `JWT_SECRET` (Pages secret, `.dev.vars` locally). Vars live in `wrangler.toml` `[vars]`.

## Environment notes
Windows 11, Node 24. Git needs `http.sslBackend=schannel` (already set in this repo). Node `fetch` to Cloudflare is
flaky from this machine, so use `node --dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000`.
R2 is not enabled on the account (it needs a card), so images live in D1.

## Keeping docs cheap & correct
Update the one doc that owns a fact in the same task. Put gotchas in `docs/KNOWN_ISSUES.md`.
