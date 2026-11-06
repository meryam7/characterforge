/** Password hashing: PBKDF2-SHA256 via Web Crypto (100k iterations = Workers' maximum). */
const ITERATIONS = 100_000
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

/** Used when the email doesn't exist, so response time doesn't reveal which accounts exist. */
export const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

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

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123',
  'iloveyou', 'abcdefgh', 'abc12345', '11111111', '00000000', 'azertyuiop', 'motdepasse', 'letmein123', 'welcome1',
])

/** Returns an error message, or null if the password is acceptable. */
export function passwordProblem(password: unknown, email: string): string | null {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return 'password: 10 to 128 characters'
  if (COMMON.has(password.toLowerCase())) return 'password: too common, choose another one'
  if (password.toLowerCase() === email.toLowerCase()) return 'password: must not be your email'
  return null
}
