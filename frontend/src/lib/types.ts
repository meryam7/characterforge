// Mirrors the API output shapes in server/db.ts (characterOut, designOut, activityOut) and server/routes/*.
export type User = { id: number; email: string; display_name: string; is_admin: boolean; created_at: string }
export type AuthResult = { token: string; user: User }

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
}
export type GalleryPage = { items: PublicDesign[]; next_before: number | null }

// Keys must match STYLES in server/ai.ts
export const STYLES = ['anime', 'pixel art', 'comic book', 'painterly', 'chibi', 'realistic concept art']
