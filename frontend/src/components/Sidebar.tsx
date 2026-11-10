import { Globe2, History, Palette, Plus, Settings, ShieldAlert, Trash2 } from 'lucide-react'
import type { View } from '../App'
import { fileUrl } from '../lib/api'
import { LanguageSwitch, useI18n } from '../lib/i18n'
import type { Character, User } from '../lib/types'
import ConfirmButton from './ConfirmButton'
import { LegalLinks } from './LegalView'

type Props = {
  user: User
  view: View
  setView: (v: View) => void
  characters: Character[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNew: () => void
  onDelete: (id: number) => void
}

const NAV: { id: View; label: string; icon: typeof Palette; admin?: boolean }[] = [
  { id: 'studio', label: 'Studio', icon: Palette },
  { id: 'history', label: 'History', icon: History },
  { id: 'gallery', label: 'Community', icon: Globe2 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'security', label: 'Security', icon: ShieldAlert, admin: true },
]

export default function Sidebar(p: Props) {
  const { t } = useI18n()
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-white/10 bg-ink-900/60 p-4 backdrop-blur lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="brand-text font-display text-xl font-bold">
            CharaForge
          </h1>
          <p className="mt-1 text-xs text-violet-300/70">{t('Design characters that stay themselves.')}</p>
        </div>
        <LanguageSwitch />
      </div>

      <nav className={`grid gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 ${p.user.is_admin ? 'grid-cols-5' : 'grid-cols-4'}`} aria-label={t('Main')}>
        {NAV.filter((n) => !n.admin || p.user.is_admin).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => p.setView(id)}
            aria-current={p.view === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition ${
              p.view === id ? 'bg-violet-500/25 text-violet-50' : 'text-violet-300/70 hover:bg-white/5'
            }`}
          >
            <Icon size={15} /> <span className="truncate">{t(label)}</span>
          </button>
        ))}
      </nav>

      <button className="btn-primary w-full" onClick={p.onNew}>
        <Plus size={16} /> {t('New character')}
      </button>

      <div className="flex max-h-72 min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:max-h-none">
        {p.characters.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-violet-300/60">
            {t('No characters yet. Create your first one.')}
          </p>
        )}
        {p.characters.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => p.onSelect(c.id)}
            onKeyDown={(e) => e.key === 'Enter' && p.onSelect(c.id)}
            className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition ${
              c.id === p.selectedId && p.view === 'studio'
                ? 'border-violet-400/50 bg-violet-500/15 shadow-glow'
                : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07]'
            }`}
          >
            <div className="checker h-14 w-11 shrink-0 overflow-hidden rounded-lg">
              {c.cover_url && <img src={fileUrl(c.cover_url)} alt="" className="h-full w-full object-cover object-top" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.name}</div>
              <div className="truncate text-xs text-violet-300/60">
                {t(c.style)} · {c.design_count === 1 ? t('1 design') : t('{n} designs', { n: c.design_count })}
              </div>
            </div>
            <ConfirmButton
              question={t('Delete?')}
              label={t('Delete {name}', { name: c.name })}
              onConfirm={() => p.onDelete(c.id)}
              className="rounded-lg p-1.5 text-violet-300/50 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{p.user.display_name}</div>
          <div className="truncate text-xs text-violet-300/60">{p.user.email}</div>
        </div>
        <LegalLinks className="text-[10px]" />
      </div>
    </aside>
  )
}
