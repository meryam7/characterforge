# AGENTS.md

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude, etc.) working on CharaForge.

**The single source of truth is [`CLAUDE.md`](CLAUDE.md)**: file map, commands, conventions, and files you must not read.
Area rules are in `backend/CLAUDE.md` and `frontend/CLAUDE.md`. Deep docs are in `docs/`.

## TL;DR
- Product: AI character design studio (generate → select region → inpaint → export for games), with accounts,
  a per-user history and a public community gallery.
- Backend: FastAPI + SQLAlchemy + Alembic in `backend/app/`. AI is in `services/ai.py` (mock mode needs no GPU).
- Frontend: React 18 + TS + Vite + Tailwind in `frontend/src/`. HTTP goes through `lib/api.ts` (Bearer token).
- Deploy: root `Dockerfile` + `render.yaml` (Render) + Neon + Cloudflare R2. See `docs/DEPLOY.md`.
- Skip `backend/.venv/`, `frontend/node_modules/`, `package-lock.json`, `dist/`, `storage/`, `*.db`, `.env`.
- Verify: `cd backend; .venv\Scripts\python -m pytest -q` and `cd frontend; npx tsc --noEmit`.
- Model change → Alembic migration. Schema change → mirror it in `types.ts` and `api.ts`. Every endpoint uses `current_user` + `get_owned*`.
