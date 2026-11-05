/** Click-to-select regions (flood fill that follows colour edges) and mask utilities. Masks are
 * Uint8Array(width*height) with 1 = selected. */
import type { Point } from '../types'
import { canvas, ctx2d, toBlob } from './image'

/** Grow a region from (x, y) through pixels whose colour changes gradually.
 * stepTol: max colour jump between neighbours; seedTol: max distance from the clicked colour. */
export function floodRegion(img: ImageData, x: number, y: number, stepTol = 42, seedTol = 150): Uint8Array {
  const { width: w, height: h, data } = img
  const out = new Uint8Array(w * h)
  const sx = Math.min(Math.max(Math.round(x), 0), w - 1)
  const sy = Math.min(Math.max(Math.round(y), 0), h - 1)
  const s = (sy * w + sx) * 4
  const [sr, sg, sb] = [data[s], data[s + 1], data[s + 2]]
  const stack = [sy * w + sx]
  out[sy * w + sx] = 1
  while (stack.length) {
    const i = stack.pop()!
    const px = i % w
    const py = (i - px) / w
    const o = i * 4
    for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (out[j]) continue
      const p = j * 4
      const step = Math.abs(data[p] - data[o]) + Math.abs(data[p + 1] - data[o + 1]) + Math.abs(data[p + 2] - data[o + 2])
      const seed = Math.abs(data[p] - sr) + Math.abs(data[p + 1] - sg) + Math.abs(data[p + 2] - sb)
      if (step <= stepTol && seed <= seedTol) {
        out[j] = 1
        stack.push(j)
      }
    }
  }
  return out
}

/** Union of positive clicks minus negative clicks. */
export function regionMask(img: ImageData, points: Point[]): Uint8Array {
  const mask = new Uint8Array(img.width * img.height)
  for (const p of points.filter((q) => q.positive)) {
    const r = floodRegion(img, p.x, p.y)
    for (let i = 0; i < mask.length; i++) mask[i] |= r[i]
  }
  for (const p of points.filter((q) => !q.positive)) {
    const r = floodRegion(img, p.x, p.y)
    for (let i = 0; i < mask.length; i++) if (r[i]) mask[i] = 0
  }
  return mask
}

export const coverage = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0) / mask.length

/** Expand the mask by r pixels (square kernel, two separable passes). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length)
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let k = -r; k <= r && !on; k++) {
        const xx = x + k
        if (xx >= 0 && xx < w) on = mask[y * w + xx]
      }
      tmp[y * w + x] = on
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let k = -r; k <= r && !on; k++) {
        const yy = y + k
        if (yy >= 0 && yy < h) on = tmp[yy * w + x]
      }
      out[y * w + x] = on
    }
  return out
}

/** Mask as a canvas: `on` colour where selected, transparent elsewhere. */
export function maskCanvas(mask: Uint8Array, w: number, h: number, on: [number, number, number, number], off: [number, number, number, number] = [0, 0, 0, 0]) {
  const c = canvas(w, h)
  const g = ctx2d(c)
  const data = g.createImageData(w, h)
  for (let i = 0; i < mask.length; i++) data.data.set(mask[i] ? on : off, i * 4)
  g.putImageData(data, 0, 0)
  return c
}

export const overlayUrl = (mask: Uint8Array, w: number, h: number) => maskCanvas(mask, w, h, [168, 85, 247, 130]).toDataURL()

/** White-on-black PNG bytes, the format Workers AI inpainting expects for `mask`. */
export async function maskPngBytes(mask: Uint8Array, w: number, h: number): Promise<number[]> {
  const blob = await toBlob(maskCanvas(mask, w, h, [255, 255, 255, 255], [0, 0, 0, 255]), 'image/png')
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
}

/** Paste `edited` over `base` only where mask is set, so everything else stays pixel-identical. */
export function composite(base: HTMLCanvasElement, edited: CanvasImageSource, mask: Uint8Array): HTMLCanvasElement {
  const { width: w, height: h } = base
  const layer = canvas(w, h)
  const lg = ctx2d(layer)
  lg.drawImage(edited, 0, 0, w, h)
  lg.globalCompositeOperation = 'destination-in'
  lg.drawImage(maskCanvas(mask, w, h, [0, 0, 0, 255]), 0, 0)
  const out = canvas(w, h)
  const g = ctx2d(out)
  g.drawImage(base, 0, 0)
  g.drawImage(layer, 0, 0)
  return out
}
