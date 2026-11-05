# CharaForge - AI character design studio

**Live: https://characterforge-3u3.pages.dev**

Describe a character (and optionally upload a reference picture), generate consistent designs with real AI, click any
part to repaint it, and export for games, comics or animation (PNG, transparent PNG, sprite sheet, Godot 4 pack).
Accounts, a personal history of everything you create, and a public community gallery.

Runs entirely on the **Cloudflare free tier**: Pages (website) + Pages Functions (API) + D1 (database and images) + Workers AI
(Stable Diffusion). If the daily AI allowance runs out, the app keeps working with procedural preview art.

Developer and AI-agent docs: [`CLAUDE.md`](CLAUDE.md) (start here), [`AGENTS.md`](AGENTS.md), [`docs/`](docs/).
Deploying: [`docs/DEPLOY.md`](docs/DEPLOY.md) · Promotion: [`docs/LAUNCH.md`](docs/LAUNCH.md)

```
characterforge/
├─ frontend/            React + TypeScript + Tailwind + Konva + three.js (static site)
│  └─ src/lib/engine/   in-browser image engine: selection, compositing, exports, preview art
├─ server/              Hono API (auth, characters, designs, history, gallery, Workers AI proxy, files)
├─ functions/api/       Cloudflare Pages Function entry -> server/
├─ migrations/          D1 schema (SQL)
├─ scripts/smoke.mjs    end-to-end API test
└─ wrangler.toml        Cloudflare config (D1 + AI bindings)
```

## Run locally
Needs Node.js 20+ and Git.
```
npm install
npm --prefix frontend install
echo JWT_SECRET=local-dev-secret > .dev.vars
npm run db:migrate:local
npm run build
npm run dev            # http://127.0.0.1:8788
```
Optional hot reload: `npm run dev:web` (http://localhost:5173). Locally, AI falls back to preview art because Workers AI
only runs in the deployed app. API test: `npm run smoke`.

## Deploy
```
npx wrangler login
npm run db:migrate:remote
npm run deploy
```
Pushes to `main` deploy automatically once the GitHub secrets from [`docs/DEPLOY.md`](docs/DEPLOY.md) are set.

## Godot
Click "Godot pack", unzip into `res://characters/hero/`, add a Node2D, attach `CharacterLoader.gd`, set `character_json`,
and run. Enter/Space cycles through the designs.

## How identity is preserved
One seed per character, the description in every prompt, the reference (or first design) used as an anchor image for
each new variation, a consistency score per design (the % badge), and edits that change only the pixels you selected.
