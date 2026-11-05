# Frontend details

The quick reference is `frontend/CLAUDE.md`.

## Screens
- Logged out: `Landing` shows the hero, features, `AuthForm` and the 12 newest community designs.
- Logged in: `Sidebar` (nav, characters, account box) plus a view chosen by hash: `#/studio`, `#/history`, `#/gallery`.

## Studio behaviour (`components/Studio.tsx`)
- On mount it calls `api.aiStatus()`. The header chip shows "AI · N left today", "AI limit reached · preview art" or
  "Preview art mode".
- Generate and edit run through `renderDesign`/`renderEdit`. If the result came from the fallback, an amber notice explains why.
- Selection is instant and local: every click recomputes `regionMask(designPixels, points)`. Pixels of the current design
  are cached in a ref (`pixels`).
- Exports are built in the browser (`lib/engine/exporting.ts`) and then logged via `api.logExport`.
- The publish toggle updates `design.is_public` locally after the API call.
- `run(label, fn)` in `App.tsx` clears the busy toast only if its label is still current.

## Styling
Colours `ink-950/900/800`, violet/fuchsia gradients, `shadow-glow`. Fonts are Figtree and Unbounded (Google Fonts).
Bundles: the landing page is about 51 KB gzipped JS. `konva` and `three` are separate lazy chunks.
