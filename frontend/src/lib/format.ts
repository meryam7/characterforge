/** File-name slug used by exports (sprite sheet, Godot pack, PNG names). */
export const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'character'

const formatters = new Map<string, Intl.RelativeTimeFormat>()
const rtf = (lang: string) => {
  if (!formatters.has(lang)) formatters.set(lang, new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }))
  return formatters.get(lang)!
}
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
]

/** "3 hours ago" / "il y a 3 heures" in the page language (set by I18nProvider on <html lang>). */
export function timeAgo(iso: string, lang = document.documentElement.lang || 'en'): string {
  const secs = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf(lang).format(Math.round(secs / size), unit)
  }
  return rtf(lang).format(0, 'second')
}
