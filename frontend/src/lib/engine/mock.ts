/** Procedural "preview art", used when Workers AI is off, busy or over its daily limit.
 * Colours come from the character SEED (identity), the pose from the PROMPT. */
import { canvas, ctx2d, H, hash, rng, W } from './image'

type RGB = [number, number, number]
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`

export function mockCharacter(prompt: string, seed: number): HTMLCanvasElement {
  const rand = rng(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const col = (lo = 40, hi = 215): RGB => [int(lo, hi), int(lo, hi), int(lo, hi)]
  const skins: RGB[] = [[255, 224, 196], [241, 194, 153], [198, 134, 96], [141, 85, 54]]
  const skin = skins[int(0, 3)]
  const hair = col()
  const outfit = col()
  const pants = col()
  const shoes = col(30, 120)
  const arm = (hash(prompt) % 70) - 35

  const c = canvas()
  const g = ctx2d(c)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  const cx = W / 2
  const rect = (x0: number, y0: number, x1: number, y1: number, r: number, fill: RGB) => {
    g.fillStyle = css(fill)
    g.beginPath()
    g.roundRect(x0, y0, x1 - x0, y1 - y0, r)
    g.fill()
  }
  const ellipse = (x0: number, y0: number, x1: number, y1: number, fill: RGB) => {
    g.fillStyle = css(fill)
    g.beginPath()
    g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2)
    g.fill()
  }
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, stroke: RGB) => {
    g.strokeStyle = css(stroke)
    g.lineWidth = width
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }

  rect(cx - 72, 490, cx - 10, 690, 22, pants)
  rect(cx + 10, 490, cx + 72, 690, 22, pants)
  rect(cx - 86, 670, cx - 6, 715, 18, shoes)
  rect(cx + 6, 670, cx + 86, 715, 18, shoes)
  line(cx - 92, 320, cx - 150, 450 + arm, 38, skin)
  line(cx + 92, 320, cx + 150, 450 - arm, 38, skin)
  ellipse(cx - 175, 430 + arm, cx - 125, 480 + arm, skin)
  ellipse(cx + 125, 430 - arm, cx + 175, 480 - arm, skin)
  rect(cx - 98, 290, cx + 98, 510, 44, outfit)
  g.fillStyle = css(outfit.map((v) => Math.max(v - 40, 0)) as RGB)
  g.fillRect(cx - 98, 440, 196, 20)
  g.fillStyle = css(skin)
  g.fillRect(cx - 20, 255, 40, 45)
  ellipse(cx - 72, 120, cx + 72, 280, skin)
  // hair: top half of an ellipse plus side locks
  g.fillStyle = css(hair)
  g.beginPath()
  g.ellipse(cx, 175, 88, 75, 0, Math.PI, Math.PI * 2)
  g.closePath()
  g.fill()
  g.fillRect(cx - 88, 175, 22, 85)
  g.fillRect(cx + 66, 175, 22, 85)
  for (const ex of [-28, 28]) {
    ellipse(cx + ex - 11, 190, cx + ex + 11, 218, [255, 255, 255])
    ellipse(cx + ex - 6, 196, cx + ex + 6, 214, [30, 20, 60])
  }
  g.strokeStyle = 'rgb(120,40,60)'
  g.lineWidth = 4
  g.beginPath()
  g.ellipse(cx, 238, 22, 18, 0, (20 * Math.PI) / 180, (160 * Math.PI) / 180)
  g.stroke()
  g.fillStyle = 'rgb(190,190,205)'
  g.font = '11px sans-serif'
  g.fillText('PREVIEW ART', 14, H - 12)
  return c
}

/** Tint the masked area with a colour derived from the prompt. */
export function mockInpaint(src: HTMLCanvasElement, mask: Uint8Array, prompt: string): HTMLCanvasElement {
  const h = hash(prompt)
  const tint = [60 + (h & 0xff) % 160, 60 + ((h >> 8) & 0xff) % 160, 60 + ((h >> 16) & 0xff) % 160]
  const out = canvas(src.width, src.height)
  const g = ctx2d(out)
  g.drawImage(src, 0, 0)
  const data = g.getImageData(0, 0, out.width, out.height)
  const px = data.data
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const o = i * 4
    for (let k = 0; k < 3; k++) px[o + k] = Math.round(px[o + k] * 0.22 + tint[k] * 0.78)
  }
  g.putImageData(data, 0, 0)
  return out
}
