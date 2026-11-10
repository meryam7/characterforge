/** App theme: dark (default), light, or follow the operating system. Saved per browser (UI preference only).
 * public/theme-init.js applies it before the first paint; this module applies changes and follows the OS in "system". */
import { useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
export const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system']
const KEY = 'charaforge_theme'
const EVENT = 'charaforge:theme'
const media = () => window.matchMedia?.('(prefers-color-scheme: light)')

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* storage blocked */
  }
  return 'dark'
}

export const resolveTheme = (mode: ThemeMode): 'dark' | 'light' =>
  mode === 'system' ? (media()?.matches ? 'light' : 'dark') : mode

export function applyTheme(mode = getThemeMode()) {
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f7f5ff' : '#0b0614')
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* keep for this visit only */
  }
  applyTheme(mode)
  window.dispatchEvent(new Event(EVENT))
}

// follow OS changes while in "system" mode
media()?.addEventListener?.('change', () => {
  if (getThemeMode() === 'system') applyTheme('system')
})

/** Current mode, re-rendering when it changes (from Settings or another component). */
export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)
  useEffect(() => {
    const on = () => setMode(getThemeMode())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return [mode, setThemeMode]
}
