# Frontend — Claude guide (React 18 + TS + Vite, `frontend/src/`)

Commands: `npm run dev` (:5173, proxies `/api` → wrangler on :8788), `npx tsc --noEmit`, `npm run build` (→ `dist/`,
deployed as static assets on Cloudflare Pages). Never open `node_modules/`, `package-lock.json` or `dist/`.

## Component map
| File | Role |
|---|---|
| `App.tsx` | Auth state + session restore, hash views `#/studio` `#/history` `#/gallery`, characters list, `run(label, fn)` (busy toast + error banner). Logged out → `Landing`. `Studio` is lazy. |
| `lib/api.ts` | `api.*`, `ApiError(status, message, data)` (`data.fallback` = use placeholder art), token in localStorage, 401 → `LOGGED_OUT_EVENT`. |
| `lib/types.ts` | Mirrors server output shapes + `STYLES`. |
| `lib/format.ts` | `slug()`, `timeAgo()`. |
| `lib/engine/index.ts` | `renderDesign` / `renderEdit` (Workers AI first, placeholder fallback), `saveDesign`, `saveReference`, `anchorFor`. |
| `lib/engine/image.ts` | Canvas helpers: `normalize` (512×768 white), `shrink`, `toBlob`, `toPngBase64`, seeded `rng`, `hash`. |
| `lib/engine/mock.ts` | `mockCharacter(prompt, seed)` placeholder art, `mockInpaint`. |
| `lib/engine/select.ts` | `floodRegion`/`regionMask` (click selection), `dilate`, `overlayUrl`, `maskPngBytes`, `composite`. |
| `lib/engine/identity.ts` | `embed` (64-bin colour histogram), `similarity` (consistency %). |
| `lib/engine/exporting.ts` | `removeBackground`, `transparentPng`, `spriteSheetZip`, `godotZip` (fflate), `saveBlob`. |
| `assets/CharacterLoader.gd` | Godot 4 script bundled into the Godot pack (`?raw` import). |
| `components/Studio.tsx` | Studio state: designs, selection (client-side mask), AI status chip, notices, exports, publish. |
| `components/Panels.tsx` | `GeneratePanel`, `EditPanel`, `ExportPanel` (`ExportKind`). |
| `components/CanvasStage.tsx` | Konva stage. Clicks become image-pixel points. |
| `components/Preview3D.tsx` | three.js standee from `transparentPng(design)` (lazy). |
| `components/{Landing,AuthForm,Sidebar,HistoryView,CommunityGallery,Gallery,CharacterModal,ConfirmButton}.tsx` | Screens and widgets. |

## Conventions
- Pixel work only in `lib/engine`. Components call engine functions inside `run()`.
- Designs are normalised to 512×768 on white and uploaded as WebP (plus a 160×240 thumbnail).
- Styling uses Tailwind + component classes in `src/index.css` (`panel`, `btn-primary`, `btn-ghost`, `input`, `label`, `chip`,
  `checker`). Icons come from `lucide-react`. React stays 18. Use `ConfirmButton`, never `window.confirm`.
- `index.html` uses `%VITE_SITE_URL%` for social tags (set at build: `VITE_SITE_URL=https://characterforge-3u3.pages.dev`).
