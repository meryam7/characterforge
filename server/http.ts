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

/** Read a trimmed string field from a JSON body or FormData and enforce simple rules. */
export function str(value: unknown, field: string, rule: Rule = {}): string {
  if (value === undefined || value === null || value === '') {
    if (rule.optional) return ''
    return fail(422, `${field}: required`)
  }
  if (typeof value !== 'string') return fail(422, `${field}: must be text`)
  const v = value.trim()
  if (rule.min !== undefined && v.length < rule.min) fail(422, `${field}: at least ${rule.min} characters`)
  if (rule.max !== undefined && v.length > rule.max) fail(422, `${field}: at most ${rule.max} characters`)
  if (rule.pattern && !rule.pattern.test(v)) fail(422, `${field}: invalid format`)
  return v
}

export function int(value: unknown, field: string, optional = false): number | null {
  if (value === undefined || value === null || value === '') return optional ? null : fail(422, `${field}: required`)
  const n = Number(value)
  if (!Number.isSafeInteger(n)) fail(422, `${field}: must be an integer`)
  return n
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
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
