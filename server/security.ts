/** Password hashing (PBKDF2-SHA256 via Web Crypto) and login tokens (HS256 JWT). */
import { sign, verify } from 'hono/jwt'

const ITERATIONS = 100_000 // Workers' Web Crypto maximum for PBKDF2
const enc = new TextEncoder()

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iter, salt, hash] = stored.split('$')
  if (algo !== 'pbkdf2' || !iter || !salt || !hash) return false
  const got = await derive(password, unb64(salt), Number(iter))
  const want = unb64(hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}

const TOKEN_DAYS = 30

export async function createToken(userId: number, secret: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  return sign({ sub: String(userId), iat, exp: iat + TOKEN_DAYS * 86400 }, secret, 'HS256')
}

export async function readToken(token: string, secret: string): Promise<number | null> {
  try {
    const payload = await verify(token, secret, 'HS256')
    const id = Number(payload.sub)
    return Number.isSafeInteger(id) ? id : null
  } catch {
    return null
  }
}
