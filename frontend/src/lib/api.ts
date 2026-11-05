import type {
  AuthResult, Character, Design, GalleryPage, HistoryPage, Point, SegmentResult, User,
} from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
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

export const fileUrl = (path: string | null | undefined) =>
  path ? (path.startsWith('http') ? path : `${BASE}${path}`) : ''

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/api/auth/login')) {
      auth.set(null)
      window.dispatchEvent(new Event(LOGGED_OUT_EVENT))
    }
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : friendlyValidation(j.detail)
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return res
}

function friendlyValidation(detail: unknown): string {
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0] as { loc?: unknown[]; msg?: string }
    const field = d.loc?.[d.loc.length - 1]
    return field ? `${String(field).replace('_', ' ')}: ${d.msg}` : (d.msg ?? 'Invalid input')
  }
  return JSON.stringify(detail)
}

const json = async <T,>(path: string, init?: RequestInit) => (await raw(path, init)).json() as Promise<T>
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  // auth
  register: (email: string, password: string, display_name: string) =>
    json<AuthResult>('/api/auth/register', post({ email, password, display_name })),
  login: (email: string, password: string) => json<AuthResult>('/api/auth/login', post({ email, password })),
  me: () => json<User>('/api/auth/me'),
  deleteAccount: () => json<{ ok: boolean }>('/api/auth/me', { method: 'DELETE' }),

  // characters + studio
  listCharacters: () => json<Character[]>('/api/characters'),
  createCharacter: (data: { name: string; description: string; style: string }) =>
    json<Character>('/api/characters', post(data)),
  deleteCharacter: (id: number) => json<{ ok: boolean }>(`/api/characters/${id}`, { method: 'DELETE' }),
  uploadReference: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return json<Character>(`/api/characters/${id}/reference`, { method: 'POST', body: form })
  },
  listDesigns: (id: number) => json<Design[]>(`/api/characters/${id}/designs`),
  generate: (id: number, prompt: string, lock_identity: boolean) =>
    json<Design>(`/api/characters/${id}/generate`, post({ prompt, lock_identity })),
  segment: (designId: number, points: Point[]) =>
    json<SegmentResult>(`/api/designs/${designId}/segment`, post({ points })),
  edit: (designId: number, mask_id: string, prompt: string) =>
    json<Design>(`/api/designs/${designId}/edit`, post({ mask_id, prompt })),

  // history + community
  history: (before?: number | null, characterId?: number | null) => {
    const q = new URLSearchParams({ limit: '30' })
    if (before) q.set('before', String(before))
    if (characterId) q.set('character_id', String(characterId))
    return json<HistoryPage>(`/api/history?${q}`)
  },
  clearHistory: () => json<{ ok: boolean }>('/api/history', { method: 'DELETE' }),
  gallery: (before?: number | null) => json<GalleryPage>(`/api/gallery${before ? `?before=${before}` : ''}`),
  publish: (designId: number) => json<Design>(`/api/designs/${designId}/publish`, { method: 'POST' }),
  unpublish: (designId: number) => json<{ ok: boolean }>(`/api/designs/${designId}/publish`, { method: 'DELETE' }),

  // files
  blob: async (path: string) => (await raw(path)).blob(),
  download: async (path: string, filename: string) => {
    const url = URL.createObjectURL(await (await raw(path)).blob())
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000) // revoking immediately breaks some browsers
  },
}
