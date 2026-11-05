# Recipes (common tasks, step by step)

## Add an art style
Add it to `STYLES` in `backend/app/services/ai.py` (dict) and `frontend/src/lib/types.ts` (array).

## Add a field to a model (e.g. `Character.tags`)
1. `models.py`: `tags: Mapped[list | None] = mapped_column(JSON, nullable=True)`.
2. From `backend/`, run `.venv\Scripts\python -m alembic revision --autogenerate -m "character tags"` and review the file.
3. `schemas.py` + `to_out()` in `routers/characters.py`. Mirror in `types.ts`, `api.ts` and the UI.
4. Run `python -m pytest -q` and `npx tsc --noEmit`.

## Add a new AI operation
1. In `ai.py`: a function with the mock branch first, lazy imports, `with _lock:` and a cached loader.
2. Endpoint in `routers/studio.py`: `get_owned*`, `limit()`, `storage.save_image`, a new `Design` (new `kind`),
   `history.record(...)` (add the action to `ACTIONS`, `ActivityAction` and `HistoryView` `META`).
3. Add the client method, a handler in `Studio.tsx` wrapped in `run()`, a control in `Panels.tsx`, and a test.

## Add a history action
Add it to `services/history.ACTIONS`, to the `ActivityAction` union in `types.ts`, and an entry in `META` in `HistoryView.tsx`.

## Make a user an admin
Add their email to `ADMIN_EMAILS` (comma-separated) in Render env vars, then redeploy. Nothing is stored in the DB.

## Switch on real AI
See `AI_PIPELINE.md`. You need a GPU host, a build with `--build-arg INSTALL_AI=true` and `MOCK_AI=false`. Existing
embeddings re-embed automatically.

## Run tests
From `backend/`, run `.venv\Scripts\python -m pytest -q`. `tests/conftest.py` sets a temp SQLite DB and storage, mock AI,
and `ADMIN_EMAILS=admin@example.com`. The `auth` fixture registers a fresh user.

## Reset local data
Stop uvicorn, then delete `backend/charaforge.db` and `backend/storage/`. They're recreated (and migrated) on start.
