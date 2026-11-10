/** API client. Authentication uses an HttpOnly session cookie that JavaScript can't read (safe from XSS token theft).
 * Every state-changing request sends the CSRF token (double-submit cookie __Host-csrf → X-CSRF-Token header). */
import type {
  AiStatus, Character, Design, GalleryPage, GallerySort, HistoryPage, LoginResult, MfaSetup, PublicDesign, ReportItem, ReportReason,
  SecurityEventsPage, SecuritySummary, User,
} from './types'

/** Fired when the server says the session is gone, so the app returns to the login screen. */
export const LOGGED_OUT_EVENT = 'charaforge:logged-out'

/** API image URLs are same-origin paths (/api/files/...); the session cookie authorises them. */
export const fileUrl = (path: string | null | undefined) => path ?? ''

/** Error with the HTTP status and the JSON body (e.g. {detail, fallback}). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) {
    super(message)
  }
}

const readCsrf = () => document.cookie.split('; ').find((c) => c.startsWith('__Host-csrf='))?.slice('__Host-csrf='.length) ?? ''

async function csrfToken(): Promise<string> {
  let t = readCsrf()
  if (!t) {
    const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
    t = readCsrf() || ((await res.json()) as { csrf: string }).csrf
  }
  return t
}

let loggedIn = false
export const markLoggedIn = (v: boolean) => {
  loggedIn = v
}

async function raw(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET') headers.set('X-CSRF-Token', await csrfToken())
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let res: Response
  try {
    res = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'Network error - check your connection')
  }
  if (!res.ok) {
    let data: Record<string, unknown> = {}
    try {
      data = await res.json()
    } catch {
      /* not JSON */
    }
    // CSRF cookie expired or rotated: fetch a fresh one and retry once
    if (res.status === 403 && method !== 'GET' && !retried && String(data.detail ?? '').startsWith('Security check failed')) {
      await fetch('/api/auth/csrf', { credentials: 'same-origin' })
      return raw(path, init, true)
    }
    if (res.status === 401 && loggedIn && !path.startsWith('/api/auth/')) {
      loggedIn = false
      window.dispatchEvent(new Event(LOGGED_OUT_EVENT))
    }
    const msg = typeof data.detail === 'string' ? data.detail : res.statusText || `Request failed (${res.status})`
    throw new ApiError(res.status, msg, data)
  }
  return res
}

const json = async <T,>(path: string, init?: RequestInit) => (await raw(path, init)).json() as Promise<T>
const post = (body: unknown = {}): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

async function image(path: string, body: unknown) {
  const res = await raw(path, post(body))
  const left = res.headers.get('X-AI-Remaining')
  return { blob: await res.blob(), remaining: left === null ? null : Number(left) }
}

