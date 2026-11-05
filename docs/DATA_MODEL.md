# Data model (`backend/app/models.py`, migrations in `backend/migrations/versions/`)

All datetimes are `DateTime(timezone=True)` defaulting to `utcnow()` (SQLite returns them naive, and `schemas.UTCDateTime` fixes that).

## `users`
id PK · email (254, unique, stored lowercase) · display_name (40, shown in the gallery) · password_hash (scrypt) · created_at

## `characters`
| Column | Notes |
|---|---|
| user_id str(64), indexed | `str(User.id)`. A string for historical reasons, so no FK. The gallery joins with `cast(User.id, String)` |
| name, description, style | description goes into every prompt. style is a key of `ai.STYLES` |
| seed | identity seed reused by every generate and inpaint |
| reference_path | storage key or null |
| embedding JSON | identity vector (64-dim mock / 512-dim CLIP). Rebuilt automatically on dimension mismatch |

Relationship `designs` (ordered by id, cascade delete-orphan).

## `designs`
character_id FK (CASCADE) · parent_id (source design of an edit, not an FK) · kind `generate|edit` · prompt ·
image_path · consistency (cosine vs character embedding) · **is_public** (indexed) · **published_at** · created_at

## `activities` (history)
user_id (indexed) · action (`created reference generated edited exported published unpublished deleted`) ·
character_id / design_id (**no FK**, so entries survive deletes) · character_name (snapshot) · detail · thumb_path
(own copy in `history/<user_id>/`) · created_at (indexed)

## Storage keys
`references/<hex>.png`, `designs/<hex>.png`, `masks/<design_id>/<mask_id>.png` + `_overlay.png`, `history/<user_id>/<hex>.png`.

## Schema changes
1. Edit `models.py`.
2. From `backend/`, run `.venv\Scripts\python -m alembic revision --autogenerate -m "describe"`.
3. Review the generated file, and set `server_default` for new NOT NULL columns on tables that already have rows.
4. Run the tests. Migrations apply automatically at startup (`database.migrate()`), on Neon too.
