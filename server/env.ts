/** Cloudflare bindings (wrangler.toml) and per-request variables. */
export type Env = {
  DB: D1Database
  AI: Ai
  JWT_SECRET: string // secret: wrangler pages secret put JWT_SECRET
  ADMIN_EMAILS: string // comma-separated, may remove any community post
  AI_DAILY_LIMIT: string // AI images per user per day
  AI_ENABLED: string // "true" | "false"
}

export type UserRow = {
  id: number
  email: string
  display_name: string
  password_hash: string
  created_at: string
}

export type CharacterRow = {
  id: number
  user_id: number
  name: string
  description: string
  style: string
  seed: number
  reference_key: string | null
  embedding: string | null
  created_at: string
}

export type DesignRow = {
  id: number
  character_id: number
  parent_id: number | null
  kind: 'generate' | 'edit'
  source: 'ai' | 'mock'
  prompt: string
  image_key: string
  consistency: number | null
  is_public: number
  published_at: string | null
  created_at: string
}

export type ActivityRow = {
  id: number
  user_id: number
  action: string
  character_id: number | null
  character_name: string
  design_id: number | null
  detail: string
  thumb_key: string | null
  created_at: string
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow } }
