# AI pipeline

Two halves: **Workers AI** (server, `server/ai.ts` + `server/routes/ai.ts`) and the **browser engine**
(`frontend/src/lib/engine/`), which prepares inputs, post-processes outputs, and draws placeholder art when AI is unavailable.

## Models (verified on the account, 2026-11-05)
| Use | Model | Params | Time |
|---|---|---|---|
| First design / unlocked | `@cf/lykon/dreamshaper-8-lcm` | prompt, negative_prompt, 512×768, seed | ~5 s |
| Locked variation (identity) | `@cf/runwayml/stable-diffusion-v1-5-inpainting` with a **full-white mask** | image_b64 = anchor, strength 0.7, seed | ~12 s |
| Region edit | same inpainting model with the user's mask | strength 1, then composited client-side | ~10-30 s |

Findings that shaped this:
- DreamShaper img2img (`image_b64` + `strength`) returns an all-black image on Workers AI, which is why identity lock uses inpainting with a full mask.
- The word **"nsfw" in negative_prompt makes the inpainting model return an all-black image.** Never add it.
- Blank output is about 1.2 KB. `toResponse()` rejects anything under 8 KB, and the client then falls back.
- `env.AI.run` must be called as a method (`runner(env)`), not detached.
- AI doesn't work in local `wrangler pages dev` (remote proxy "internal error"), so test against production.

## Flow
1. Generate: `renderDesign()` → `anchorFor()` (reference or first design, normalised to 512×768) → `POST /api/ai/generate`
   → `normalize()` → `saveDesign()` (embed, consistency, WebP + thumbnail upload).
2. Edit: click → `regionMask()` (edge-following flood fill) → `dilate(4)` → `maskPngBytes()` → `POST /api/ai/inpaint` →
   `composite(base, ai, mask)`, so only the selected pixels change.
3. Fallback: `ApiError.data.fallback === true` → `mockCharacter(prompt, seed)` / `mockInpaint()`, and a notice is shown.

Prompt = `description, extra, STYLES[style], full body character design, single character, centered, plain white background`.
Consistency = cosine similarity of 64-bin colour histograms (`identity.ts`) against `characters.embedding`.

## Knobs
`wrangler.toml [vars]`: `AI_ENABLED` ("false" = placeholder art only), `AI_DAILY_LIMIT` (per user per day, default 40).
`server/ai.ts`: `T2I_MODEL`, `INPAINT_MODEL`, `LOCK_STRENGTH`, `NEGATIVE`, `STYLES`.
Free allowance: 10,000 neurons per day per account. The SD 1.5 inpainting and SDXL models used are free beta models at the time of writing.
