/** High-level studio operations: Workers AI first, procedural preview art as fallback.
 * The server only stores results; all pixel work happens here in the browser. */
import { api, ApiError } from '../api'
import type { Character, Design } from '../types'
import { embed, similarity } from './identity'
import { canvas, ctx2d, H, loadImage, normalize, shrink, toBlob, toPngBase64, W } from './image'
import { mockCharacter, mockInpaint } from './mock'
import { composite, dilate, maskPngBytes } from './select'

export type Rendered = { canvas: HTMLCanvasElement; source: 'ai' | 'mock'; notice: string | null; remaining: number | null }

const isFallback = (e: unknown) => e instanceof ApiError && e.data.fallback === true

/** The picture that defines who the character is: the uploaded reference, else the first design. */
export async function anchorFor(character: Character, designs: Design[]): Promise<HTMLCanvasElement | null> {
  const url = character.reference_url ?? designs[0]?.image_url
  return url ? normalize(await loadImage(url)) : null
}

export async function renderDesign(
  character: Character, prompt: string, anchor: HTMLCanvasElement | null, useAi: boolean,
): Promise<Rendered> {
  if (useAi) {
    try {
      const res = await api.aiGenerate(character.id, prompt, anchor ? await toPngBase64(anchor) : null)
      return { canvas: normalize(await loadImage(res.blob)), source: 'ai', notice: null, remaining: res.remaining }
    } catch (e) {
      if (!isFallback(e)) throw e
      return { canvas: mockCharacter(prompt, character.seed), source: 'mock', notice: (e as Error).message, remaining: null }
    }
  }
  return { canvas: mockCharacter(prompt, character.seed), source: 'mock', notice: null, remaining: null }
}

export async function renderEdit(
  design: Design, base: HTMLCanvasElement, mask: Uint8Array, prompt: string, useAi: boolean,
): Promise<Rendered> {
  const grown = dilate(mask, base.width, base.height, 4)
  if (useAi) {
    try {
      const res = await api.aiInpaint(design.id, prompt, await toPngBase64(base), await maskPngBytes(grown, base.width, base.height))
      const edited = await loadImage(res.blob)
      return { canvas: composite(base, edited, grown), source: 'ai', notice: null, remaining: res.remaining }
    } catch (e) {
      if (!isFallback(e)) throw e
      return { canvas: mockInpaint(base, mask, prompt), source: 'mock', notice: (e as Error).message, remaining: null }
    }
  }
  return { canvas: mockInpaint(base, mask, prompt), source: 'mock', notice: null, remaining: null }
}

function thumbnail(src: HTMLCanvasElement): HTMLCanvasElement {
  const t = canvas(160, 240)
  const g = ctx2d(t)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 160, 240)
  const small = shrink(src, 240)
  g.drawImage(small, (160 - small.width) / 2, (240 - small.height) / 2)
  return t
}

export async function saveDesign(
  character: Character,
  r: Rendered,
  opts: { kind: 'generate' | 'edit'; prompt: string; parentId?: number },
): Promise<Design> {
  const vector = embed(r.canvas)
  const form = new FormData()
  form.append('image', await toBlob(r.canvas, 'image/webp', 0.92), 'design.webp')
  form.append('thumb', await toBlob(thumbnail(r.canvas), 'image/webp', 0.8), 'thumb.webp')
  form.append('kind', opts.kind)
  form.append('source', r.source)
  form.append('prompt', opts.prompt)
  if (opts.parentId) form.append('parent_id', String(opts.parentId))
  form.append('consistency', String(character.embedding ? similarity(character.embedding, vector) : 1))
  form.append('embedding', JSON.stringify(vector))
  return api.uploadDesign(character.id, form)
}

export async function saveReference(character: Character, file: File): Promise<Character> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Image too large (max 20 MB)')
  const img = shrink(await loadImage(file), 768)
  const form = new FormData()
  form.append('image', await toBlob(img, 'image/webp', 0.9), 'reference.webp')
  form.append('thumb', await toBlob(thumbnail(img), 'image/webp', 0.8), 'thumb.webp')
  form.append('embedding', JSON.stringify(embed(normalize(img))))
  return api.uploadReference(character.id, form)
}

export { H, W }
