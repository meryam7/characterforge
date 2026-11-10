# Known issues, gotchas and tech debt

Last verified 2026-11-05. Add new ones here instead of re-discovering them.

## Platform gotchas (important)
1. **Free plan CPU is about 10 ms per request.** No image processing on the server. PBKDF2 at 100k iterations is the maximum and works in production.
2. **Workers AI**: "nsfw" in negative_prompt makes the output black. DreamShaper img2img is also black. Blank outputs are rejected
   (<8 KB). `env.AI.run` must be called as a method. AI doesn't work in local `wrangler pages dev`.
3. **D1**: row ≤ 2 MB (uploads capped at 1.5 MB), ≤ 100 bound parameters, 5 GB free storage, 100k writes per day free.
4. **R2 isn't enabled** (it needs a card). If it's enabled later, move `files` to R2: replace `prepareFile`/`deleteFiles`/`routes/files.ts`.
5. **This dev machine**: git needs `http.sslBackend=schannel`. Node `fetch` to Cloudflare times out unless you pass
   `--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000`. `*.r2.cloudflarestorage.com` is unreachable.

## Open
- Local dev through Vite (:5173 → wrangler :8788): the CSRF Origin check accepts the local dev origins only when
  `ENVIRONMENT = "development"` (top-level `[vars]` in wrangler.toml). Never set that value on staging/production.
- Legal pages contain placeholders (`OPERATOR`, `CONTACT_EMAIL`, `GOVERNING_LAW` in `frontend/src/lib/legal.ts`): fill them
  in before launch, and have the texts reviewed by a lawyer for your country.
- Server error messages are English; the UI translates the common ones (`i18n.fr.ts` "server messages" block). New
  `fail()` texts shown to users need a French entry. The daily-AI-limit message (contains a number) stays English.
- Local `wrangler pages dev` may fail with SQLITE_READONLY when the repo sits in OneDrive: use
  `--persist-to <folder outside OneDrive>` for both `d1 migrations apply --local` and `pages dev`.
- Security model, review and accepted risks: `docs/SECURITY.md`.
- Testing from this PC: sign-ups are limited to 20/h per IP, so repeated test runs can hit 429. Wait or use another network.
- `wrangler d1 export` writes images as >100 KB statements that D1 can't import. Restore only via `scripts/restore-test.mjs`
  (it splits them).
- Auto mode blocks production deploys and raw SQL on production from Claude sessions. A human runs `npm run deploy:production`
  or the GitHub workflow.
- The consistency score is a colour histogram (CLIP isn't available on Workers AI). It's a rough signal.
- Rate limits and the AI quota are per user. A determined attacker could create many accounts (register is limited to 20/hour per IP; the security console shows such patterns).
- Gallery moderation is manual: admins (`ADMIN_EMAILS` var) call `DELETE /api/designs/:id/publish`. There's no admin UI.
- Background removal is imperfect on AI images with shadows (see `EXPORT_GODOT.md`).
- Konva/three chunks are large (about 210 KB gzipped). They load only in the studio.

## Keep in sync
`STYLES` (`server/ai.ts` ↔ `frontend/src/lib/types.ts`) · output shapes (`server/db.ts` ↔ `types.ts`) · history actions
(`db.ts ACTIONS` ↔ `types.ts ActivityAction` ↔ `HistoryView META`) · `slug` (`lib/format.ts`, used by exports).
