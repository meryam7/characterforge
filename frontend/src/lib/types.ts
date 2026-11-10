// Mirrors the API output shapes in server/db.ts (characterOut, designOut, activityOut) and server/routes/*.
export type User = {
  id: number
  email: string
  display_name: string
  is_admin: boolean
  mfa_enabled: boolean
  mfa_verified: boolean // this session passed MFA
  created_at: string
}

/** POST /auth/login, /register, /mfa/verify, /mfa/enrol/finish */
export type LoginResult =
  | { status: 'ok'; user: User; recovery_codes?: string[] }
  | { status: 'mfa_required'; challenge: string }
  | { status: 'mfa_enrol_required'; challenge: string }

export type MfaSetup = { secret: string; otpauth_uri: string }

export type SecurityEvent = {
  id: number
  type: string
  severity: 'info' | 'warn' | 'alert'
  user_id: number | null
  subject: string | null
  ip_hash: string | null
  path: string | null
  detail: string
  created_at: string
}
export type SecurityEventsPage = { items: SecurityEvent[]; next_before: number | null }
export type SecuritySummary = {
  last_24h: { type: string; severity: string; n: number }[]
  recent_alerts: { id: number; type: string; detail: string; created_at: string }[]
  users: { n: number; mfa: number | null }
  active_sessions: number
}

export type Character = {
  id: number
  name: string
  description: string
  style: string
  seed: number
  embedding: number[] | null
  reference_url: string | null
  cover_url: string | null
  design_count: number
  remixed_from: number | null
  created_at: string
}

export type Design = {
  id: number
  character_id: number
  parent_id: number | null
  kind: 'generate' | 'edit'
  source: 'ai' | 'mock'
  prompt: string
  consistency: number | null
  image_url: string
  is_public: boolean
  created_at: string
}

/** Client-side selection: mask (1 = selected) + purple overlay for the canvas. */
export type Selection = { mask: Uint8Array; overlayUrl: string; coverage: number }
export type Point = { x: number; y: number; positive: boolean }

export type AiStatus = { enabled: boolean; daily_limit: number; remaining: number }

export type ActivityAction =
  | 'created' | 'reference' | 'generated' | 'edited' | 'exported' | 'published' | 'unpublished' | 'deleted'

export type Activity = {
  id: number
  action: ActivityAction
  character_id: number | null
  character_name: string
  design_id: number | null
  detail: string
  thumb_url: string | null
  character_exists: boolean
  created_at: string
}
export type HistoryPage = { items: Activity[]; next_before: number | null }

export type PublicDesign = {
  id: number
  image_url: string
  prompt: string
  kind: 'generate' | 'edit'
  source: 'ai' | 'mock'
  character_name: string
  style: string
  author: string
  published_at: string
  like_count: number
  liked_by_me: boolean
}
export type GallerySort = 'new' | 'popular'
export type GalleryPage = { items: PublicDesign[]; next_before: number | null; next_offset: number | null }

export const REPORT_REASONS = ['nsfw', 'violence', 'hate', 'copyright', 'spam', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
export type ReportItem = {
  design_id: number
  reports: number
  reasons: string
  notes: string | null
  last_report_at: string
  is_public: number
  prompt: string
  character_name: string
  author: string
  author_id: number
  image_url: string
}

// Keys must match STYLES in server/ai.ts
export const STYLES = ['anime', 'pixel art', 'comic book', 'painterly', 'chibi', 'realistic concept art']
