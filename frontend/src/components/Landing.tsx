import { Download, Fingerprint, MousePointerClick, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Run } from '../App'
import { LanguageSwitch, useI18n } from '../lib/i18n'
import type { User } from '../lib/types'
import AuthForm from './AuthForm'
import CommunityGallery from './CommunityGallery'
import { LegalLinks } from './LegalView'

const FEATURES = [
  { icon: Fingerprint, title: 'Consistent identity', text: 'One seed, one description, one reference. Every new pose and outfit still looks like the same character.' },
  { icon: MousePointerClick, title: 'Click to edit any part', text: 'Click the hair, jacket or boots, describe the change, and only that area is repainted.' },
  { icon: Download, title: 'Game-ready exports', text: 'Transparent PNGs, sprite sheets with an atlas, and a drop-in Godot 4 pack.' },
]

type Props = { onAuthed: (u: User) => void; run: Run; banner: ReactNode }

export const focusSignUp = () => {
  document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  ;(document.querySelector('#auth input') as HTMLInputElement | null)?.focus()
}

export default function Landing({ onAuthed, run, banner }: Props) {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-14 px-4 py-10 lg:py-16">
      <div className="flex justify-end"><LanguageSwitch /></div>
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <span className="chip inline-flex items-center gap-1.5"><Sparkles size={12} /> {t('Free AI character design studio')}</span>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            {t('Design characters that')}{' '}
            <span className="brand-text">{t('stay themselves')}</span>
          </h1>
          <p className="max-w-xl text-violet-200/80">
            {t('CharaForge turns a description (and an optional reference picture) into a character you can restyle, re-pose and edit piece by piece, then export straight into your game, comic or animation.')}
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="panel space-y-1.5 p-4">
                <Icon size={18} className="text-violet-300" />
                <h2 className="text-sm font-semibold">{t(title)}</h2>
                <p className="text-xs text-violet-300/70">{t(text)}</p>
              </li>
            ))}
          </ul>
        </div>
        <div id="auth" className="space-y-3">
          {banner}
          <AuthForm onAuthed={onAuthed} run={run} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold">{t('Made by the community')}</h2>
        <CommunityGallery run={run} user={null} onNeedLogin={focusSignUp} onRemixed={() => undefined} compact />
      </div>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-violet-300/50">
        <span>{t('CharaForge · characters for games, comics and animation')}</span>
        <LegalLinks />
      </footer>
    </div>
  )
}