export const api = {
  // auth + account
  register: (email: string, password: string, display_name: string, accept_terms: boolean) =>
    json<LoginResult>('/api/auth/register', post({ email, password, display_name, accept_terms })),
  login: (email: string, password: string) => json<LoginResult>('/api/auth/login', post({ email, password })),
  mfaVerify: (challenge: string, code: string) => json<LoginResult>('/api/auth/mfa/verify', post({ challenge, code })),
  mfaEnrolStart: (challenge: string) => json<MfaSetup>('/api/auth/mfa/enrol/start', post({ challenge })),
  mfaEnrolFinish: (challenge: string, code: string) => json<LoginResult>('/api/auth/mfa/enrol/finish', post({ challenge, code })),
  me: () => json<User>('/api/auth/me'),
  logout: () => json<{ ok: boolean }>('/api/auth/logout', post()),
  revokeOtherSessions: () => json<{ ok: boolean }>('/api/auth/sessions/revoke', post()),
  changePassword: (current_password: string, new_password: string) =>
    json<{ ok: boolean }>('/api/auth/password', post({ current_password, new_password })),
  mfaSetup: () => json<MfaSetup>('/api/auth/mfa/setup', post()),
  mfaEnable: (code: string) => json<{ user: User; recovery_codes: string[] }>('/api/auth/mfa/enable', post({ code })),
  mfaDisable: (password: string, code: string) => json<{ ok: boolean }>('/api/auth/mfa/disable', post({ password, code })),
  deleteAccount: (password: string, code?: string) =>
    json<{ ok: boolean }>('/api/auth/me', { method: 'DELETE', body: JSON.stringify({ password, code }) }),

  // characters + designs (images are produced in the browser, see lib/engine)
  listCharacters: () => json<Character[]>('/api/characters'),
  createCharacter: (data: { name: string; description: string; style: string }) => json<Character>('/api/characters', post(data)),
  deleteCharacter: (id: number) => json<{ ok: boolean }>(`/api/characters/${id}`, { method: 'DELETE' }),
  uploadReference: (id: number, form: FormData) => json<Character>(`/api/characters/${id}/reference`, { method: 'POST', body: form }),
  listDesigns: (id: number) => json<Design[]>(`/api/characters/${id}/designs`),
  uploadDesign: (id: number, form: FormData) => json<Design>(`/api/characters/${id}/designs`, { method: 'POST', body: form }),
  logExport: (id: number, detail: string, design_id?: number) =>
    json<{ ok: boolean }>(`/api/characters/${id}/exported`, post({ detail, design_id })),

  // Workers AI (PNG bytes back; ApiError.data.fallback === true means "use preview art")
  aiStatus: () => json<AiStatus>('/api/ai/status'),
  aiGenerate: (character_id: number, prompt: string, anchor_b64: string | null) =>
    image('/api/ai/generate', { character_id, prompt, anchor_b64 }),
  aiInpaint: (design_id: number, prompt: string, image_b64: string, mask: number[]) =>
    image('/api/ai/inpaint', { design_id, prompt, image_b64, mask }),

  // history + community
  history: (before?: number | null) => json<HistoryPage>(`/api/history?limit=30${before ? `&before=${before}` : ''}`),
  clearHistory: () => json<{ ok: boolean }>('/api/history', { method: 'DELETE' }),
  gallery: (sort: GallerySort = 'new', cursor?: number | null) =>
    json<GalleryPage>(`/api/gallery?sort=${sort}${cursor ? `&${sort === 'popular' ? 'offset' : 'before'}=${cursor}` : ''}`),
  publicDesign: (id: number) => json<PublicDesign>(`/api/gallery/${id}`),
  like: (id: number) => json<{ liked: boolean; like_count: number }>(`/api/gallery/${id}/like`, post()),
  unlike: (id: number) => json<{ liked: boolean; like_count: number }>(`/api/gallery/${id}/like`, { method: 'DELETE' }),
  remix: (id: number) => json<Character>(`/api/gallery/${id}/remix`, post()),
  report: (id: number, reason: ReportReason, note: string) => json<{ ok: boolean }>(`/api/gallery/${id}/report`, post({ reason, note })),
  publish: (designId: number) => json<Design>(`/api/designs/${designId}/publish`, post()),
  unpublish: (designId: number) => json<{ ok: boolean }>(`/api/designs/${designId}/publish`, { method: 'DELETE' }),

  // admin (MFA-verified admins only)
  reports: () => json<{ items: ReportItem[] }>('/api/admin/reports'),
  resolveReport: (designId: number, action: 'dismiss' | 'remove') =>
    json<{ ok: boolean }>(`/api/admin/reports/${designId}/resolve`, post({ action })),
  securitySummary: () => json<SecuritySummary>('/api/admin/security/summary'),
  securityEvents: (before?: number | null, severity?: string) =>
    json<SecurityEventsPage>(`/api/admin/security/events?limit=50${before ? `&before=${before}` : ''}${severity ? `&severity=${severity}` : ''}`),
}

/** Public share link of a shared design (served with social-preview tags by functions/d/[id].ts). */
export const shareUrl = (designId: number) => `${window.location.origin}/d/${designId}`
