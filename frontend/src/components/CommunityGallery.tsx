import { Check, Flag, Globe2, Heart, Link2, Shuffle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl, shareUrl } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { REPORT_REASONS, type Character, type GallerySort, type PublicDesign, type ReportReason, type User } from '../lib/types'

export type GalleryActions = {
  run: Run
  user: User | null
  onNeedLogin: () => void
  onRemixed: (c: Character) => void
}

type Props = GalleryActions & { compact?: boolean }

/** Public showcase of designs users chose to share. Works logged out (landing page) and logged in. */
export default function CommunityGallery({ compact = false, ...actions }: Props) {
  const { t } = useI18n()
  const { run } = actions
  const [sort, setSort] = useState<GallerySort>('new')
  const [items, setItems] = useState<PublicDesign[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    run(t('Loading community gallery'), async () => {
      const page = await api.gallery(sort)
      setItems(page.items)
      setNext(sort === 'popular' ? page.next_offset : page.next_before)
      setLoaded(true)
    })
  }, [run, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const more = () =>
    run(t('Loading more'), async () => {
      const page = await api.gallery(sort, next)
      setItems((prev) => [...prev, ...page.items])
      setNext(sort === 'popular' ? page.next_offset : page.next_before)
    })

  const shown = compact ? items.slice(0, 12) : items
  const update = (d: PublicDesign) => setItems((prev) => prev.map((x) => (x.id === d.id ? d : x)))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!compact && (
          <header>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Globe2 size={18} /> {t('Community gallery')}</h2>
            <p className="text-sm text-violet-300/70">{t('Characters shared by CharaForge creators. Like them, share them, or start your own character from one.')}</p>
          </header>
        )}
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs" role="tablist" aria-label={t('Sort')}>
          {(['new', 'popular'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={sort === s} onClick={() => setSort(s)}
              className={`rounded-md px-3 py-1 font-medium ${sort === s ? 'bg-violet-500/40 text-white' : 'text-violet-300/70 hover:text-white'}`}>
              {s === 'new' ? t('Newest') : t('Popular')}
            </button>
          ))}
        </div>
      </div>
      {loaded && items.length === 0 && (
        <p className="panel p-6 text-center text-sm text-violet-300/70">{t('Nothing shared yet. Be the first to publish a design!')}</p>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {shown.map((d) => (
          <li key={d.id} className="panel overflow-hidden">
            <DesignCard design={d} onChange={update} {...actions} />
          </li>
        ))}
      </ul>
      {!compact && next !== null && (
        <div className="text-center"><button className="btn-ghost" onClick={more}>{t('Load more')}</button></div>
      )}
    </section>
  )
}

/** One shared design with its actions. Also used by the share page. */
export function DesignCard({ design: d, onChange, run, user, onNeedLogin, onRemixed, large = false }: GalleryActions & {
  design: PublicDesign
  onChange: (d: PublicDesign) => void
  large?: boolean
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [reporting, setReporting] = useState(false)

  const like = () => {
    if (!user) return onNeedLogin()
    const optimistic = { ...d, liked_by_me: !d.liked_by_me, like_count: d.like_count + (d.liked_by_me ? -1 : 1) }
    onChange(optimistic)
    api[d.liked_by_me ? 'unlike' : 'like'](d.id)
      .then((r) => onChange({ ...optimistic, liked_by_me: r.liked, like_count: r.like_count }))
      .catch(() => onChange(d))
  }

  const copy = () => {
    navigator.clipboard?.writeText(shareUrl(d.id)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => window.prompt(t('Copy this link'), shareUrl(d.id)))
  }

  const remix = () => {
    if (!user) return onNeedLogin()
    run(t('Creating your character'), async () => onRemixed(await api.remix(d.id)))
  }

  return (
    <>
      <a href={`/d/${d.id}`} className="block" aria-label={d.character_name}>
        <img src={fileUrl(d.image_url)} alt={`${d.character_name}: ${d.prompt}`} loading="lazy"
          className={`w-full bg-white object-cover ${large ? 'aspect-[2/3] max-h-[70vh] object-contain' : 'aspect-[2/3]'}`} />
      </a>
      <div className="space-y-1.5 p-2">
        <div className="truncate text-sm font-medium">{d.character_name}</div>
        {d.prompt !== 'base design' && <div className={`${large ? '' : 'truncate'} text-[11px] text-violet-300/70`}>{d.prompt}</div>}
        <div className="truncate text-[11px] text-violet-300/50">
          {t('by {author}', { author: d.author })} · {t(d.style)} · {timeAgo(d.published_at)}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={like} aria-pressed={d.liked_by_me} aria-label={d.liked_by_me ? t('Unlike') : t('Like')}
            className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs transition hover:bg-white/10 ${d.liked_by_me ? 'text-pink-300' : 'text-violet-300/70'}`}>
            <Heart size={14} fill={d.liked_by_me ? 'currentColor' : 'none'} /> {d.like_count}
          </button>
          <button onClick={remix} title={t('Start from this')} aria-label={t('Start from this')} className="rounded-lg p-1 text-violet-300/70 hover:bg-white/10 hover:text-white">
            <Shuffle size={14} />
          </button>
          <button onClick={copy} title={t('Copy share link')} aria-label={t('Copy share link')} className="rounded-lg p-1 text-violet-300/70 hover:bg-white/10 hover:text-white">
            {copied ? <Check size={14} className="text-emerald-300" /> : <Link2 size={14} />}
          </button>
          <button onClick={() => (user ? setReporting(true) : onNeedLogin())} title={t('Report')} aria-label={t('Report')} className="ml-auto rounded-lg p-1 text-violet-300/40 hover:bg-white/10 hover:text-red-300">
            <Flag size={13} />
          </button>
        </div>
        {large && (
          <button className="btn-primary w-full" onClick={remix}><Shuffle size={15} /> {t('Start from this')}</button>
        )}
      </div>
      {reporting && <ReportDialog designId={d.id} run={run} onClose={() => setReporting(false)} />}
    </>
  )
}

const REASON_LABEL: Record<ReportReason, string> = {
  nsfw: 'Sexual or nude content',
  violence: 'Violence or gore',
  hate: 'Hate or harassment',
  copyright: "Someone else's work or character",
  spam: 'Spam or scam',
  other: 'Something else',
}

function ReportDialog({ designId, run, onClose }: { designId: number; run: Run; onClose: () => void }) {
  const { t } = useI18n()
  const [reason, setReason] = useState<ReportReason>('nsfw')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const submit = () =>
    run(t('Sending report'), async () => {
      await api.report(designId, reason, note)
      setSent(true)
    })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md space-y-3 bg-ink-900/95 p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="r-title">
        <div className="flex items-center justify-between">
          <h2 id="r-title" className="flex items-center gap-2 font-display text-base font-bold"><Flag size={16} /> {t('Report this design')}</h2>
          <button aria-label={t('Close')} className="rounded-lg p-1 hover:bg-white/10" onClick={onClose}><X size={16} /></button>
        </div>
        {sent ? (
          <>
            <p className="text-sm text-emerald-200">{t('Thank you. Our moderators will review it.')}</p>
            <button className="btn-primary w-full" onClick={onClose}>{t('Close')}</button>
          </>
        ) : (
          <>
            <fieldset className="space-y-1.5">
              <legend className="label">{t('What is the problem?')}</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-violet-500" />
                  {t(REASON_LABEL[r])}
                </label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="r-note">{t('Details (optional)')}</label>
              <textarea id="r-note" className="input min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-[11px] text-violet-300/60">{t('Reports are confidential. The author is not told who reported.')}</p>
            <button className="btn-primary w-full" onClick={submit}>{t('Send report')}</button>
          </>
        )}
      </div>
    </div>
  )
}
