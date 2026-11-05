# Recipes

## Run locally
```powershell
npm install; npm --prefix frontend install
npm run db:migrate:local
npm run build; npm run dev          # http://127.0.0.1:8788  (AI falls back to placeholder art locally)
npm run dev:web                      # optional hot reload on :5173
npm run smoke                        # API e2e
```
`.dev.vars` must contain `JWT_SECRET=...`. Reset local data by deleting `.wrangler/state` and migrating again.
If local tests hit 429: `npx wrangler d1 execute characterforge --local --command "DELETE FROM rate_limits"`.

## Add an art style
Add it to `STYLES` in `server/ai.ts` (prompt fragment) and `frontend/src/lib/types.ts` (list).

## Add a column
Create `migrations/0002_x.sql` (`ALTER TABLE ... ADD COLUMN ...`), then update `server/env.ts` + `*Out` in `server/db.ts` +
`frontend/src/lib/types.ts`. Run `npm run db:migrate:local`, test, then `npm run db:migrate:remote` and `npm run deploy`.

## Add a history action
`server/db.ts ACTIONS`, `frontend/src/lib/types.ts ActivityAction`, `HistoryView.tsx META`.

## Change AI behaviour
Models and strengths are in `server/ai.ts`. Limits are in `wrangler.toml [vars]`. Test with `BASE=https://characterforge-3u3.pages.dev AI=1 npm run smoke`
(each run uses one AI image).

## Make someone an admin
Set `ADMIN_EMAILS = "a@x.com,b@y.com"` in `wrangler.toml` and redeploy (or set it in Dashboard > Pages > Settings > Variables).

## Turn AI off (placeholder art only)
`AI_ENABLED = "false"` in `wrangler.toml`, then `npm run deploy`.
