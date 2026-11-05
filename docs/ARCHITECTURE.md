# Architecture

```
Browser ── https://<site> ──► FastAPI (one Docker container: root Dockerfile)
  React SPA (served from /)     ├─ middleware: GZip, CORS, security headers
  Authorization: Bearer JWT     ├─ /api/auth/*          routers/auth.py
                                ├─ /api/characters/*    routers/characters.py
                                ├─ /api/designs/* ...   routers/studio.py, community.py
                                ├─ /api/history         routers/history.py
                                ├─ /api/gallery         routers/community.py (public)
                                ├─ /files/{key}         main.files → storage.read_bytes (public, immutable)
                                └─ /                    StaticFiles(frontend/dist, html=True)
        services: ai.py (mock | SD1.5+IP-Adapter, inpaint, SAM2, CLIP) · export.py · history.py · storage.py
        DB: SQLAlchemy 2 + Alembic → SQLite (dev) / Neon Postgres (prod)
        Files: local disk (dev) / Cloudflare R2 via boto3 (prod)
```

## Key decisions
- **Same-origin deploy**: the API serves the built SPA, so there's no CORS or `VITE_API_URL` in production and only one Render service.
- **Mock mode first**: `MOCK_AI=true` (also in production for now). Heavy AI is optional and lazily imported.
- **Identity consistency**: seed, prompt description, IP-Adapter anchor, CLIP scoring and mask-limited inpaint (`AI_PIPELINE.md`).
- **Auth**: email + password (scrypt) and an HS256 JWT in `localStorage`. `deps.current_user` returns `str(user.id)`,
  which is the owner key in `characters.user_id` and `activities.user_id`.
- **History**: an append-only `activities` table written in the same transaction as each action. Thumbnails are
  copied so the history outlives deleted characters.
- **Community gallery**: per-design opt-in (`is_public`). Admins (`ADMIN_EMAILS`) can unpublish anything.
- **Images through the API** (`/files/{key}`), not bucket URLs: the bucket stays private, the frontend is
  backend-agnostic, and keys are random 128-bit names with immutable caching.
- **Single process**: GPU lock and rate limiter are in-memory. That's fine for one instance; multiple instances would need Redis and a job queue.

## Deployment
`render.yaml` (Docker web service, health check `/api/health`), Neon `DATABASE_URL`, R2 `S3_*`. See `DEPLOY.md`.
`docker-compose.yml` runs the same image with local Postgres. CI is in `.github/workflows/ci.yml` (pytest + frontend build).
