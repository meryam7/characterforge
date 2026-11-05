---
description: Start CharaForge locally (wrangler pages dev on :8788 with local D1, optional Vite on :5173)
---
1. If `.dev.vars` is missing, create it with `JWT_SECRET=local-dev-secret`. If `.wrangler/state` is missing, run `npm run db:migrate:local`.
2. `npm run build`, then start `npm run dev` in the background and wait for "Ready on http://127.0.0.1:8788".
3. Optionally start `npm run dev:web` in the background for hot reload on http://localhost:5173.
Tell the user the URLs. Mention that AI falls back to placeholder art locally (Workers AI only works when deployed).
If the ports are busy, say so instead of starting duplicates.
