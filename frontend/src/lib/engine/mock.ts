/** Procedural "preview art", used when Workers AI is off, busy or over its daily limit, and as the builder's live
 * preview. Builder traits (lib/traits.ts) drive colours, body, hair and features; anything not chosen comes from the
 * character SEED (identity); the arm pose comes from the PROMPT. */
import { hasTrait, traitHex, type Traits } from '../traits'
import { canvas, ctx2d, H, hash, rng, W } from './image'

type RGB = [number, number, number]
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`
const hexRgb = (hex?: string): RGB | null =>
  hex ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] : null
const shade = (c: RGB, d: number): RGB => c.map((v) => Math.max(0, Math.min(255, v + d))) as RGB

const BUILD: Record<string, [number, number]> = { // [shoulders, hips] width factors
  slim: [0.85, 0.85], slender: [0.88, 0.86], average: [1, 1], athletic: [1.08, 0.98], muscular: [1.2, 1.05],
  curvy: [0.98, 1.18], stocky: [1.15, 1.12], plus: [1.28, 1.3], lanky: [0.8, 0.8],
  petite: [0.82, 0.84], toned: [1.04, 0.98], hourglass: [1.02, 1.2], pear: [0.9, 1.24], vshape: [1.25, 0.9],
  rectangle: [1, 0.97], chubby: [1.16, 1.2], heavyset: [1.3, 1.25], bodybuilder: [1.38, 1.08], willowy: [0.8, 0.84],
  gaunt: [0.78, 0.76], round: [1.22, 1.32],
}
const SHOULDERS: Record<string, number> = { narrow: 0.9, sloped: 0.94, broad: 1.12, verybroad: 1.24 }
const FACE_W: Record<string, number> = { round: 78, babyface: 80, soft: 76, long: 64, rectangle: 66, gaunt: 62, chiseled: 70, triangle: 74 }
const HEIGHT: Record<string, number> = { tiny: 0.8, short: 0.9, average: 1, tall: 1.04, towering: 1.08 }
const HAIR_DROP: Record<string, number> = { bald: 0, buzz: 0, short: 60, chin: 100, shoulder: 150, long: 270, verylong: 380 }
const ROBES = ['gown', 'mage', 'wizard', 'priest', 'kimono']
const BEAST = ['catfolk', 'foxfolk', 'wolffolk']

export function mockCharacter(prompt: string, seed: number, traits?: Traits | null): HTMLCanvasElement {
  const rand = rng(seed)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const col = (lo = 40, hi = 215): RGB => [int(lo, hi), int(lo, hi), int(lo, hi)]
  const skins: RGB[] = [[255, 224, 196], [241, 194, 153], [198, 134, 96], [141, 85, 54]]
  // seeded defaults are drawn in a fixed order, so a character keeps its look when a trait is added
  const seeded = { skin: skins[int(0, 3)], hair: col(), outfit: col(), pants: col(), shoes: col(30, 120) }
  const has = (id: string, v: string) => hasTrait(traits, id, v)
  const pickT = (id: string) => (typeof traits?.[id] === 'string' ? (traits[id] as string) : '')
  const skin = hexRgb(traitHex(traits, 'skin')) ?? seeded.skin
  const hair = hexRgb(traitHex(traits, 'hairColor')) ?? seeded.hair
  const outfit = hexRgb(traitHex(traits, 'mainColor')) ?? seeded.outfit
  const pants = hexRgb(traitHex(traits, 'accentColor')) ?? seeded.pants
  const shoes: RGB = has('footwear', 'barefoot') ? skin : has('footwear', 'greaves') ? [150, 155, 165] : seeded.shoes
  const eye = hexRgb(traitHex(traits, 'eyeColor')) ?? ([30, 20, 60] as RGB)
  const [bw, hw] = BUILD[pickT('build')] ?? [1, 1]
  const sw = bw * (SHOULDERS[pickT('shoulders')] ?? 1)
  const height = (HEIGHT[pickT('height')] ?? 1) * (has('age', 'child') ? 0.8 : 1)
  const drop = HAIR_DROP[pickT('hairLength')] ?? 60
  const species = pickT('species')
  const arm = (hash(prompt) % 70) - 35

  const c = canvas()
  const g = ctx2d(c)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  const cx = W / 2
  g.save()
  g.translate(cx, 715) // scale the figure around the feet
  g.scale(height, height)
  g.translate(-cx, -715)
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
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  const poly = (pts: [number, number][], fill: RGB) => {
    g.fillStyle = css(fill)
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.closePath()
    g.fill()
  }
  const S = 98 * sw // half shoulder width
  const Hp = 72 * hw // half hip width

  // behind the body: wings, cape, tail, long hair
  if (has('features', 'wings') || species === 'angel' || species === 'fairy') {
    const wing: RGB = species === 'demon' ? [70, 40, 70] : [225, 228, 240]
    ellipse(cx - S - 120, 230, cx - 20, 470, wing)
    ellipse(cx + 20, 230, cx + S + 120, 470, wing)
  }
  if (has('accessories', 'cape')) poly([[cx - S, 300], [cx + S, 300], [cx + S + 40, 650], [cx - S - 40, 650]], shade(pants, -30))
  if (has('features', 'tail') || [...BEAST, 'dragonkin', 'demon'].includes(species)) {
    line(cx + Hp - 10, 500, cx + Hp + 90, 560, 22, species === 'dragonkin' ? shade(skin, -40) : hair)
  }
  if (drop > 60 && !has('hairLength', 'bald') && !has('hairStyle', 'bun') && !has('hairStyle', 'ponytail')) {
    rect(cx - 92, 160, cx + 92, 175 + drop, 40, shade(hair, -18))
  }

  // body
  rect(cx - Hp, 490, cx - 10, 690, 22, pants)
  rect(cx + 10, 490, cx + Hp, 690, 22, pants)
  rect(cx - Hp - 14, 670, cx - 6, 715, 18, shoes)
  rect(cx + 6, 670, cx + Hp + 14, 715, 18, shoes)
  const armW = 38 * Math.max(sw, 0.9)
  line(cx - S + 6, 320, cx - S - 52, 450 + arm, armW, skin)
  line(cx + S - 6, 320, cx + S + 52, 450 - arm, armW, skin)
  const handL: [number, number] = [cx - S - 52, 455 + arm]
  const handR: [number, number] = [cx + S + 52, 455 - arm]
  const hand: RGB = has('accessories', 'gloves') ? shade(pants, -40) : skin
  ellipse(handL[0] - 25, handL[1] - 25, handL[0] + 25, handL[1] + 25, hand)
  ellipse(handR[0] - 25, handR[1] - 25, handR[0] + 25, handR[1] + 25, hand)
  rect(cx - S, 290, cx + S, 510, 44, outfit)
  if (ROBES.includes(pickT('outfit'))) poly([[cx - S + 10, 440], [cx + S - 10, 440], [cx + S + 30, 680], [cx - S - 30, 680]], outfit)
  if (has('outfit', 'knight') || has('outfit', 'samurai')) rect(cx - S + 20, 310, cx + S - 20, 420, 30, [170, 176, 188])
  g.fillStyle = css(has('accessories', 'belt') ? [90, 60, 35] : shade(outfit, -40))
  g.fillRect(cx - S, 440, 2 * S, 20)

  // held item
  const held = pickT('held')
  if (['sword', 'greatsword', 'dagger', 'spear'].includes(held)) {
    const len = held === 'greatsword' ? 260 : held === 'spear' ? 330 : held === 'dagger' ? 70 : 190
    line(handR[0], handR[1], handR[0] + 30, handR[1] - len, held === 'greatsword' ? 18 : 10, [200, 205, 215])
  } else if (held === 'staff' || held === 'wand') {
    const top = held === 'staff' ? 280 : 90
    line(handR[0], handR[1] + 60, handR[0] + 10, handR[1] - top, held === 'staff' ? 12 : 6, [110, 75, 40])
    ellipse(handR[0] - 8, handR[1] - top - 25, handR[0] + 28, handR[1] - top + 10, [120, 200, 255])
  } else if (held === 'shield') {
    ellipse(handL[0] - 55, handL[1] - 70, handL[0] + 45, handL[1] + 40, [150, 110, 60])
  } else if (held === 'bow') {
    g.strokeStyle = css([120, 80, 40])
    g.lineWidth = 8
    g.beginPath()
    g.arc(handR[0] - 10, handR[1], 110, -1.2, 1.2)
    g.stroke()
  } else if (held === 'book') {
    rect(handR[0] - 30, handR[1] - 40, handR[0] + 30, handR[1] + 30, 6, [100, 40, 50])
  } else if (held === 'lantern') {
    ellipse(handR[0] - 20, handR[1] + 10, handR[0] + 20, handR[1] + 60, [255, 210, 90])
  }

  // head
  g.fillStyle = css(skin)
  g.fillRect(cx - 20, 255, 40, 45)
  const faceW = FACE_W[pickT('faceShape')] ?? 72
  const ears = pickT('ears')
  if (ears && ears !== 'pointed' && ears !== 'longelf') {
    const ew = ears === 'small' ? 10 : ears === 'protruding' ? 24 : ears === 'large' ? 20 : 14
    ellipse(cx - faceW - ew, 180, cx - faceW + 10, 230, shade(skin, -12))
    ellipse(cx + faceW - 10, 180, cx + faceW + ew, 230, shade(skin, -12))
  }
  ellipse(cx - faceW, 120, cx + faceW, 280, skin)
  const jaw = pickT('jaw')
  if (['strong', 'wide'].includes(jaw) || ['square', 'rectangle', 'triangle'].includes(pickT('faceShape'))) {
    rect(cx - faceW + 6, 205, cx + faceW - 6, 278, 26, skin) // squarer jaw
  } else if (jaw === 'pointed' || pickT('faceShape') === 'heart') {
    poly([[cx - faceW + 14, 240], [cx + faceW - 14, 240], [cx, 296]], skin)
  } else if (jaw === 'prominent') ellipse(cx - 26, 262, cx + 26, 290, skin)
  if (jaw === 'cleft') line(cx, 270, cx, 280, 2, shade(skin, -45))
  if (pickT('cheeks') === 'rosy' || has('makeup', 'blush')) {
    for (const ex of [-44, 44]) ellipse(cx + ex - 14, 224, cx + ex + 14, 240, [240, 140, 150])
  }
  if (pickT('cheeks') === 'hollow' || pickT('faceShape') === 'gaunt') {
    for (const ex of [-46, 46]) line(cx + ex, 222, cx + ex * 0.85, 250, 3, shade(skin, -30))
  }
  if (has('ears', 'longelf') || has('ears', 'pointed')) {
    const tip = has('ears', 'longelf') ? 70 : 24
    poly([[cx - faceW + 4, 190], [cx - faceW - tip, 160], [cx - faceW + 2, 222]], skin)
    poly([[cx + faceW - 4, 190], [cx + faceW + tip, 160], [cx + faceW - 2, 222]], skin)
  }
  if (has('features', 'pointed-ears') || species === 'elf') {
    poly([[cx - faceW + 4, 190], [cx - faceW - 38, 160], [cx - faceW + 2, 222]], skin)
    poly([[cx + faceW - 4, 190], [cx + faceW + 38, 160], [cx + faceW - 2, 222]], skin)
  }
  if (!has('hairLength', 'bald')) {
    g.fillStyle = css(hair)
    g.beginPath()
    g.ellipse(cx, 175, 88, has('hairLength', 'buzz') ? 62 : 75, 0, Math.PI, Math.PI * 2)
    g.closePath()
    g.fill()
    if (drop >= 60) {
      const side = Math.min(85 + drop / 3, 140)
      g.fillRect(cx - 88, 175, 22, side)
      g.fillRect(cx + 66, 175, 22, side)
    }
    if (has('hairStyle', 'bangs') || has('hairStyle', 'hime')) g.fillRect(cx - 70, 130, 140, 42)
    if (has('hairStyle', 'mohawk')) rect(cx - 16, 60, cx + 16, 140, 14, hair)
    if (has('hairStyle', 'bun')) ellipse(cx - 34, 70, cx + 34, 130, hair)
    if (has('hairStyle', 'ponytail')) line(cx + 70, 140, cx + 120, 330, 34, hair)
    if (has('hairStyle', 'twintails')) {
      line(cx - 90, 160, cx - 140, 380, 30, hair)
      line(cx + 90, 160, cx + 140, 380, 30, hair)
    }
    if (has('hairStyle', 'curly') || has('hairStyle', 'coily')) {
      for (let i = 0; i < 9; i++) ellipse(cx - 100 + i * 22, 92 + (i % 2) * 14, cx - 64 + i * 22, 132 + (i % 2) * 14, hair)
    }
  }
  if (has('features', 'animal-ears') || BEAST.includes(species)) {
    poly([[cx - 80, 130], [cx - 60, 50], [cx - 30, 110]], hair)
    poly([[cx + 80, 130], [cx + 60, 50], [cx + 30, 110]], hair)
  }
  if (has('features', 'horns') || species === 'demon' || species === 'dragonkin') {
    poly([[cx - 50, 115], [cx - 78, 40], [cx - 30, 108]], [60, 45, 50])
    poly([[cx + 50, 115], [cx + 78, 40], [cx + 30, 108]], [60, 45, 50])
  }
  if (has('features', 'halo') || species === 'angel') {
    g.strokeStyle = 'rgb(250,210,80)'
    g.lineWidth = 8
    g.beginPath()
    g.ellipse(cx, 70, 60, 16, 0, 0, Math.PI * 2)
    g.stroke()
  }
  if (has('accessories', 'crown')) {
    poly([[cx - 50, 115], [cx - 50, 80], [cx - 25, 100], [cx, 70], [cx + 25, 100], [cx + 50, 80], [cx + 50, 115]], [230, 190, 60])
  }
  if (has('outfit', 'wizard')) poly([[cx - 100, 125], [cx + 100, 125], [cx + 10, 10]], shade(outfit, -20))
  else if (has('accessories', 'hat')) {
    rect(cx - 110, 112, cx + 110, 128, 8, shade(pants, -20))
    rect(cx - 66, 60, cx + 66, 120, 14, shade(pants, -20))
  }

  // face
  const hetero = has('eyeColor', 'hetero')
  for (const ex of [-28, 28]) {
    ellipse(cx + ex - 11, 190, cx + ex + 11, 218, [255, 255, 255])
    const iris: RGB = hetero && ex > 0 ? [224, 178, 58] : has('features', 'glow-eyes') ? [120, 255, 240] : eye
    ellipse(cx + ex - 6, 196, cx + ex + 6, 214, iris)
    const lashes = pickT('eyelashes')
    if (lashes === 'long' || lashes === 'dramatic' || has('makeup', 'eyeliner')) {
      const w = lashes === 'dramatic' || has('makeup', 'eyeliner') ? 4 : 2
      line(cx + ex - 13, 192, cx + ex + 13, 190, w, [25, 20, 30])
      line(cx + ex + (ex > 0 ? 11 : -11), 191, cx + ex + (ex > 0 ? 18 : -18), 184, w, [25, 20, 30])
    }
    if (has('eyeShape', 'sleepy')) rect(cx + ex - 12, 188, cx + ex + 12, 201, 4, skin) // half-closed lid
  }
  if (has('faceDetails', 'scareye')) line(cx + 22, 176, cx + 40, 228, 3, [170, 70, 70])
  if (has('faceDetails', 'scarcheek')) line(cx - 58, 226, cx - 30, 238, 3, [170, 70, 70])
  if (has('faceDetails', 'mole')) ellipse(cx + 34, 224, cx + 39, 229, shade(skin, -90))
  if (has('faceDetails', 'nosering')) {
    g.strokeStyle = 'rgb(210,180,80)'
    g.lineWidth = 2
    g.beginPath()
    g.arc(cx + 9, 228, 5, 0, Math.PI * 2)
    g.stroke()
  }
  if (has('faceDetails', 'bindi')) ellipse(cx - 4, 172, cx + 4, 180, [200, 30, 50])
  if (has('faceDetails', 'wrinkles')) {
    for (const ex of [-46, 46]) line(cx + ex, 200, cx + ex + (ex > 0 ? 8 : -8), 206, 2, shade(skin, -40))
  }
  const brows = pickT('eyebrows')
  if (brows === 'thick' || brows === 'bushy' || brows === 'unibrow' || brows === 'furrowed') {
    const w = brows === 'bushy' ? 8 : 6
    const tilt = brows === 'furrowed' ? 6 : 0
    line(cx - 42, 180, cx - 14, 180 + tilt, w, shade(hair, -20))
    line(cx + 42, 180, cx + 14, 180 + tilt, w, shade(hair, -20))
    if (brows === 'unibrow') line(cx - 14, 180, cx + 14, 180, w, shade(hair, -20))
  }
  if (has('accessories', 'glasses')) {
    g.strokeStyle = 'rgb(40,40,50)'
    g.lineWidth = 4
    for (const ex of [-28, 28]) {
      g.beginPath()
      g.arc(cx + ex, 204, 20, 0, Math.PI * 2)
      g.stroke()
    }
    line(cx - 8, 204, cx + 8, 204, 4, [40, 40, 50])
  }
  if (has('accessories', 'eyepatch')) ellipse(cx + 12, 188, cx + 44, 220, [25, 25, 30])
  if (has('skinDetails', 'freckles')) {
    for (const [fx, fy] of [[-40, 228], [-30, 234], [-46, 238], [40, 228], [30, 234], [46, 238]]) {
      ellipse(cx + fx - 2, fy - 2, cx + fx + 2, fy + 2, shade(skin, -60))
    }
  }
  const beard = pickT('facialHair')
  if (beard && beard !== 'none') {
    const depth = beard === 'long' ? 90 : beard === 'full' ? 45 : beard === 'short' ? 25 : 10
    if (beard === 'mustache') rect(cx - 26, 226, cx + 26, 236, 5, hair)
    else if (beard === 'goatee') rect(cx - 14, 252, cx + 14, 262 + depth, 8, hair)
    else if (beard === 'stubble') ellipse(cx - 56, 222, cx + 56, 286, shade(skin, -35))
    else poly([[cx - 66, 215], [cx + 66, 215], [cx + 40, 270 + depth], [cx, 285 + depth], [cx - 40, 270 + depth]], hair)
  }
  const expr = pickT('expression')
  g.strokeStyle = has('makeup', 'lipstick') ? 'rgb(200,20,40)' : has('makeup', 'dark') ? 'rgb(60,20,40)' : 'rgb(120,40,60)'
  g.lineWidth = 4
  g.beginPath()
  if (expr === 'surprised') {
    g.ellipse(cx, 244, 9, 12, 0, 0, Math.PI * 2)
  } else if (expr === 'laughing' || expr === 'crazed') {
    g.ellipse(cx, 236, expr === 'crazed' ? 28 : 22, 20, 0, 0, Math.PI)
    g.closePath()
  } else if (expr === 'serious' || expr === 'angry' || expr === 'determined' || expr === 'sleepy' || expr === 'calm') {
    g.moveTo(cx - 16, 246)
    g.lineTo(cx + 16, 246)
  } else if (expr === 'sad' || expr === 'worried') {
    g.moveTo(cx - 16, 248)
    g.quadraticCurveTo(cx, 236, cx + 16, 248)
  } else if (expr === 'smirk' || expr === 'smug') {
    g.moveTo(cx - 16, 246)
    g.quadraticCurveTo(cx + 6, 250, cx + 20, 238)
  } else {
    g.ellipse(cx, 238, 22, 18, 0, (20 * Math.PI) / 180, (160 * Math.PI) / 180)
  }
  g.stroke()
  if (expr === 'angry') {
    line(cx - 42, 182, cx - 16, 190, 5, shade(hair, -20))
    line(cx + 42, 182, cx + 16, 190, 5, shade(hair, -20))
  }
  g.restore()

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
