# HTTP API (`server/`, base `/api`)

Auth uses `Authorization: Bearer <token>` (JWT from register or login, valid 30 days). Missing or bad tokens get 401.
Another user's rows return 404. Rate limits return 429. Errors look like `{"detail": string, ...}`. Times are ISO-8601 UTC ending in `Z`.

## Shapes (server/db.ts ↔ frontend/src/lib/types.ts)
```ts
User      { id, email, display_name, is_admin, created_at }        AuthResult { token, user }
Character { id, name, description, style, seed, embedding: number[]|null, reference_url|null, cover_url|null, design_count, created_at }
Design    { id, character_id, parent_id|null, kind: 'generate'|'edit', source: 'ai'|'mock', prompt, consistency|null, image_url, is_public, created_at }
Activity  { id, action, character_id|null, character_name, design_id|null, detail, thumb_url|null, character_exists, created_at }
HistoryPage { items: Activity[], next_before|null }     GalleryPage { items: PublicDesign[], next_before|null }
PublicDesign { id, image_url, prompt, kind, source, character_name, style, author, published_at }
AiStatus  { enabled, daily_limit, remaining }
```

## Endpoints
| Method & path | Auth | Notes |
|---|---|---|
| GET `/health` | – | `{status, ai, storage:"d1"}` |
| POST `/auth/register` `{email, password(8-128), display_name(2-40)}` | – | 201. 409 if the email exists. 10/hour per IP |
| POST `/auth/login` `{email, password}` | – | 401 for bad credentials. 30/10 min per IP, 10/10 min per email |
| GET / DELETE `/auth/me` | ✓ | DELETE wipes the user, characters, designs, files and history |
| GET / POST `/characters` `{name, description?, style?}` | ✓ | newest first. Random seed. History `created` |
| GET / DELETE `/characters/:id` | ✓ | DELETE removes designs and the reference. History `deleted` (keeps the thumbnail) |
| POST `/characters/:id/reference` multipart `image, thumb, embedding` | ✓ | replaces the reference + identity vector. History `reference` |
| GET `/characters/:id/designs` | ✓ | oldest first |
| POST `/characters/:id/designs` multipart `image, thumb, kind, source, prompt?, parent_id?, consistency?, embedding?` | ✓ | 201. The embedding is stored only if the character has none yet. 60/min. History `generated`/`edited` |
| POST `/characters/:id/exported` `{detail, design_id?}` | ✓ | history `exported` (exports are built in the browser) |
| GET `/history?before&limit(1-100)&character_id` · DELETE `/history` | ✓ | DELETE also removes thumbnails |
| GET `/gallery?before&limit(1-60)` | – | public, cached for 30 s |
| POST / DELETE `/designs/:id/publish` | ✓ | DELETE is allowed for the owner or `ADMIN_EMAILS` |
| GET `/ai/status` | ✓ | per-user daily allowance |
| POST `/ai/generate` `{character_id, prompt?, anchor_b64?}` | ✓ | → `image/png`, header `X-AI-Remaining`. 503/429 with `fallback:true` on failure or limit. 6/min |
| POST `/ai/inpaint` `{design_id, prompt, image_b64, mask:number[]}` | ✓ | mask = PNG bytes, white = repaint. Same responses as generate |
| GET `/files/:prefix/:name` | – | image bytes, `Cache-Control: immutable`. Keys look like `^[drt]/[a-f0-9]{32}\.(webp|png|jpg)$` |

Uploaded images must be WebP, PNG or JPEG and ≤1.5 MB (415/413 otherwise).
