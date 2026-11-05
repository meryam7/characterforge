# CharaForge — Claude guide

AI character design studio: text + optional reference image → consistent character designs → click-to-select a
region → inpaint edit → export (PNG, transparent PNG, sprite sheet, Godot 4 pack). It also has email/password
accounts, a per-user **history** (activity log), and an opt-in public **community gallery**.
Deployed as one Docker service on Render + Neon Postgres + Cloudflare R2 (`docs/DEPLOY.md`).
Small codebase. **Read only what the task needs.** Use the maps below instead of exploring.

## Stack
- `backend/` FastAPI + SQLAlchemy 2 + Alembic (SQLite dev / Postgres prod) + Pillow/NumPy + PyJWT + boto3 (R2).
  Optional heavy AI (torch, diffusers, transformers/CLIP, SAM2) only when `MOCK_AI=false`.
- `frontend/` React 18 + TypeScript (strict) + Vite 5 + Tailwind 3 + react-konva + three.js (both lazy-loaded).
- `godot/CharacterLoader.gd` is the Godot 4 script shipped inside the "Godot pack" export.
- Root `Dockerfile` builds the frontend and serves `dist/` from FastAPI (same origin). `render.yaml` is the Render blueprint.

## Never read / search these (huge, generated, or binary)
`backend/.venv/`, `frontend/node_modules/`, `frontend/package-lock.json`, `frontend/dist/`, `backend/storage/`,
`*.db`, `__pycache__/`, `frontend/public/og-image.png`. `backend/.env` holds local config and may hold secrets,
so never print or commit it.

## File map (where to look)
| Need | File |
|---|---|
| App wiring, middleware, `/files/{key}` route, SPA mount, `/api/health` | `backend/app/main.py` |
| Env settings (paths anchored to `backend/`), prod checks | `backend/app/config.py` |
| DB engine/session, `migrate()` (Alembic at startup) | `backend/app/database.py` |
| Auth dependency: `current_account` (User), `current_user` (owner key str) | `backend/app/deps.py` |
| Password hashing (scrypt) + JWT | `backend/app/security.py` |
| Rate limiting (in-memory) | `backend/app/ratelimit.py` |
| ORM: `User`, `Character`, `Design`, `Activity` | `backend/app/models.py` |
| Pydantic models (`UTCDateTime` → ISO "Z") | `backend/app/schemas.py` |
| Register/login/me/delete account | `backend/app/routers/auth.py` |
| Character CRUD + reference upload, `get_owned`, `to_out`, `delete_character_files` | `backend/app/routers/characters.py` |
| Generate, segment, edit, export | `backend/app/routers/studio.py` |
| History list/clear | `backend/app/routers/history.py` |
| Public gallery, publish/unpublish | `backend/app/routers/community.py` |
| ALL AI code + mock mode, `STYLES` | `backend/app/services/ai.py` |
| History recording `history.record()` | `backend/app/services/history.py` |
| Background removal, sprite sheet, Godot zip | `backend/app/services/export.py` |
| Storage (local disk or S3/R2) | `backend/app/services/storage.py` |
| Migrations | `backend/migrations/versions/*.py` |
| Tests (pytest, mock mode, temp DB) | `backend/tests/` |
| App shell: auth state, hash views, `run()` busy/error | `frontend/src/App.tsx` |
| HTTP client (Bearer token), types, helpers | `frontend/src/lib/api.ts`, `types.ts`, `format.ts` |
| UI pieces | `frontend/src/components/*.tsx` (see `frontend/CLAUDE.md`) |

Deeper docs (open only when relevant): `docs/ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`, `AI_PIPELINE.md`,
`FRONTEND.md`, `EXPORT_GODOT.md`, `KNOWN_ISSUES.md`, `RECIPES.md`, `DEPLOY.md`, `LAUNCH.md`.

## Commands (Windows, from repo root)
```powershell
cd backend; .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000   # API (+ dist/ if built)
cd frontend; npm run dev                                                        # :5173, proxies /api,/files
```
Verification:
- Backend tests: `cd backend; .venv\Scripts\python -m pytest -q` (all must pass)
- Frontend: `cd frontend; npx tsc --noEmit` (fast) · `npm run build` (also checks index.html env substitution)
- Production-like: `docker compose up --build` → http://localhost:8000

## Rules / conventions
- **Contract sync**: changes to `schemas.py` must be mirrored in `frontend/src/lib/types.ts` and `lib/api.ts`.
  `STYLES` lives in both `ai.py` and `types.ts`. Slug logic lives in `export.slug()` and `lib/format.ts`.
- Every private endpoint uses `Depends(current_user)` (or `current_account` when it needs the `User`) and loads
  rows via `get_owned()` / `get_owned_design()` (404 if not the owner).
- **Record history** with `history.record(db, user, action, character, design?, detail?, image?)` inside the same
  transaction for every user-visible action. Add new actions to `ACTIONS` and to `HistoryView.tsx` `META`.
- **Schema changes need an Alembic migration**: edit `models.py`, then run
  `cd backend; .venv\Scripts\python -m alembic revision --autogenerate -m "..."`, review it, and commit it.
  Migrations run automatically at startup.
- All file IO goes through `services/storage.py` (keys like `designs/<hex>.png`, validated). Never use `open()` on
  storage paths, because production uses R2.
- Heavy AI imports stay lazy inside functions, and every AI function keeps its `if settings.mock_ai:` branch. GPU work runs inside `_lock`.
- Routers are sync `def`. Python must stay 3.11-compatible (Docker and CI). React stays 18.
- Frontend: all calls go through `api` (it attaches the token). Use `run(label, fn)` for async UI work, and
  `ConfirmButton` instead of `window.confirm`.

## Environment notes
- Local: Windows 11, Python 3.15 venv, Node 24. Docker/CI: Python 3.11, Node 20.
- Cloudflare R2 isn't reachable from this dev machine (TLS blocked locally), so S3 code can only be verified on Render.

## Keeping docs cheap & correct
When behaviour changes, update the one doc that owns it in the same task. Put gotchas in `docs/KNOWN_ISSUES.md`.
