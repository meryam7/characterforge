import { X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { STYLES } from '../lib/types'

type Props = {
  onClose: () => void
  onCreate: (data: { name: string; description: string; style: string }, reference: File | null) => void
}

export default function CharacterModal({ onClose, onCreate }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState(STYLES[0])
  const [file, setFile] = useState<File | null>(null)

  const submit = () => {
    if (!name.trim()) return
    onCreate({ name, description, style }, file)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-lg space-y-4 bg-ink-900/95 p-6 shadow-glow" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="c-title">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="c-title" className="font-display text-lg font-bold">{t('New character')}</h2>
            <p className="text-sm text-violet-300/70">{t('Describe who they are. Every design will keep this identity.')}</p>
          </div>
          <button aria-label={t('Close')} className="rounded-lg p-1 hover:bg-white/10" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="label" htmlFor="c-name">{t('Name')}</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mira the Stormcaller" maxLength={120} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="c-desc">{t('Appearance')}</label>
          <textarea
            id="c-desc"
            className="input min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="young mage, short silver hair, violet eyes, long navy coat with gold trim"
          />
          <p className="mt-1 text-[11px] text-violet-300/50">{t('Tip: prompts in English give the best AI results.')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-style">{t('Art style')}</label>
            <select id="c-style" className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s} value={s}>{t(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-ref">{t('Reference image (optional)')}</label>
            <input
              id="c-ref"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="input file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/30 file:px-2 file:py-1 file:text-xs file:text-violet-100"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <p className="text-[11px] text-violet-300/50">{t('Only upload images you have the right to use. See the Content Policy.')}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>{t('Cancel')}</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={submit}>{t('Create character')}</button>
        </div>
      </div>
    </div>
  )
}
