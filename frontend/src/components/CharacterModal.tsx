import { X } from 'lucide-react'
import { useState } from 'react'
import { STYLES } from '../lib/types'

type Props = {
  onClose: () => void
  onCreate: (data: { name: string; description: string; style: string }, reference: File | null) => void
}

export default function CharacterModal({ onClose, onCreate }: Props) {
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
      <div className="panel w-full max-w-lg space-y-4 bg-ink-900/95 p-6 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">New character</h2>
            <p className="text-sm text-violet-300/70">Describe who they are. Every design will keep this identity.</p>
          </div>
          <button aria-label="Close" className="rounded-lg p-1 hover:bg-white/10" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="label" htmlFor="c-name">Name</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mira the Stormcaller" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="c-desc">Appearance</label>
          <textarea
            id="c-desc"
            className="input min-h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="young mage, short silver hair, violet eyes, long navy coat with gold trim"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="c-style">Art style</label>
            <select id="c-style" className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-ref">Reference image (optional)</label>
            <input
              id="c-ref"
              type="file"
              accept="image/*"
              className="input file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/30 file:px-2 file:py-1 file:text-xs file:text-violet-100"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={submit}>Create character</button>
        </div>
      </div>
    </div>
  )
}
