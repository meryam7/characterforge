import {
  Download, Globe2, History, ImagePlus, Pencil, Sparkles, Trash2, UserPlus, EyeOff, type LucideIcon,
} from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useCallback, useEffect, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl } from '../lib/api'
import { timeAgo } from '../lib/format'
import type { Activity, ActivityAction } from '../lib/types'
import ConfirmButton from './ConfirmButton'

const META: Record<ActivityAction, { label: string; icon: LucideIcon; tone: string }> = {
  created: { label: 'Created character', icon: UserPlus, tone: 'text-emerald-300' },
  reference: { label: 'Uploaded reference', icon: ImagePlus, tone: 'text-sky-300' },
  generated: { label: 'Generated design', icon: Sparkles, tone: 'text-violet-300' },
  edited: { label: 'Edited design', icon: Pencil, tone: 'text-fuchsia-300' },
  exported: { label: 'Exported', icon: Download, tone: 'text-amber-300' },
  published: { label: 'Shared to community', icon: Globe2, tone: 'text-teal-300' },
  unpublished: { label: 'Removed from community', icon: EyeOff, tone: 'text-violet-300/70' },
  deleted: { label: 'Deleted character', icon: Trash2, tone: 'text-red-300' },
}

type Props = { run: Run; onOpenCharacter: (id: number) => void }

export default function HistoryView({ run, onOpenCharacter }: Props) {
  const { t } = useI18n()
  const [items, setItems] = useState<Activity[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(
    (before: number | null) =>
      run(t('Loading history'), async () => {
        const page = await api.history(before)
        setItems((prev) => (before ? [...prev, ...page.items] : page.items))
        setNext(page.next_before)
        setLoaded(true)
      }),
    [run],
  )

  useEffect(() => {
    load(null)
  }, [load])

  const clear = () =>
    run(t('Clearing history'), async () => {
      await api.clearHistory()
      setItems([])
      setNext(null)
    })

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><History size={18} /> {t('Your history')}</h2>
          <p className="text-sm text-violet-300/70">{t('Everything you created, edited, exported and shared, including deleted characters.')}</p>
        </div>
        {items.length > 0 && (
          <ConfirmButton question={t('Clear all history?')} onConfirm={clear} className="btn-ghost text-xs">
            <Trash2 size={14} /> Clear history
          </ConfirmButton>
        )}
      </header>

      {loaded && items.length === 0 && (
        <p className="panel p-6 text-center text-sm text-violet-300/70">{t('No activity yet. Create a character in the studio to get started.')}</p>
      )}

      <ol className="space-y-2">
        {items.map((a) => {
          const m = META[a.action] ?? META.created
          const Icon = m.icon
          return (
            <li key={a.id} className="panel flex items-center gap-3 p-3">
              <div className="checker h-16 w-11 shrink-0 overflow-hidden rounded-lg">
                {a.thumb_url && <img src={fileUrl(a.thumb_url)} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${m.tone}`}>
                  <Icon size={13} /> {t(m.label)}
                </div>
                <div className="truncate text-sm font-medium">{a.character_name}</div>
                {a.detail && <div className="truncate text-xs text-violet-300/60">{a.detail}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <time className="text-[11px] text-violet-300/60" dateTime={a.created_at} title={new Date(a.created_at).toLocaleString()}>
                  {timeAgo(a.created_at)}
                </time>
                {a.character_exists && a.character_id !== null ? (
                  <button className="chip" onClick={() => onOpenCharacter(a.character_id!)}>{t('Open')}</button>
                ) : a.action !== 'deleted' ? (
                  <span className="text-[10px] text-violet-300/40">{t('deleted')}</span>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {next && (
        <div className="text-center"><button className="btn-ghost" onClick={() => load(next)}>{t('Load older')}</button></div>
      )}
    </section>
  )
}
