# Frontend details

The quick reference is `frontend/CLAUDE.md`. This file covers behaviour in depth.

## Screens
- **Logged out**: `Landing` shows the hero, 3 feature cards, `AuthForm` (sign up / log in) and the 12 newest community designs.
- **Logged in**: `Sidebar` (nav, characters, user box) plus one of these views, chosen by `location.hash`:
  - `#/studio`: `Studio` (canvas or 3D, Generate/Edit/Export panels, design strip)
  - `#/history`: `HistoryView` (activity log, load older, clear, "Open" → studio)
  - `#/gallery`: `CommunityGallery` (public grid, load more)

## State
`App.tsx`: `user`, `checking` (session restore), `view`, `characters`, `charId`, `busy`, `error`, and
`newCharacterSignal` (a Sidebar "New character" click opens the modal inside the lazy `Studio`).
`Studio.tsx`: `designs`, `designId`, modal, `editMode`, `pointPositive`, `points`, `segment`, `show3D`, `segSeq`.

## Behaviours worth knowing
- `run(label, fn)` sets the busy label and clears it only if it's still the same label, so overlapping calls don't hide each other's toast.
- On 401, `api.ts` clears the token and dispatches `LOGGED_OUT_EVENT`, and `App` returns to the landing page.
- Segment: each click sends **all** points. Responses that arrive after a newer click (or after a reset) are ignored.
- Publish toggles `design.is_public` locally after the API call. The Gallery strip shows "shared".
- Downloads use fetch + blob because `<a href>` can't send the Authorization header. Images (`/files`) need no auth.
- `Preview3D` requests `export?format=transparent&preview=true` so the 3D view doesn't add an "exported" history entry.
- Bundles: the landing page is about 51 KB gzipped JS. `konva` and `three` are separate chunks, loaded with the Studio and the 3D view.

## Styling
Colours `ink-950 #0b0614`, `ink-900 #120a20`, `ink-800 #1a102e`, violet/fuchsia gradients, `shadow-glow`. Fonts are
Figtree (sans) and Unbounded (display), from Google Fonts. `prefers-reduced-motion` disables animation.
