/** Tiny i18n: English text is the key, `fr.ts` maps it to French. Missing keys fall back to English, and
 * `npm run check:i18n` lists them. Placeholders: t('{n} designs', { n: 3 }). Language = saved choice, else the browser's. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fr } from './i18n.fr'

export type Lang = 'en' | 'fr'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'fr', label: 'FR' },
]
const KEY = 'charaforge_lang' // UI preference only (not sensitive)

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'fr') return saved
  } catch {
    /* storage blocked */
  }
  return (navigator.languages ?? [navigator.language]).some((l) => l?.toLowerCase().startsWith('fr')) ? 'fr' : 'en'
}

export type Vars = Record<string, string | number>
export function translate(lang: Lang, text: string, vars?: Vars): string {
  const s = lang === 'fr' ? (fr[text] ?? text) : text
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (text: string, vars?: Vars) => string }
const I18n = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (s, v) => translate('en', s, v) })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = detect()
    document.documentElement.lang = l // before the first render, so dates format correctly
    return l
  })
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* storage blocked: keep for this visit only */
    }
  }, [])
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (s, v) => translate(lang, s, v) }), [lang, setLang])
  return <I18n.Provider value={value}>{children}</I18n.Provider>
}

export const useI18n = () => useContext(I18n)

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div className={`inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-[11px] ${className}`} role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          className={`rounded-md px-2 py-0.5 font-medium ${lang === l.id ? 'bg-violet-500/40 text-white' : 'text-violet-300/70 hover:text-white'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
