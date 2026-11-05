# Known issues, gotchas and tech debt

Last verified 2026-11-05. Add new ones here instead of re-discovering them.

## Fixed (2026-11-05), for context
MOCK_AI embedding-dimension crash (auto re-embed) · masks never deleted (now per design, TTL 6h, removed after
edit and on delete) · CWD-relative config (anchored to `backend/`) · no migrations (Alembic) · `utcnow`
deprecation · `window.confirm` (`ConfirmButton`) · out-of-order segment responses (`segSeq`) · pseudo-auth
(email+password JWT) · local-only storage (R2 backend) · download URL revoked too early · 945 KB landing bundle
(lazy chunks).

## Open
1. **`/files` is public.** Anyone with an image URL can fetch it. Names are random 128-bit ids, so URLs can't be guessed. Use signed URLs if privacy matters more.
2. **Mock-mode art in production.** The online version shows placeholder figures until a GPU backend exists (`AI_PIPELINE.md`).
3. **Background removal** fails for characters touching the image border or wearing white connected to it (`EXPORT_GODOT.md`).
4. **In-memory rate limiter and GPU lock**: per process only. Running several instances needs Redis and a job queue.
5. **JWT in localStorage** is readable by any XSS. There's no `dangerouslySetInnerHTML` in the app, so keep it that way.
   There's no password reset or email verification yet (needs an email provider).
6. **Render free plan** sleeps after 15 minutes, giving about a 50s cold start. Neon free also suspends (about 1s wake).
7. **Gallery moderation** is manual: admins unpublish via the API (`DELETE /api/designs/{id}/publish`). There's no admin UI yet.
8. R2 is unreachable from the dev machine (TLS handshake blocked), so S3 code paths are only exercised on Render.

## Duplication to keep in sync
`STYLES` (`ai.py` ↔ `types.ts`) · slug (`export.slug` ↔ `lib/format.ts`) · `CharacterLoader.gd`
(`backend/app/assets/` ↔ `godot/`) · API types (`schemas.py` ↔ `types.ts` ↔ `api.ts`) · history actions
(`services/history.ACTIONS` ↔ `types.ts ActivityAction` ↔ `HistoryView META`).

## Environment mismatch
Local Python 3.15 and Node 24, versus Docker/CI Python 3.11 and Node 20.
