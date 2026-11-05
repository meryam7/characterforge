# AGENTS.md

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude, etc.) working on CharaForge.

**The single source of truth is [`CLAUDE.md`](CLAUDE.md)**: file map, commands, rules, and files you must not read.
Area guides are in `server/CLAUDE.md` and `frontend/CLAUDE.md`. Deep docs are in `docs/`.

## TL;DR
- AI character studio on the Cloudflare free tier: Pages (React SPA) + Pages Functions (Hono API in `server/`) + D1 (data and
  images) + Workers AI (Stable Diffusion). Live at https://characterforge-3u3.pages.dev.
- All image processing runs in the browser (`frontend/src/lib/engine/`). The server only does I/O, because of the ~10 ms CPU limit.
- Verify: `npm run typecheck`, then `npm run build && npm run dev` and `npm run smoke`.
- Schema changes go in a new `migrations/*.sql`. Output shapes in `server/db.ts` must match `frontend/src/lib/types.ts`.
- Skip `node_modules/`, `package-lock.json`, `dist/`, `.wrangler/`, `.dev.vars`.
