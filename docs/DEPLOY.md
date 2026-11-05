# Deploy CharaForge online (free tier)

Architecture: **one Render web service** (Docker: FastAPI + built React app on the same URL),
**Neon** PostgreSQL (database), **Cloudflare R2** (images). Everything below is free to start.

```
browser ──► https://charaforge.onrender.com ──► FastAPI (Render, Docker)
                                                  ├─ Neon Postgres  (DATABASE_URL)
                                                  └─ Cloudflare R2  (S3_* vars)
```

## 1. Cloudflare R2 (images)
1. Cloudflare dashboard > **R2 Object Storage** > **Create bucket**, name it `charaforge` (location Automatic).
   The bucket stays **private**, because the app serves images itself through `/files/...`.
2. R2 > **Manage R2 API Tokens** > Create token with **Object Read & Write** on bucket `charaforge`.
   Keep the **Access Key ID**, **Secret Access Key** and the endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
   The general Cloudflare API token (`cfat_...`) is **not** needed by the app.

## 2. Neon (database)
1. https://neon.tech > sign up > **New project** (choose the region closest to your Render region, e.g. Frankfurt / Oregon).
2. Dashboard > **Connection string**. Copy the `postgresql://...?sslmode=require` string. Tables are created
   automatically on first start (Alembic migrations run at startup).

## 3. GitHub
Render deploys from a Git repository.
1. https://github.com/new > name `charaforge` > **Private** or Public > *don't* add a README.
2. In a terminal at the project root (the repo is already initialised and committed):
   ```powershell
   git remote add origin https://github.com/<YOUR_USER>/charaforge.git
   git push -u origin main
   ```
   `.env`, `*.db`, `storage/`, `node_modules/` and `.venv/` are git-ignored, so no secrets are pushed.
   GitHub Actions (`.github/workflows/ci.yml`) then runs the backend tests and the frontend build on every push.

## 4. Render (the app)
1. https://render.com > sign up with GitHub > **New** > **Blueprint** > select the `charaforge` repo.
   Render reads `render.yaml` and asks for the secret values:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string |
   | `S3_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 token keys |
   | `VITE_SITE_URL` | `https://charaforge.onrender.com` (your service URL, no trailing slash) |
   | `CORS_ORIGINS` | same as `VITE_SITE_URL` |
   | `ADMIN_EMAILS` | your email (lets you remove community posts) |

   `SECRET_KEY` is generated automatically. `MOCK_AI=true`, `STORAGE_BACKEND=s3` and `ENVIRONMENT=production` are preset.
2. **Apply**. The first build takes about 5 minutes. If the service name is taken, Render gives a different
   URL. Update `VITE_SITE_URL` and `CORS_ORIGINS` to match, then **Manual Deploy**.
3. Check `https://<your-app>.onrender.com/api/health`. It should return `{"status":"ok","mock_ai":true,"storage":"s3"}`.
4. Sign up with the email you put in `ADMIN_EMAILS`, create a character, generate, and share it. Then check that the
   image shows up and appears in R2 > bucket > `designs/`.

Free plan notes: the service sleeps after 15 minutes without traffic, and the first visit after that takes about
50 seconds. Upgrade to Starter (about $7/month) when you start promoting, so visitors never see the cold start.

## 5. Custom domain (optional, recommended for promotion)
Buy a domain (e.g. on Cloudflare Registrar), then go to Render > service > **Settings > Custom Domains** > add
`charaforge.app`. Create the DNS record Render shows you. HTTPS is automatic. Then set `VITE_SITE_URL` and
`CORS_ORIGINS` to the new domain and redeploy.

## 6. After launch
- **Rotate keys that were shared anywhere** (chat, screenshots): R2 > API tokens > roll, then update Render env vars.
- Neon free has 0.5 GB of storage and R2 free has 10 GB. Both are plenty for mock-mode images (each design is about 30 KB).
- Logs: Render > service > **Logs**. The API docs (`/docs`) are disabled in production.
- To enable real AI later, see `docs/AI_PIPELINE.md`. It needs a GPU host and `INSTALL_AI=true`.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Build fails at `npm ci` | `frontend/package-lock.json` must be committed |
| `RuntimeError: SECRET_KEY must be set` | the blueprint generates it, so set it manually if the service was created by hand |
| 500 errors on generate, R2 errors in logs | check the bucket name, the token permission (Object Read & Write) and the endpoint URL (no bucket name in it) |
| `could not connect` / SSL errors to Neon | use the full Neon string including `?sslmode=require` |
| Images 404 after a redeploy | `STORAGE_BACKEND` is not `s3` (Render's disk is wiped on every deploy) |

## Local production-like run
`docker compose up --build`, then open http://localhost:8000. This runs the same image with a local Postgres
and disk storage.
