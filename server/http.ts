/** Errors, validation and response helpers. Error bodies are always {"detail": string}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(detail)
  }
}

export const fail = (status: number, detail: string, extra?: Record<string, unknown>): never => {
  throw new ApiError(status, detail, extra)
}

type Rule = { min?: number; max?: number; pattern?: RegExp; optional?: boolean }

// Control characters (except tab/newline) and bidi overrides are never valid in user text.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g

/** Read a string field (JSON body or FormData): type check, Unicode NFC, strip control chars, trim, length/pattern rules.
 * Output encoding happens at render time (React escapes text; no HTML is ever built from user input). */
export function str(value: unknown, field: string, rule: Rule = {}): string {
  if (value === undefined || value === null || value === '') {
    if (rule.optional) return ''
    return fail(422, `${field}: required`)
  }
  if (typeof value !== 'string') return fail(422, `${field}: must be text`)
  if (value.length > 10_000) return fail(422, `${field}: too long`)
  const v = value.normalize('NFC').replace(CONTROL, '').trim()
  if (!v && !rule.optional) return fail(422, `${field}: required`)
  if (rule.min !== undefined && v.length < rule.min) fail(422, `${field}: at least ${rule.min} characters`)
  if (rule.max !== undefined && v.length > rule.max) fail(422, `${field}: at most ${rule.max} characters`)
  if (rule.pattern && !rule.pattern.test(v)) fail(422, `${field}: invalid format`)
  return v
}

export function int(value: unknown, field: string, optional = false): number | null {
  if (value === undefined || value === null || value === '') return optional ? null : fail(422, `${field}: required`)
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d{1,15}$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(n) || n < 0) fail(422, `${field}: must be a positive integer`)
  return n
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return fail(415, 'Content-Type must be application/json')
  }
  try {
    const body = await req.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    /* fall through */
  }
  return fail(400, 'Body must be a JSON object')
}

export const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
export const today = () => now().slice(0, 10)

export const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/
