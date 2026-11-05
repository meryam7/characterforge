# Backend — Claude guide (FastAPI, `backend/app/`)

Python: `.venv\Scripts\python` (3.15 locally, 3.11 in Docker/CI, so avoid 3.12+-only syntax).
Paths in `.env` (`sqlite:///./x.db`, `STORAGE_DIR=./storage`) resolve relative to `backend/`, from any CWD.

## Request flow
`main.py` → router → `deps.current_account` (Bearer JWT → `User`) / `current_user` (→ `str(user.id)`) →
`get_owned`/`get_owned_design` (ownership, 404) → services (`ai`, `export`, `storage`, `history`) → commit →
`to_out()` / `design_out()` / `user_out()` (storage keys → `/files/...` URLs).

## Endpoints (details: `docs/API.md`)
| Method | Path | Handler |
|---|---|---|
| GET | `/api/health` | `main.health` |
| POST | `/api/auth/register`, `/api/auth/login` | `auth.register` / `login` (rate limited) |
| GET/DELETE | `/api/auth/me` | `auth.me` / `delete_account` |
| GET/POST | `/api/characters` | `characters.list_characters` / `create_character` |
| GET/DELETE | `/api/characters/{cid}` | `get_character` / `delete_character` |
| POST | `/api/characters/{cid}/reference` (multipart `file`, ≤8 MB) | `upload_reference` |
| GET | `/api/characters/{cid}/designs` | `studio.list_designs` |
| POST | `/api/characters/{cid}/generate` | `studio.generate` |
| POST | `/api/designs/{did}/segment` | `studio.segment` |
| POST | `/api/designs/{did}/edit` | `studio.edit` |
| GET | `/api/designs/{did}/export?format=png\|transparent&preview=bool` | `studio.export_design` |
| GET | `/api/characters/{cid}/export?target=godot\|sheet` | `studio.export_character` |
| GET/DELETE | `/api/history?before&limit&character_id` | `history.list_history` / `clear_history` |
| GET | `/api/gallery?before&limit` (public) | `community.gallery` |
| POST/DELETE | `/api/designs/{did}/publish` | `community.publish` / `unpublish` (admins too) |
| GET | `/files/{key}` (public, immutable cache) | `main.files` |
| static | `/` → `FRONTEND_DIST` if built | `main` mount |

## Adding an endpoint (checklist)
1. Pydantic models in `schemas.py` (use `UTCDateTime` for datetimes).
2. Handler: sync `def`, `Depends(get_db)`, `Depends(current_user)`, load via `get_owned*`. Use `limit()` for costly ops.
3. `history.record(...)` if the user would expect to see it in their history.
4. Return via an `*_out` helper. Mirror it in `frontend/src/lib/types.ts` and `api.ts`.
5. Add a test in `tests/test_api.py` (the `auth` fixture gives a fresh user's header). Run `python -m pytest -q`.

## Changing models
Edit `models.py`, then run `.venv\Scripts\python -m alembic revision --autogenerate -m "msg"` from `backend/`.
Review the file in `migrations/versions/` (SQLite uses batch mode). It's applied on the next startup.

## AI layer rules (`services/ai.py`, details: `docs/AI_PIPELINE.md`)
Public API: `build_prompt`, `generate`, `inpaint`, `segment`, `embed`, `similarity`. Each has its mock branch
first, lazy heavy imports, cached loaders, and runs inside `with _lock:`. Masks are mode L, 255 = selected.
`studio.score_and_store_identity` rebuilds `Character.embedding` if its dimension differs (mock 64 vs CLIP 512).

## Storage rules (`services/storage.py`)
`STORAGE_BACKEND=local|s3`. API: `save_image`, `load_image`, `write_bytes`, `read_bytes` (raises FileNotFoundError),
`url_for`, `delete`, `delete_prefix(prefix, older_than=None)`. Keys must match `^[a-z]+(/[A-Za-z0-9_-]+)+\.png$`.
Folders: `references/`, `designs/`, `masks/<design_id>/<mask_id>[_overlay].png` (TTL 6h, deleted after edit),
`history/<user_id>/` (thumbnails kept after the character is deleted).

## Deps
`requirements.txt` (runtime), `requirements-dev.txt` (+pytest, httpx), `requirements-ai.txt` (GPU stack).
