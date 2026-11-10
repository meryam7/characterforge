import { fileUrl } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { Design } from '../lib/types'

export default function Gallery({ designs, selectedId, onSelect }: { designs: Design[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const { t } = useI18n()
  if (designs.length === 0) return null
  return (
    <div className="panel flex gap-3 overflow-x-auto p-3">
      {designs.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className={`relative shrink-0 overflow-hidden rounded-xl border transition ${
            d.id === selectedId ? 'border-violet-400 shadow-glow' : 'border-white/10 opacity-80 hover:opacity-100'
          }`}
          title={d.prompt}
        >
          <img src={fileUrl(d.image_url)} alt={d.prompt} className="h-28 w-20 bg-white object-cover object-top" />
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 px-1 py-0.5 text-[10px] text-violet-100">
            {d.kind === 'edit' ? t('edit') : t('design')}
            {d.consistency !== null && ` · ${Math.round(d.consistency * 100)}%`}
            {d.is_public && ` · ${t('shared')}`}
          </span>
        </button>
      ))}
    </div>
  )
}
