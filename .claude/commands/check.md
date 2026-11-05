---
description: Run all CharaForge verification (backend import smoke test, frontend typecheck, tests if present)
---
Run these from the repo root and report pass/fail with the relevant output only:
1. `cd backend; .venv\Scripts\python -c "import app.main; print('backend OK')"`
2. `cd frontend; npx tsc --noEmit`
3. If `backend/tests/` exists: `cd backend; .venv\Scripts\python -m pytest -q`
Don't fix anything unless asked. Summarise failures as `file:line` and the error.
