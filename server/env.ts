/** Cloudflare bindings (wrangler.toml), secrets (Pages encrypted secrets) and per-request variables.
 * Secrets live ONLY here, on the server. They are never sent to the browser or written to logs. */
export type Env = {
  DB: D1Database
  AI: Ai
  // --- secrets (wrangler pages secret put NAME --project-name characterforge [--env preview]) ---
  MFA_ENCRYPTION_KEY: string // base64, 32 bytes: encrypts TOTP secrets at rest (AES-256-GCM)
  LOG_HASH_SALT: string // pseudonymises IPs/emails in logs
  ALERT_WEBHOOK_URL?: string // optional Discord/Slack webhook for security alerts
  // --- plain vars (wrangler.toml) ---
  ENVIRONMENT: string // production | staging | development
  ADMIN_EMAILS: string // comma-separated; admins must use MFA
  AI_DAILY_LIMIT: string
  AI_ENABLED: string
}

export type UserRow = {
  id: number
  email: string
  display_name: string
  password_hash: string
  mfa_secret: string | null
  mfa_enabled: number
  mfa_last_step: number
  password_changed_at: string | null
  created_at: string
}

export type SessionInfo = { idHash: string; mfa: boolean; expiresAt: number }

export type CharacterRow = {
  id: number
  user_id: number
  name: string
  description: string
  style: string
  seed: number
  reference_key: string | null
  embedding: string | null
  remixed_from?: number | null
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

export type Vars = {
  user: UserRow // set by authenticate when a valid session cookie is present
  session: SessionInfo
  requestId: string
  ipHash: string
  csrfIssued?: string // CSRF token set on this response (see session.issueCsrf)
}

export type AppEnv = { Bindings: Env; Variables: Vars }
