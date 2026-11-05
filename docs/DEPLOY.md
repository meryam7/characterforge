# Deploying (Cloudflare free tier)

**Production:** https://characterforge-3u3.pages.dev · Pages project `characterforge` · D1 database `characterforge`
(`4ee33c02-48a7-4f1b-afb0-ba4cfc578b7e`, WEUR) · workers.dev subdomain `characterforge` · account `eccb044e…428a0`.

## Manual deploy (from your PC)
```powershell
npx wrangler login                      # once (opens the browser), or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run db:migrate:remote               # only when migrations/ changed
$env:VITE_SITE_URL="https://characterforge-3u3.pages.dev"; npm run deploy
```
Then check `https://characterforge-3u3.pages.dev/api/health`, and run the full API test:
`$env:BASE="https://characterforge-3u3.pages.dev"; npm run smoke`.

## Automatic deploy on every push (GitHub Actions)
`.github/workflows/ci.yml` always typechecks and builds. To also deploy on pushes to `main`, add two **repository secrets**
in GitHub > Settings > Secrets and variables > Actions:
- `CLOUDFLARE_API_TOKEN`: a token with *Cloudflare Pages: Edit*, *D1: Edit* and *Workers AI: Read*
  (Cloudflare dashboard > My Profile > API Tokens > Create Token).
- `CLOUDFLARE_ACCOUNT_ID`: `eccb044ef6ce29580212fae6ff9428a0`

The workflow applies remote D1 migrations, then deploys.

## Secrets and settings
| Name | Where | Notes |
|---|---|---|
| `JWT_SECRET` | Pages secret (already set) | rotating it logs everyone out: `npx wrangler pages secret put JWT_SECRET --project-name characterforge` |
| `AI_ENABLED`, `AI_DAILY_LIMIT`, `ADMIN_EMAILS` | `wrangler.toml [vars]` | redeploy after changing |

## Custom domain (optional)
Dashboard > Workers & Pages > characterforge > Custom domains > add your domain. Then rebuild with
`VITE_SITE_URL=https://your.domain` so social previews point to it.

## Free-tier limits to watch
Workers/Pages Functions: 100k requests per day. D1: 5 GB, 5M reads and 100k writes per day. Workers AI: 10k neurons per day
(the beta models used are free). Dashboard > Workers & Pages / D1 / AI show usage.
