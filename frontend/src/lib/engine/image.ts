/** Canvas helpers shared by the browser image engine. All designs are W x H on a white background. */
export const W = 512
export const H = 768

export function canvas(w = W, h = H): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => reject(new Error('Could not read the image'))
    img.src = url
  })
}

/** Fit any image into a W x H white canvas (centred, aspect preserved). */
export function normalize(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const c = canvas()
  const g = ctx2d(c)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  const s = Math.min(W / img.width, H / img.height)
  const w = img.width * s
  const h = img.height * s
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  return c
}

/** Downscale so the longest side is <= max (keeps aspect). */
export function shrink(src: HTMLCanvasElement | HTMLImageElement, max: number): HTMLCanvasElement {
  const s = Math.min(1, max / Math.max(src.width, src.height))
  const c = canvas(Math.round(src.width * s), Math.round(src.height * s))
  const g = ctx2d(c)
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export function toBlob(c: HTMLCanvasElement, type: 'image/webp' | 'image/png' = 'image/webp', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, quality),
  )
}

/** Base64 (no data: prefix) PNG, as Workers AI expects for image_b64. */
export async function toPngBase64(c: HTMLCanvasElement): Promise<string> {
  const bytes = new Uint8Array(await (await toBlob(c, 'image/png')).arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function clone(c: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(c.width, c.height)
  ctx2d(out).drawImage(c, 0, 0)
  return out
}

/** Small deterministic PRNG (mulberry32) and string hash, so the same seed/prompt always draws the same thing. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}
