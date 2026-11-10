import { ArrowLeft, Cookie, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LanguageSwitch, useI18n } from '../lib/i18n'
import { legalPage, type LegalDoc } from '../lib/legal'

export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'content-policy']
const LABEL: Record<LegalDoc, string> = { privacy: 'Privacy', terms: 'Terms', 'content-policy': 'Content Policy' }

/** Footer links to the legal pages (hash routes, work logged in and out). */
export function LegalLinks({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('Legal')} className={`flex flex-wrap gap-x-3 gap-y-1 text-violet-300/60 ${className}`}>
      {LEGAL_DOCS.map((d) => (
        <a key={d} href={`#/${d}`} className="hover:text-violet-100 hover:underline">{t(LABEL[d])}</a>
      ))}
    </nav>
  )
}

export default function LegalView({ doc, onBack }: { doc: LegalDoc; onBack: () => void }) {
  const { lang, t } = useI18n()
  const page = legalPage(doc, lang)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [doc])
  return (
    <article className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onBack}><ArrowLeft size={14} /> {t('Back')}</button>
        <LanguageSwitch />
      </div>
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><FileText size={20} /> {page.title}</h1>
        <p className="text-sm text-violet-200/80">{page.intro}</p>
        <LegalLinks className="text-xs" />
      </header>
      {page.sections.map((s) => (
        <section key={s.h} className="panel space-y-2 p-5">
          <h2 className="font-display text-base font-bold">{s.h}</h2>
          {s.p.map((para) => <p key={para.slice(0, 40)} className="text-sm leading-relaxed text-violet-100/85">{para}</p>)}
        </section>
      ))}
    </article>
  )
}

const NOTICE_KEY = 'charaforge_cookie_notice' // UI preference only

/** Information notice: only strictly necessary cookies are used, so no consent banner/choices are needed. */
export function CookieNotice() {
  const { t } = useI18n()
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== '1'
    } catch {
      return true
    }
  })
  // keep the bottom of long pages reachable while the notice is shown (it is fixed over the content)
  useEffect(() => {
    if (!open) return
    document.documentElement.style.setProperty('--notice-space', '7rem') // used by body and the app's <main>
    return () => {
      document.documentElement.style.removeProperty('--notice-space')
    }
  }, [open])
  if (!open) return null
  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(NOTICE_KEY, '1')
    } catch {
      /* storage blocked */
    }
  }
  return (
    <div role="region" aria-label={t('Cookies')} className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-ink-900/95 px-4 py-3 text-xs text-violet-100 shadow-glow sm:flex-nowrap">
      <Cookie size={16} className="shrink-0 text-violet-300" />
      <p className="flex-1">
        {t('We only use cookies that are strictly necessary to keep you logged in and protect your account. No advertising or tracking.')}{' '}
        <a href="#/privacy" className="underline">{t('Privacy Policy')}</a>
      </p>
      <button className="btn-primary px-3 py-1.5 text-xs" onClick={close}>{t('OK')}</button>
    </div>
  )
}
