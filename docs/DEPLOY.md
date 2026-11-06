# Environments and deployment

| | Production | Staging (testing environment) |
|---|---|---|
| URL | https://characterforge-3u3.pages.dev | https://staging.characterforge-3u3.pages.dev |
| Pages branch / env | `main` / production | `staging` / preview |
| D1 | `characterforge` (4ee33c02…) | `characterforge-staging` (f69507c9…) |
| Secrets | own `MFA_ENCRYPTION_KEY`, `LOG_HASH_SALT` | own (different) values |
| Admin | `ADMIN_EMAILS` in `wrangler.toml [env.production.vars]` (set yours) | `admin-staging@example.com` (test suite) |
| AI per user/day | 40 | 10 |

Scratch DB for restore tests: `characterforge-restore-test`.

## Release procedure (always staging first)
```powershell
npx wrangler login                 # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npm run deploy:staging             # build (staging URL) → static security checks → staging migrations → deploy
$env:BASE="https://staging.characterforge-3u3.pages.dev"
npm run smoke; npm run test:security
# only when both pass:
$env:BACKUP_PASSPHRASE = Get-Content $HOME\.charaforge-backup-passphrase.txt
npm run backup -- characterforge   # safety backup
npm run deploy:production          # build → checks → production migrations → deploy
$env:BASE="https://characterforge-3u3.pages.dev"; npm run smoke
```
GitHub does the same: pushes to `main` deploy to staging and run both suites (`ci.yml`). Production deploys only via
**Actions → Deploy to production → Run workflow** (`deploy-production.yml`), which re-tests staging, backs up, migrates,
deploys and smoke-tests. Protect the `production` environment with required reviewers.

GitHub repository secrets needed: `CLOUDFLARE_API_TOKEN` (Pages Edit, D1 Edit, Workers AI Read), `CLOUDFLARE_ACCOUNT_ID`
(`eccb044ef6ce29580212fae6ff9428a0`) and `BACKUP_PASSPHRASE`. Without them, CI still runs every check but skips deploys and backups.

## Secrets (Cloudflare encrypted secret store, server-side only)
| Secret | Purpose | Rotate |
|---|---|---|
| `MFA_ENCRYPTION_KEY` | AES-256 key for TOTP secrets at rest (base64, 32 bytes) | rotating it breaks existing MFA enrolments (users must re-enrol). Plan before rotating |
| `LOG_HASH_SALT` | pseudonymises IPs/emails in security logs | anytime (breaks correlation with older logs only) |
| `ALERT_WEBHOOK_URL` (optional) | Discord/Slack webhook for security alerts | anytime |
```powershell
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler pages secret put MFA_ENCRYPTION_KEY --project-name characterforge --env production
npx wrangler pages secret put ALERT_WEBHOOK_URL --project-name characterforge --env production   # paste the webhook URL
```
None of these ever reach the browser. `npm run check:security` fails the build if a secret name or token appears in the bundle.
Local dev reads them from `.dev.vars` (git-ignored). The old `JWT_SECRET` is no longer used and can be deleted.

## Free-tier limits
Pages Functions: 100k requests/day. D1: 5 GB, 5M reads and 100k writes per day (each security event is one write).
Workers AI: 10k neurons/day.
