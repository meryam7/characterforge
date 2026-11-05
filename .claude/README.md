# .claude/ — Claude Code project config

| Path | Purpose |
|---|---|
| `settings.json` | *(Must be added by the user: Claude can't write its own permissions.)* Shared permissions: auto-allows the safe verify/dev commands and **denies reads** of `.venv`, `node_modules`, `package-lock.json`, `dist`, `storage`, `*.db`, `.env` (saves tokens and protects secrets). |
| `settings.local.json` | Your personal overrides (git-ignored, create it if needed). |
| `agents/backend-engineer.md` | FastAPI/SQLAlchemy/storage/export work (sonnet). |
| `agents/frontend-engineer.md` | React/TS/Tailwind/Konva/three.js work (sonnet). |
| `agents/ai-pipeline-engineer.md` | `services/ai.py`: diffusion, SAM2, CLIP, mock mode (opus). |
| `agents/code-reviewer.md` | Read-only review against project rules (sonnet). |
| `agents/docs-keeper.md` | Keeps the CLAUDE.md files and docs accurate and short (haiku). |
| `commands/check.md` | `/check`: smoke test, typecheck and tests. |
| `commands/dev.md` | `/dev`: start both dev servers. |
| `commands/add-endpoint.md` | `/add-endpoint <feature>`: full-stack checklist. |
| `commands/review.md` | `/review [files]`: run the reviewer agent. |
| `commands/sync-docs.md` | `/sync-docs [area]`: fix doc drift. |

Doc hierarchy (cheapest first): root `CLAUDE.md` (always loaded), then `backend/CLAUDE.md` / `frontend/CLAUDE.md`
(loaded when working in that folder), then `docs/*.md` (opened only on demand).
