# Email (verification codes + password reset)

**Why:** an account only becomes usable after its owner types the 6-digit code sent to the email address. Nobody can
create an account with someone else's Gmail/Outlook address, and "Forgot password?" works by email code.

## How it works (server/email.ts, server/routes/auth.ts)
| Step | Behaviour |
|---|---|
| Sign-up / login of an unverified account | `{status: "verify_email_required", challenge, email: "a***@gmail.com"}`. **No session**. A code is emailed |
| `POST /api/auth/email/verify {challenge, code}` | correct code → `email_verified = 1` → MFA step (if any) → session |
| `POST /api/auth/email/resend {challenge}` | new code. 60 s cooldown, 5 per hour per account, 20 per hour per IP |
| `POST /api/auth/password/forgot {email}` | always `{ok:true}` (doesn't reveal if the account exists). 3/hour per email |
| `POST /api/auth/password/reset {email, code, new_password}` | sets the password, marks the email verified, **logs out every session**. MFA still applies at the next login |
Codes: 6 random digits, only a SHA-256 hash is stored, valid 15 min, 5 wrong tries burn the code, one use only.
Emails are bilingual (the user's UI language). Security events: `email_code_failed`, `email_verified`,
`password_reset_requested`, `password_reset_failed`, `password_reset`.

## Turn on real emails (production)
Cloudflare's free plan can't send mail to arbitrary addresses, so use one of these free providers:

| Provider | Free tier | What you need |
|---|---|---|
| **Resend** (recommended) | 3,000 emails/month, 100/day | a domain you own (add 3 DNS records it gives you) |
| **Brevo** | 300 emails/day | a verified sender address (works without owning a domain; a domain improves delivery) |

1. Create the account, verify your domain (Resend) or sender (Brevo), create an **API key** with "send" permission.
2. In `wrangler.toml` `[env.production.vars]`: `EMAIL_PROVIDER = "resend"` (or `"brevo"`) and
   `EMAIL_FROM = "CharaForge <no-reply@your-domain>"` (must match the verified domain/sender).
3. Store the key as a secret (never in the code):
   `npx wrangler pages secret put EMAIL_API_KEY --project-name characterforge --env production`
4. Deploy (`docs/DEPLOY.md`), sign up with your own Gmail and check the code arrives (also in spam the first time).

Without a working provider, production sign-ups answer "We couldn't send the email right now" (503). Verification
can't be skipped. Staging and local use `EMAIL_PROVIDER = "log"`: real addresses' codes appear in the Functions log
(`npx wrangler pages deployment tail --project-name characterforge` or the dashboard), and **@example.com** addresses
go to a test inbox (`GET /api/test/inbox?email=…@example.com`, 404 in production) used by the automated tests.
To test real delivery on staging, set the provider + key with `--env preview` too.
**Local dev** (`ENVIRONMENT=development` + `log`): the code is also returned as `dev_code` and shown on the "Check your
email" screen (never in staging/production). To send real emails locally, put `EMAIL_PROVIDER=brevo`, `EMAIL_FROM=...`
and `EMAIL_API_KEY=...` in `.dev.vars` (it overrides `wrangler.toml` vars).

### Quickest real setup: Brevo (free, no domain needed)
1. Sign up at brevo.com with the address you want to send from (it becomes a verified sender).
2. SMTP & API → API keys → *Generate a new API key*.
3. `[env.preview.vars]` / `[env.production.vars]`: `EMAIL_PROVIDER = "brevo"`, `EMAIL_FROM = "CharaForge <that-address>"`.
4. `npx wrangler pages secret put EMAIL_API_KEY --project-name characterforge --env preview` (and `--env production`), deploy.
A Gmail sender may land in spam; a sender on your own domain (authenticated in Brevo → Senders & domains) delivers best.
