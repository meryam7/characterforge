/** Small Web Crypto helpers: random tokens, hashing, AES-GCM for secrets at rest. */
const enc = new TextEncoder()

export const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const fromB64 = (s: string) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))

export async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Keyed hash for logs (IP addresses, emails) so events can be correlated without storing personal data. */
export async function pseudonym(value: string, salt: string): Promise<string> {
  return (await sha256(`${salt}:${value.toLowerCase()}`)).slice(0, 24)
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function aesKey(secretB64: string): Promise<CryptoKey> {
  const raw = fromB64(secretB64)
  if (raw.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (base64)')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** AES-256-GCM. Output: v1.<iv>.<ciphertext> (base64url). */
export async function encryptSecret(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(plain)))
  return `v1.${b64url(iv)}.${b64url(ct)}`
}

export async function decryptSecret(box: string, keyB64: string): Promise<string> {
  const [v, iv, ct] = box.split('.')
  if (v !== 'v1' || !iv || !ct) throw new Error('Bad secret format')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await aesKey(keyB64), fromB64(ct))
  return new TextDecoder().decode(pt)
}
