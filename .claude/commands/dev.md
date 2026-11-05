---
description: Start the CharaForge backend (:8000) and frontend (:5173) dev servers in the background
---
1. Start the backend in the background from `backend/`: `.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`
2. Start the frontend in the background from `frontend/`: `npm run dev`
3. Check `http://localhost:8000/api/health` and report the `mock_ai` value, then tell the user to open http://localhost:5173.
If port 8000 or 5173 is already in use, say so instead of starting duplicates.
