# Data model (Cloudflare D1, `migrations/*.sql`)

| Table | Columns (notes) |
|---|---|
| `users` | id, email (UNIQUE NOCASE), display_name, password_hash (`pbkdf2$100000$salt$hash`), **mfa_secret** (AES-GCM `v1.iv.ct`), **mfa_enabled**, **mfa_last_step** (TOTP replay guard), **password_changed_at**, created_at |
| `sessions` | id_hash (SHA-256 of the cookie token, PK), user_id → users CASCADE, mfa, expires_at (30 d), last_seen (7 d idle), ip_hash, user_agent |
| `mfa_recovery_codes` | (user_id, code_hash SHA-256) PK, used_at |
| `auth_challenges` | id_hash PK, user_id, kind (`mfa_verify`/`mfa_enrol`), attempts (max 5), expires_at (5 min) |
| `security_events` | id, ts, type, severity (info/warn/alert), user_id, subject (keyed hash of email/key), ip_hash, path, detail (redacted JSON), created_at. 90-day retention |
| `characters` | id, user_id → users CASCADE, name, description, style, seed, reference_key, embedding, created_at |
| `designs` | id, character_id → characters CASCADE, parent_id, kind, source, prompt, image_key, consistency, is_public, published_at, created_at |
| `activities` | history. user_id, action, character_id/design_id (no FK), character_name, detail, thumb_key, created_at |
| `files` | key PK (`d/` `r/` `t/`), user_id, content_type, data BLOB, created_at |
| `rate_limits` | key PK (IP/user hashes, never raw emails), window_start, count |
| `ai_usage` | (user_id, day) PK, count |

Nothing secret is stored in plain text: passwords use PBKDF2, session tokens and recovery codes are SHA-256 hashed,
TOTP secrets are encrypted with `MFA_ENCRYPTION_KEY`, and IPs and emails in logs are keyed hashes.

## Changing the schema
1. New file `migrations/000N_description.sql`. Never edit an applied one.
2. `npm run db:migrate:local`, test, `npm run deploy:staging` (migrates staging), run the test suites.
3. The production migration runs as part of `npm run deploy:production`, after a backup (`docs/BACKUP.md`).
4. Update `server/env.ts` row types, the `*Out` shapes in `server/db.ts`, and `frontend/src/lib/types.ts`.

## Added in 0003_growth_trust
`likes` (user_id, design_id) PK · `designs.like_count` (denormalised, popular index) · `characters.remixed_from` (design id) ·
`reports` (design_id, reporter_id UNIQUE, reason, note, status open|dismissed|removed, resolved_at) ·
`users.terms_version`, `users.terms_accepted_at`. All cascade with their user/design.
