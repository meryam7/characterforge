# CharaForge - AI character design studio

Text + reference image -> consistent characters -> edit any part -> export for games/comics/animation.
Accounts, a personal history of everything you create, and a public community gallery.

Developer and AI-agent docs: [`CLAUDE.md`](CLAUDE.md) (start here), [`AGENTS.md`](AGENTS.md), [`docs/`](docs/).
**Put it online:** [`docs/DEPLOY.md`](docs/DEPLOY.md) · **Promote it:** [`docs/LAUNCH.md`](docs/LAUNCH.md)

```
charaforge/
├─ backend/                 FastAPI + SQLAlchemy + Alembic (+ optional PyTorch/Diffusers/SAM2/CLIP)
│  ├─ app/main.py           API entry, /files, serves the built frontend
│  ├─ app/routers/          auth, characters, studio, history, community
│  ├─ app/services/         ai (all deep learning + mock), export, storage (disk / R2), history
│  ├─ migrations/           Alembic (applied automatically at startup)
│  └─ tests/                pytest
├─ frontend/                React + TypeScript + Tailwind + Konva + three.js
├─ godot/CharacterLoader.gd
├─ Dockerfile               one image: frontend build + API
├─ render.yaml              Render blueprint (deploy)
└─ docker-compose.yml       local production-like run (app + Postgres)
```

## 0. Install once
Git, Node.js 20 LTS, Python 3.11+ (tick "Add to PATH" on Windows), VS Code. Docker Desktop is optional.

## 1. Backend (terminal 1)
Windows:
```
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt && cp .env.example .env`

Check http://localhost:8000/api/health and http://localhost:8000/docs. The database tables are created automatically.
Run the tests with `python -m pytest -q`.

## 2. Frontend (terminal 2)
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173, sign up, create a character, click Generate, then "Select a region", click the hair,
type "bright red hair" and Apply. Open **History** to see everything you did, and **Community** to see shared designs
(use "Share to community" in the Export panel to share yours).
In mock mode the images are procedural placeholders, but every feature really works.

## 3. Real AI (optional, GPU)
NVIDIA GPU with 8 GB+ VRAM. Install PyTorch with CUDA from https://pytorch.org, run `pip install -r requirements-ai.txt`,
set `MOCK_AI=false` in `.env` and restart. The first request downloads several GB of models. Details: `docs/AI_PIPELINE.md`.

How identity is preserved: (1) one seed per character, (2) the description is in every prompt, (3) IP-Adapter
conditions on the reference or first design, (4) CLIP scores each design (the % badge), (5) edits use masks plus
inpainting, so only the selected pixels change.

## 4. Godot (optional)
Click "Godot pack" in the app, unzip into `res://characters/hero/`, add a Node2D, attach `CharacterLoader.gd`, set
`character_json`, and run. Enter/Space cycles through the designs.

## 5. Deploy online
Render (app) + Neon (Postgres) + Cloudflare R2 (images), all on free tiers. Step by step: [`docs/DEPLOY.md`](docs/DEPLOY.md).
Production-like test locally: `docker compose up --build`, then open http://localhost:8000.

## Troubleshooting
- `npm install` peer errors: use Node 20 and don't upgrade React to 19 (react-konva 18 is pinned).
- 401 errors: log in again (tokens last 30 days).
- Changed `models.py`? Create a migration: `python -m alembic revision --autogenerate -m "what changed"` (in `backend/`).
- CUDA out of memory: close other GPU apps, or lower `W, H` in `services/ai.py`.
