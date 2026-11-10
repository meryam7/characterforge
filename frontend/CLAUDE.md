# Frontend — Claude guide (React 18 + TS + Vite, `frontend/src/`)

Commands: `npm run dev` (:5173, proxies `/api` → wrangler on :8788), `npx tsc --noEmit`, `npm run build` (→ `dist/`,
deployed as static assets on Cloudflare Pages). Never open `node_modules/`, `package-lock.json` or `dist/`.

## Component map
| File | Role |
|---|---|
| `App.tsx` | Auth state + session restore, hash views `#/studio` `#/history` `#/gallery`, characters list, `run(label, fn)` (busy toast + error banner). Logged out → `Landing`. `Studio` is lazy. |
| `lib/api.ts` | `api.*`, `ApiError(status, message, data)` (`data.fallback` = use placeholder art). Session = HttpOnly cookie (JS never sees it). Sends `X-CSRF-Token` from the `__Host-csrf` cookie and retries once on a CSRF 403. 401 → `LOGGED_OUT_EVENT`. |
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
| `components/AuthForm.tsx` + `Mfa.tsx` | Login/sign-up state machine: credentials → MFA code or MFA enrolment (QR via `qrcode-generator`) → recovery codes. |
| `components/SettingsView.tsx` | Settings: account + **Log out** (only place), Appearance (theme Dark/Light/Same as my device, language), MFA, password, sessions, delete account. |
| `lib/theme.ts` · `public/theme-init.js` | Theme mode (localStorage `charaforge_theme`), applied before first paint by theme-init.js (external file: CSP forbids inline scripts), follows the OS in "system". |
| `components/SecurityView.tsx` | Admin security console (lazy; server enforces admin + MFA). |
| `components/CommunityGallery.tsx` | Gallery (New/Popular) + `DesignCard` (like, start from this, copy link, report dialog). Shared by the share page. |
| `components/ShareView.tsx` | `/d/<id>` page (App reads `location.pathname`). Works logged out. |
| `components/LegalView.tsx` | Privacy / Terms / Content Policy (`#/privacy` `#/terms` `#/content-policy`), `LegalLinks`, `CookieNotice`. |
| `lib/i18n.tsx` · `lib/i18n.fr.ts` · `lib/legal.ts` | `useI18n()` → `t()`, `LanguageSwitch`; French strings; legal texts EN/FR. |
| `components/{Landing,Sidebar,HistoryView,Gallery,CharacterModal,ConfirmButton}.tsx` | Screens and widgets. |

## Conventions
- Pixel work only in `lib/engine`. Components call engine functions inside `run()`.
- Text: always `t('English', {vars})` (`const { t } = useI18n()`), then add French in `lib/i18n.fr.ts`; `npm run check:i18n`.
  Dates via `timeAgo()` follow the UI language. Language choice is stored in localStorage (`charaforge_lang`).
- Designs are normalised to 512×768 on white and uploaded as WebP (plus a 160×240 thumbnail).
- Styling uses Tailwind + component classes in `src/index.css` (`panel`, `btn-primary`, `btn-ghost`, `input`, `label`, `chip`,
  `checker`). Icons come from `lucide-react`. React stays 18. Use `ConfirmButton`, never `window.confirm`.
- `index.html` uses `%VITE_SITE_URL%` from `.env.production` / `.env.staging` (`vite build --mode staging`).
- **Themes**: colours `ink-*`, `violet-50..300` and `white` are CSS variables (`src/index.css`, `[data-theme=light|dark]`), so
  normal classes are theme-safe. `white` = foreground/overlay colour (dark violet in light mode): use `bg-[#fff]` /
  `text-[#fff]` for a real white (image backdrops, text on the purple button), `.brand-text` for the gradient logo text.
  New pastel status text colours (`text-*-200/300`) need a light-mode override in `index.css`.
- Security: strict CSP in `public/_headers` (no inline scripts, no eval, so don't add any). Never `dangerouslySetInnerHTML`/
  `innerHTML`, never tokens in `localStorage` (`npm run check:security` enforces this). Form fields need unique ids.
