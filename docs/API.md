# HTTP API

Base: same origin as the site (dev: `http://localhost:8000`). `/docs` and `/openapi.json` exist outside production only.
Auth: `Authorization: Bearer <token>` from register or login (a JWT, valid for `TOKEN_DAYS`, default 30).
Missing or invalid tokens get **401**. Rows owned by someone else return **404**. Rate limits return **429**.
Errors use `{"detail": "..."}` (422 → `detail` is a list). Datetimes are ISO-8601 UTC with `Z`.

## Shapes (`backend/app/schemas.py` ↔ `frontend/src/lib/types.ts`)
```ts
RegisterIn  { email, password (8-128), display_name (2-40) }      LoginIn { email, password }
TokenOut    { token, user: UserOut }      UserOut { id, email, display_name, is_admin, created_at }
CharacterCreate { name (1-120), description (≤2000), style (≤60, default "anime") }
CharacterOut { id, name, description, style, seed, reference_url|null, cover_url|null, design_count, created_at }
DesignOut   { id, character_id, parent_id|null, kind: "generate"|"edit", prompt, consistency|null, image_url, is_public, created_at }
GenerateIn  { prompt (≤500), lock_identity=true }
SegmentIn   { points: [{x, y, positive=true}] (1-20) }   // IMAGE pixel coords
SegmentOut  { mask_id (32 hex), overlay_url, coverage }
EditIn      { mask_id, prompt (1-500) }
ActivityOut { id, action, character_id|null, character_name, design_id|null, detail, thumb_url|null, character_exists, created_at }
HistoryPage { items: ActivityOut[], next_before|null }
PublicDesignOut { id, image_url, prompt, kind, character_name, style, author, published_at }
GalleryPage { items: PublicDesignOut[], next_before|null }
```
Pagination: newest first. Pass `next_before` back as `?before=`.

## Endpoints
| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/health` | – | `{status, mock_ai, storage}` |
| `POST /api/auth/register` | – | 201 TokenOut. 409 if the email exists (case-insensitive). 10/hour/IP |
| `POST /api/auth/login` | – | 401 for wrong credentials. 30/10 min per IP, 10/10 min per email |
| `GET /api/auth/me` | ✓ | UserOut. `is_admin` = email in `ADMIN_EMAILS` |
| `DELETE /api/auth/me` | ✓ | deletes the user, characters, files and history |
| `GET /api/characters` | ✓ | newest first |
| `POST /api/characters` | ✓ | 201. Random seed. History `created` |
| `GET/DELETE /api/characters/{cid}` | ✓ | delete removes designs, masks and the reference. History `deleted` (with cover thumbnail) |
| `POST /api/characters/{cid}/reference` | ✓ | multipart `file` ≤8 MB (413). Invalid image is 400. Resets the embedding. History `reference` |
| `GET /api/characters/{cid}/designs` | ✓ | oldest first |
| `POST /api/characters/{cid}/generate` | ✓ | 201. 30/min/user. History `generated` |
| `POST /api/designs/{did}/segment` | ✓ | mask saved as `masks/{did}/{mask_id}.png` (6h TTL). 120/min/user |
| `POST /api/designs/{did}/edit` | ✓ | 201 kind=edit. The mask must belong to this design (else 404 "Selection expired") and is deleted afterwards |
| `GET /api/designs/{did}/export?format=png\|transparent&preview=false` | ✓ | PNG attachment. History `exported` unless `preview=true` |
| `GET /api/characters/{cid}/export?target=godot\|sheet` | ✓ | zip. 400 if there are no designs. History `exported` |
| `GET /api/history?before&limit(1-100)&character_id` | ✓ | HistoryPage |
| `DELETE /api/history` | ✓ | clears entries and thumbnails |
| `GET /api/gallery?before&limit(1-60)` | – | public GalleryPage |
| `POST /api/designs/{did}/publish` | ✓ owner | DesignOut. History `published` |
| `DELETE /api/designs/{did}/publish` | ✓ owner or admin | History `unpublished` (owner only) |
| `GET /files/{key}` | – | image bytes from local disk or R2. `Cache-Control: immutable` |
