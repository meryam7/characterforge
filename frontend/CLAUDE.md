# Frontend — Claude guide (React 18 + TS + Vite, `frontend/src/`)

Commands (from `frontend/`): `npm run dev` (:5173, proxies `/api` + `/files` → :8000), `npx tsc --noEmit`,
`npm run build` (→ `dist/`, served by FastAPI in production). Never open `node_modules/`, `package-lock.json`, `dist/`.

## Component map
| File | Role |
|---|---|
| `App.tsx` | Auth state (`user`, session restore via `api.me`), hash views `#/studio` `#/history` `#/gallery`, `characters` + `charId`, `run(label, fn)` → busy toast + error banner. Logged out → `Landing`. `Studio` is lazy-loaded. |
| `lib/api.ts` | `api.*` methods. `auth` token store (`localStorage['charaforge_token']`). Sends `Authorization: Bearer`. A 401 clears the token and fires `LOGGED_OUT_EVENT`. `download()` = blob + `<a download>`. |
| `lib/types.ts` | Mirrors `backend/app/schemas.py` + `STYLES`. |
| `lib/format.ts` | `slug()` (same as backend `export.slug`), `timeAgo()`. |
| `components/Landing.tsx` | Hero, features, `AuthForm`, compact `CommunityGallery`. |
| `components/AuthForm.tsx` | Sign up / log in tabs. |
| `components/Sidebar.tsx` | Nav (Studio/History/Community), character list, user box (log out, delete account). |
| `components/Studio.tsx` | Designs, selection, edit mode, segment (stale responses dropped via `segSeq`), publish toggle, the panels. |
| `components/HistoryView.tsx` | Paginated activity log. `META` maps each action to its label and icon. "Open" jumps to the character. Clear history. |
| `components/CommunityGallery.tsx` | Public grid with load more (`compact` = first 12, no header). |
| `components/ConfirmButton.tsx` | Inline two-step confirm (replaces `window.confirm`). |
| `components/CanvasStage.tsx` | Konva stage. Clicks become image-pixel points. |
| `components/Panels.tsx` | `GeneratePanel`, `EditPanel`, `ExportPanel` (downloads, 3D toggle, share to community). |
| `components/Gallery.tsx` | Design strip for the current character (kind · consistency % · shared). |
| `components/Preview3D.tsx` | three.js standee (lazy). Fetches the export with `preview=true` so it isn't logged. |

## Conventions
- Function components, typed props. No router library or state library. Global state lives in `App.tsx` and
  studio state in `Studio.tsx`.
- Styling: Tailwind + component classes in `src/index.css` (`panel`, `btn-primary`, `btn-ghost`, `input`, `label`,
  `chip`, `checker`). Colours `ink-950/900/800`, `shadow-glow`, `font-display`. Icons come from `lucide-react`.
- Backend calls only through `api`. Keep heavy libs (three, konva) out of the landing bundle (lazy imports,
  `manualChunks` in `vite.config.ts`).
- `index.html` uses `%VITE_SITE_URL%` (defaulted in `vite.config.ts`) for SEO and social tags. Static assets
  (`favicon.svg`, `og-image.png`, `robots.txt`) live in `public/`.

## Env
`VITE_API_URL` (empty when same origin, which is the default), `VITE_SITE_URL` (public URL, used for og tags).
