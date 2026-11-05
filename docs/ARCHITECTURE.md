# Architecture (Cloudflare free tier only)

```
Browser ── https://characterforge-3u3.pages.dev ── Cloudflare Pages
 React SPA (frontend/dist, static)               ├─ /*        static assets (SPA)
 lib/engine: canvas drawing, selection,          └─ /api/*    Pages Function → Hono (server/app.ts)
 compositing, bg removal, zip exports                          ├─ D1 "characterforge": users, characters, designs,
 Authorization: Bearer JWT                                     │   activities, files (image BLOBs), rate_limits, ai_usage
                                                               └─ Workers AI: DreamShaper (text→image), SD 1.5 inpainting
```

## Why it's shaped this way
- **Free-plan CPU limit (about 10 ms per request)**: the server can't decode or encode images. The browser does every pixel
  operation and uploads finished WebP files. The server stores bytes, checks ownership, and proxies Workers AI (AI time is
  I/O wait, not CPU).
- **Images in D1** (`files` table, BLOB): R2 requires a payment method on the account. D1 free gives 5 GB, about 60 KB
  per WebP design. `/api/files/*` is cached at the edge and in browsers (immutable keys).
- **AI with a fallback**: Workers AI has a free daily allowance, and the beta models used are free. Each user gets
  `AI_DAILY_LIMIT` images per day. If the AI is off, busy, over the limit or returns a blank image, the API answers
  `fallback: true` and the browser draws procedural placeholder art, so the app never dead-ends.
- **Identity consistency**: a per-character seed, the description in every prompt, an anchor image (reference or first
  design) used through inpainting with a full mask at strength 0.7, a colour-histogram consistency score, and edits that
  replace only the masked pixels (composited in the browser).
- **Auth**: PBKDF2-SHA256 (100k iterations, the Web Crypto maximum on Workers) and an HS256 JWT (30 days). Rate limits are
  stored in D1, so they hold across isolates.
- **Same origin**: there's no CORS. The SPA and API share one domain.

## Deploy pipeline
`npm run deploy` = Vite build + `wrangler pages deploy` (uploads `frontend/dist` + bundles `functions/` → `server/`).
DB schema: `npm run db:migrate:remote`. Details are in `DEPLOY.md`. CI (`.github/workflows/ci.yml`) typechecks and builds, and
deploys when the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets exist.
