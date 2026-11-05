import type { AiStatus, AuthResult, Character, Design, GalleryPage, HistoryPage, User } from './types'

const TOKEN_KEY = 'charaforge_token'

let token: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
})()

export const auth = {
  get token() {
    return token
  },
  set(t: string | null) {
    token = t
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* private mode: keep it in memory only */
    }
  },
}

/** Fired when the server rejects the token, so the app can return to the login screen. */
export const LOGGED_OUT_EVENT = 'charaforge:logged-out'

/** API image URLs are same-origin paths (/api/files/...). */
export const fileUrl = (path: string | null | undefined) => path ?? ''

/** Error with the HTTP status and the JSON body (e.g. {detail, fallback}). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) {
    super(message)
  }
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Network error - check your connection')
  }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/login')) {
      auth.set(null)
      window.dispatchEvent(new Event(LOGGED_OUT_EVENT))
    }
    let data: Record<string, unknown> = {}
    try {
      data = await res.json()
    } catch {
      /* not JSON */
    }
    const msg = typeof data.detail === 'string' ? data.detail : res.statusText || `Request failed (${res.status})`
    throw new ApiError(res.status, msg, data)
  }
  return res
}

const json = async <T,>(path: string, init?: RequestInit) => (await raw(path, init)).json() as Promise<T>
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

async function image(path: string, body: unknown) {
  const res = await raw(path, post(body))
  const left = res.headers.get('X-AI-Remaining')
  return { blob: await res.blob(), remaining: left === null ? null : Number(left) }
}

export const api = {
  // auth
  register: (email: string, password: string, display_name: string) =>
    json<AuthResult>('/api/auth/register', post({ email, password, display_name })),
  login: (email: string, password: string) => json<AuthResult>('/api/auth/login', post({ email, password })),
  me: () => json<User>('/api/auth/me'),
  deleteAccount: () => json<{ ok: boolean }>('/api/auth/me', { method: 'DELETE' }),

  // characters + designs (images are produced in the browser, see lib/engine)
  listCharacters: () => json<Character[]>('/api/characters'),
  createCharacter: (data: { name: string; description: string; style: string }) =>
    json<Character>('/api/characters', post(data)),
  deleteCharacter: (id: number) => json<{ ok: boolean }>(`/api/characters/${id}`, { method: 'DELETE' }),
  uploadReference: (id: number, form: FormData) =>
    json<Character>(`/api/characters/${id}/reference`, { method: 'POST', body: form }),
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
  gallery: (before?: number | null) => json<GalleryPage>(`/api/gallery${before ? `?before=${before}` : ''}`),
  publish: (designId: number) => json<Design>(`/api/designs/${designId}/publish`, { method: 'POST' }),
  unpublish: (designId: number) => json<{ ok: boolean }>(`/api/designs/${designId}/publish`, { method: 'DELETE' }),
}
