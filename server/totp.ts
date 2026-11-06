/** RFC 6238 TOTP (30 s, 6 digits, HMAC-SHA1): compatible with Google Authenticator, Authy, 1Password, Microsoft Authenticator. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)))

export async function totpAt(secret: string, step: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8)
  new DataView(msg).setUint32(4, step) // high 32 bits stay 0 until year 6000+
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const o = h[h.length - 1] & 15
  const n = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000
  return n.toString().padStart(6, '0')
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / 30)

/** Returns the matching time step (±1 window for clock drift) if the code is valid and newer than lastStep (replay guard). */
export async function verifyTotp(secret: string, code: string, lastStep: number): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  const now = currentStep()
  for (const step of [now - 1, now, now + 1]) {
    if (step <= lastStep) continue
    if ((await totpAt(secret, step)) === code) return step
  }
  return null
}

export const otpauthUri = (secret: string, account: string, issuer = 'CharaForge') =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
