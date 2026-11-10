// Share page: /d/<design id>. Serves the SPA (index.html) with Open Graph / Twitter tags for that shared design, so
// links pasted into WhatsApp, Discord, X, Facebook or LinkedIn show the character. Private designs get the default page.
// Only I/O + HTMLRewriter streaming here (free-plan CPU budget). The React app renders the page itself.
type Env = { DB: D1Database; ASSETS: Fetcher }

const clean = (s: string, max: number) =>
  s.replace(/[\u0000-\u001F\u007F<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

export const onRequestGet: PagesFunction<Env> = async ({ params, env, request }) => {
  const url = new URL(request.url)
  const page = await env.ASSETS.fetch(new URL('/', url.origin))
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return page

  const d = await env.DB.prepare(
    `SELECT d.id, d.image_key, d.prompt, d.like_count, ch.name AS character_name, ch.style, u.display_name AS author
     FROM designs d JOIN characters ch ON ch.id = d.character_id JOIN users u ON u.id = ch.user_id
     WHERE d.id = ? AND d.is_public = 1`,
  )
    .bind(id)
    .first<{ image_key: string; prompt: string; like_count: number; character_name: string; style: string; author: string }>()
  if (!d) return page

  const title = clean(`${d.character_name} by ${d.author} | CharaForge`, 120)
  const description = clean(
    `${d.style} character${d.prompt && d.prompt !== 'base design' ? ` - ${d.prompt}` : ''}. Made with CharaForge, the free AI character design studio. Start from this design and make it yours.`,
    300,
  )
  const image = `${url.origin}/api/files/${d.image_key}`
  const canonical = `${url.origin}/d/${id}`
  const set = (value: string) => ({ element: (e: Element) => { e.setAttribute('content', value) } })

  const res = new HTMLRewriter()
    .on('title', { element: (e) => { e.setInnerContent(title) } })
    .on('meta[name="description"]', set(description))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(description))
    .on('meta[property="og:url"]', set(canonical))
    .on('meta[property="og:image"]', set(image))
    .on('meta[property="og:image:width"]', set('512'))
    .on('meta[property="og:image:height"]', set('768'))
    .on('meta[name="twitter:title"]', set(title))
    .on('meta[name="twitter:description"]', set(description))
    .on('meta[name="twitter:image"]', set(image))
    .on('link[rel="canonical"]', { element: (e) => { e.setAttribute('href', canonical) } })
    .transform(page)

  const headers = new Headers(res.headers)
  headers.set('Cache-Control', 'public, max-age=300')
  // same protections as the static site (frontend/public/_headers)
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests")
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(res.body, { status: 200, headers })
}
