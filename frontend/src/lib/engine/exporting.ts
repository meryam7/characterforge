/** Exports built in the browser: transparent PNG, sprite sheet + atlas, Godot 4 pack. */
import { strToU8, zipSync } from 'fflate'
import loaderScript from '../../assets/CharacterLoader.gd?raw'
import { slug } from '../format'
import type { Character, Design } from '../types'
import { canvas, ctx2d, loadImage, normalize, toBlob } from './image'
import { floodRegion } from './select'

/** Flood-fill the background from the 4 corners (designs are drawn on a plain background) and make it transparent. */
export function removeBackground(src: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = src
  const out = canvas(w, h)
  const g = ctx2d(out)
  g.drawImage(src, 0, 0)
  const img = g.getImageData(0, 0, w, h)
  const bg = new Uint8Array(w * h)
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    if (bg[y * w + x]) continue
    const r = floodRegion(img, x, y, 24, 90)
    for (let i = 0; i < bg.length; i++) bg[i] |= r[i]
  }
  for (let i = 0; i < bg.length; i++) if (bg[i]) img.data[i * 4 + 3] = 0
  g.putImageData(img, 0, 0)
  // soften the cut edge a little
  const soft = canvas(w, h)
  const sg = ctx2d(soft)
  sg.filter = 'blur(0.6px)'
  sg.drawImage(out, 0, 0)
  sg.filter = 'none'
  sg.globalCompositeOperation = 'source-atop'
  sg.drawImage(out, 0, 0)
  return soft
}

export async function designCanvas(design: Design): Promise<HTMLCanvasElement> {
  return normalize(await loadImage(design.image_url))
}

const pngBytes = async (c: HTMLCanvasElement) => new Uint8Array(await (await toBlob(c, 'image/png')).arrayBuffer())

export async function transparentPng(design: Design): Promise<Blob> {
  return toBlob(removeBackground(await designCanvas(design)), 'image/png')
}

export async function spriteSheetZip(character: Character, designs: Design[]): Promise<Blob> {
  const frames = await Promise.all(designs.map(async (d) => removeBackground(await designCanvas(d))))
  const fw = Math.max(...frames.map((f) => f.width))
  const fh = Math.max(...frames.map((f) => f.height))
  const sheet = canvas(fw * frames.length, fh)
  const g = ctx2d(sheet)
  frames.forEach((f, i) => g.drawImage(f, i * fw, 0))
  const atlas = {
    character: character.name,
    frame_width: fw,
    frame_height: fh,
    frames: designs.map((d, i) => ({ design_id: d.id, x: i * fw, y: 0, w: fw, h: fh })),
  }
  const zip = zipSync({ 'sheet.png': await pngBytes(sheet), 'atlas.json': strToU8(JSON.stringify(atlas, null, 2)) })
  return new Blob([zip], { type: 'application/zip' })
}

export async function godotZip(character: Character, designs: Design[]): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  const meta = {
    name: character.name,
    style: character.style,
    designs: [] as { id: number; file: string; prompt: string; kind: string; consistency: number | null }[],
  }
  for (const d of designs) {
    const file = `sprites/design_${d.id}.png`
    files[file] = await pngBytes(removeBackground(await designCanvas(d)))
    meta.designs.push({ id: d.id, file, prompt: d.prompt, kind: d.kind, consistency: d.consistency })
  }
  files['character.json'] = strToU8(JSON.stringify(meta, null, 2))
  files['CharacterLoader.gd'] = strToU8(loaderScript)
  files['README.txt'] = strToU8(
    `Copy this folder into your Godot 4 project (e.g. res://characters/${slug(character.name)}/).\n` +
      "Add a Node2D, attach CharacterLoader.gd, set 'character_json' to the character.json path.\n" +
      'Press the ui_accept key (Enter/Space) in-game to cycle through the designs.\n',
  )
  return new Blob([zipSync(files)], { type: 'application/zip' })
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
