/** Workers AI calls. Models and params were verified against the account's catalogue (2026-11-05):
 * - text-to-image: dreamshaper-8-lcm (SD 1.5 fine-tune, ~5 s, PNG)
 * - inpainting:    runwayml SD 1.5 inpainting (beta, free). Also used with a full-white mask as "img2img"
 *   for identity lock, because img2img via dreamshaper returns a black image on Workers AI.
 * Output conventions match the browser engine (frontend/src/lib/engine): 512x768, plain light background. */
import type { Env } from './env'

export const W = 512
export const H = 768
export const T2I_MODEL = '@cf/lykon/dreamshaper-8-lcm'
export const INPAINT_MODEL = '@cf/runwayml/stable-diffusion-v1-5-inpainting'
export const LOCK_STRENGTH = 0.7 // how far a locked variation may drift from the anchor image

// Do NOT add "nsfw" here: on Workers AI it makes the inpainting model return an all-black image.
export const NEGATIVE =
  'blurry, low quality, deformed, extra limbs, bad anatomy, text, watermark, cropped, multiple characters, busy background, scenery'

// Keys must match STYLES in frontend/src/lib/types.ts
export const STYLES: Record<string, string> = {
  anime: 'anime style, clean lineart, vibrant colors, cel shading',
  'pixel art': 'pixel art, 16-bit game sprite, limited palette, crisp pixels',
  'comic book': 'comic book style, bold ink outlines, halftone shading',
  painterly: 'digital painting, painterly brush strokes, rich colors, concept art',
  chibi: 'chibi proportions, cute, big head, kawaii, clean lineart',
  'realistic concept art': 'realistic character concept art, highly detailed, studio lighting',
}

export function buildPrompt(description: string, style: string, extra = ''): string {
  return [
    description.trim(),
    extra.trim(),
    STYLES[style] ?? style,
    'full body character design, single character, centered, plain white background',
  ]
    .filter(Boolean)
    .join(', ')
}

/** Full-white PNG mask (512x768) built once per isolate: lets the inpainting model act as img2img. */
let fullMask: number[] | null = null
async function whiteMask(): Promise<number[]> {
  if (fullMask) return fullMask
  // Minimal valid PNG: 8-bit greyscale, every pixel 255, deflate-stored rows.
  const raw = new Uint8Array((W + 1) * H)
  for (let y = 0; y < H; y++) raw.fill(255, y * (W + 1) + 1, (y + 1) * (W + 1))
  const deflated = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
  fullMask = Array.from(png(W, H, deflated))
  return fullMask
}

function png(w: number, h: number, idat: Uint8Array): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Uint8Array) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w)
  dv.setUint32(4, h)
  ihdr.set([8, 0, 0, 0, 0], 8) // 8-bit, greyscale
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

type AiOut = ReadableStream | Uint8Array | ArrayBuffer | { image?: string }

/** env.AI.run must be called as a method (it uses `this`); the cast avoids the per-model typings. */
const runner = (env: Env) => (model: string, input: Record<string, unknown>) =>
  (env.AI as unknown as { run(m: string, i: Record<string, unknown>): Promise<AiOut> }).run(model, input)

/** Buffers the PNG and rejects blank output: the safety filter returns an all-black ~1 KB PNG instead of an error. */
async function toResponse(out: AiOut): Promise<Uint8Array> {
  let bytes: Uint8Array
  if (out instanceof ReadableStream) bytes = new Uint8Array(await new Response(out).arrayBuffer())
  else if (out instanceof Uint8Array) bytes = out
  else if (out instanceof ArrayBuffer) bytes = new Uint8Array(out)
  else if (out && typeof out === 'object' && typeof out.image === 'string') bytes = Uint8Array.from(atob(out.image), (c) => c.charCodeAt(0))
  else throw new Error('Unexpected AI output')
  if (bytes.byteLength < 8000) throw new Error(`Blank AI image (${bytes.byteLength} bytes)`)
  return bytes
}

/** The models' safety filter sometimes returns a black image for harmless prompts (about 1 in 3 seeds in testing).
 * Retry with the next seeds before giving up; the character seed stays the starting point, so results stay stable. */
async function withRetries(seed: number, attempt: (seed: number) => Promise<AiOut>): Promise<Uint8Array> {
  let last: unknown
  for (let i = 0; i < 3; i++) {
    try {
      return await toResponse(await attempt((seed + i) % 2147483647))
    } catch (err) {
      last = err
    }
  }
  throw last
}

export async function generate(env: Env, prompt: string, seed: number, anchorB64: string | null) {
  const run = runner(env)
  const mask = anchorB64 ? await whiteMask() : null
  return withRetries(seed, (s) =>
    anchorB64
      ? run(INPAINT_MODEL, {
          prompt, negative_prompt: NEGATIVE, image_b64: anchorB64, mask, strength: LOCK_STRENGTH, width: W, height: H, seed: s,
        })
      : run(T2I_MODEL, { prompt, negative_prompt: NEGATIVE, width: W, height: H, seed: s }),
  )
}

export async function inpaint(env: Env, prompt: string, seed: number, imageB64: string, mask: number[]) {
  const run = runner(env)
  return withRetries(seed, (s) =>
    run(INPAINT_MODEL, { prompt, negative_prompt: NEGATIVE, image_b64: imageB64, mask, strength: 1, width: W, height: H, seed: s }),
  )
}
