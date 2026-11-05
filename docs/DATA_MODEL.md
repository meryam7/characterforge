# Data model (Cloudflare D1, `migrations/*.sql`)

| Table | Columns (notes) |
|---|---|
| `users` | id, email (UNIQUE, NOCASE, stored lowercase), display_name, password_hash (`pbkdf2$iter$salt$hash`), created_at |
| `characters` | id, user_id → users (CASCADE), name, description, style, seed (identity), reference_key, embedding (JSON 64-dim), created_at |
| `designs` | id, character_id → characters (CASCADE), parent_id, kind (generate/edit), source (ai/mock), prompt, image_key, consistency, is_public, published_at, created_at |
| `activities` | history. user_id, action, character_id/design_id (**no FK**, survive deletes), character_name (snapshot), detail, thumb_key, created_at |
| `files` | key PK (`d/` design, `r/` reference, `t/` thumbnail), user_id, content_type, data BLOB, created_at |
| `rate_limits` | key PK, window_start, count (fixed window, upserted) |
| `ai_usage` | (user_id, day) PK, count |

History actions: `created reference generated edited exported published unpublished deleted`.
Timestamps: `strftime('%Y-%m-%dT%H:%M:%SZ','now')` defaults.

## Changing the schema
1. Add `migrations/000N_description.sql` and never edit an applied file.
2. Run `npm run db:migrate:local`, test, then `npm run db:migrate:remote` **before** deploying code that depends on it.
3. Update `server/env.ts` row types, the `*Out` shapes in `server/db.ts`, and `frontend/src/lib/types.ts`.

Inspect production data: `npx wrangler d1 execute characterforge --remote --command "SELECT COUNT(*) FROM users"`.
