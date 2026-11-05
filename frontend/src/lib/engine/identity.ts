/** Identity vector = 64-bin colour histogram of the character (light background ignored), L2-normalised.
 * Consistency score = cosine similarity with the character's stored vector (the % badge). */
import { ctx2d, shrink } from './image'

export function embed(src: HTMLCanvasElement): number[] {
  const small = shrink(src, 192)
  const { data } = ctx2d(small).getImageData(0, 0, small.width, small.height)
  const hist = new Array(64).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    if (r >= 235 && g >= 235 && b >= 235) continue // background
    hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++
  }
  const norm = Math.hypot(...hist) || 1
  return hist.map((v) => v / norm)
}

export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? Math.round((dot / Math.sqrt(na * nb)) * 1000) / 1000 : 0
}
