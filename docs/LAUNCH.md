# Launch & promotion plan

Already built into the app:
- Landing page with a sign-up form and a live community gallery.
- SEO and social previews in `frontend/index.html`: title, description, Open Graph and Twitter tags,
  `og-image.png` (1200×630), JSON-LD `WebApplication`, `robots.txt` and a favicon. The links use `VITE_SITE_URL`.
- A public community gallery, so every shared design is social proof.

## Before you announce
1. Deploy (`DEPLOY.md`) and use a custom domain if possible.
2. Seed the community gallery with 15–30 good characters across all styles, from your own account.
3. Paste your URL into https://www.opengraph.xyz to check the share preview.
4. Move to Render Starter so first-time visitors don't wait through a cold start.
5. Be upfront that the online version currently makes **preview-quality placeholder art** (mock mode). Pitch the
   workflow (identity lock, click-to-edit, Godot/sprite export) until real AI is switched on (`AI_PIPELINE.md`).

## Where to post (game devs and artists)
| Channel | Angle |
|---|---|
| Reddit r/godot, r/gamedev, r/IndieDev, r/aigamedev | "I built a free tool that exports consistent characters as a Godot 4 pack", with a GIF of the export opening in Godot |
| itch.io | publish it as a free "tool" page that links to the site (itch has strong organic discovery) |
| Product Hunt | launch on a Tuesday–Thursday with 4–5 screenshots and the GIF |
| X / Bluesky / Mastodon (#gamedev #indiedev #godotengine) | short clips: select hair, recolour, export |
| Discord: Godot, GDQuest, indie dev servers | in their #showcase channels, following each server's rules |
| Hacker News "Show HN" | technical angle: identity lock via seed + IP-Adapter + CLIP scoring, SAM2 click-to-edit |
| YouTube Shorts / TikTok | 30-second "character to Godot sprite" speedrun |

## Measure
Add privacy-friendly analytics (Plausible, Umami or Cloudflare Web Analytics) with a single `<script>` in
`frontend/index.html`. Track sign-ups (`/api/auth/register` count in Neon) and the number of shared designs.

## Next features that drive sharing
Public share links per design (`/#/d/<id>`), "remix this character" from the gallery, likes, an expression or pose sheet
export, and real AI generation (biggest impact).
