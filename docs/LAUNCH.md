# Launch & promotion plan

Already built into the app:
- Landing page with a sign-up form and a live community gallery.
- SEO and social previews in `frontend/index.html`: title, description, Open Graph and Twitter tags,
  `og-image.png` (1200×630), JSON-LD `WebApplication`, `robots.txt` and a favicon. The links use `VITE_SITE_URL`.
- A public community gallery, so every shared design is social proof.

## Before you announce
1. The app is live at https://characterforge-3u3.pages.dev. A custom domain (`DEPLOY.md`) looks more trustworthy.
2. Seed the community gallery with 15–30 good characters across all styles, from your own account.
3. Paste your URL into https://www.opengraph.xyz to check the share preview.
4. Watch the Workers AI daily allowance (Dashboard > AI). When it runs out, visitors get preview art until the next day. Lower `AI_DAILY_LIMIT` if many people sign up.
5. Pitch the workflow (identity lock, click-to-edit, Godot/sprite export), not raw image quality (SD 1.5 class models).

## Where to post (game devs and artists)
| Channel | Angle |
|---|---|
| Reddit r/godot, r/gamedev, r/IndieDev, r/aigamedev | "I built a free tool that exports consistent characters as a Godot 4 pack", with a GIF of the export opening in Godot |
| itch.io | publish it as a free "tool" page that links to the site (itch has strong organic discovery) |
| Product Hunt | launch on a Tuesday–Thursday with 4–5 screenshots and the GIF |
| X / Bluesky / Mastodon (#gamedev #indiedev #godotengine) | short clips: select hair, recolour, export |
| Discord: Godot, GDQuest, indie dev servers | in their #showcase channels, following each server's rules |
| Hacker News "Show HN" | technical angle: a full AI app on the Cloudflare free tier (Pages + D1 + Workers AI), image processing in the browser to fit the 10 ms CPU limit |
| YouTube Shorts / TikTok | 30-second "character to Godot sprite" speedrun |

## Measure
Add privacy-friendly analytics (Plausible, Umami or Cloudflare Web Analytics) with a single `<script>` in
`frontend/index.html`. Track sign-ups (`SELECT COUNT(*) FROM users` via `wrangler d1 execute characterforge --remote`) and the number of shared designs.

## Next features that drive sharing
Public share links per design (`/#/d/<id>`), "remix this character" from the gallery, likes, an expression or pose sheet
export, and a higher-quality model once there's budget.
