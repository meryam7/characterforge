import { Box, Download, Eraser, Globe2, Link2, MousePointerClick, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import type { Character, Design, Selection } from '../lib/types'

export type ExportKind = 'png' | 'transparent' | 'sheet' | 'godot'

const IDEAS = ['battle pose', 'casual outfit', 'winter coat', 'smiling and waving', 'side view', 'holding a sword']

export function GeneratePanel({
  character,
  hasDesigns,
  onGenerate,
}: {
  character: Character
  hasDesigns: boolean
  onGenerate: (prompt: string, lock: boolean) => void
}) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [lock, setLock] = useState(true)
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Sparkles size={15} /> {t('Generate a design')}</h3>
      <textarea
        className="input min-h-20"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        aria-label={t('Generate a design')}
        placeholder={hasDesigns ? t('What changes? e.g. winter coat, holding a lantern') : t('Optional extra detail for the first design')}
      />
      <div className="flex flex-wrap gap-1.5">
        {IDEAS.map((i) => (
          // the label is translated, but the English idea is inserted: the AI understands English prompts best
          <button key={i} className="chip" onClick={() => setPrompt(i)}>{t(i)}</button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-violet-200">
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="accent-violet-500" />
        {t("Keep {name}'s identity (reference lock)", { name: character.name })}
      </label>
      <button className="btn-primary w-full" onClick={() => onGenerate(prompt, lock)}>
        {hasDesigns ? t('Generate variation') : t('Generate first design')}
      </button>
      <p className="text-[11px] text-violet-300/50">{t('Tip: prompts in English give the best AI results.')}</p>
    </section>
  )
}

export function EditPanel({
  design,
  editMode,
  setEditMode,
  pointPositive,
  setPointPositive,
  selection,
  pointCount,
  onClear,
  onApply,
}: {
  design: Design | null
  editMode: boolean
  setEditMode: (v: boolean) => void
  pointPositive: boolean
  setPointPositive: (v: boolean) => void
  selection: Selection | null
  pointCount: number
  onClear: () => void
  onApply: (prompt: string) => void
}) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Wand2 size={15} /> {t('Edit a detail')}</h3>
      {!editMode ? (
        <>
          <p className="text-xs text-violet-300/70">{t('Click a part of the character (hair, jacket, boots), then describe the change.')}</p>
          <button className="btn-ghost w-full" disabled={!design} onClick={() => setEditMode(true)}>
            <MousePointerClick size={15} /> {t('Select a region')}
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button className={pointPositive ? 'btn-primary' : 'btn-ghost'} onClick={() => setPointPositive(true)}>{t('Add area')}</button>
            <button className={!pointPositive ? 'btn-primary' : 'btn-ghost'} onClick={() => setPointPositive(false)}>{t('Remove area')}</button>
          </div>
          <p className="text-xs text-violet-300/70">
            {pointCount === 0
              ? t('Click on the canvas to select a part.')
              : selection
                ? t('Selected {pct}% of the image. Keep clicking to refine.', { pct: (selection.coverage * 100).toFixed(1) })
                : t('Selecting...')}
          </p>
          <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. bright red hair" aria-label={t('Describe the change')} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => { onClear(); setEditMode(false) }}><Eraser size={15} /> {t('Cancel')}</button>
            <button
              className="btn-primary"
              disabled={!selection || !prompt.trim()}
              onClick={() => { onApply(prompt); setPrompt('') }}
            >
              {t('Apply change')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export function ExportPanel({
  design,
  designCount,
  show3D,
  setShow3D,
  onExport,
  onTogglePublish,
  onCopyLink,
}: {
  design: Design | null
  designCount: number
  show3D: boolean
  setShow3D: (v: boolean) => void
  onExport: (kind: ExportKind) => void
  onTogglePublish: () => void
  onCopyLink: () => void
}) {
  const { t } = useI18n()
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Download size={15} /> {t('Export')}</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={!design} onClick={() => onExport('png')}>PNG</button>
        <button className="btn-ghost" disabled={!design} onClick={() => onExport('transparent')}>{t('Transparent')}</button>
        <button className="btn-ghost" disabled={designCount === 0} onClick={() => onExport('sheet')}>{t('Sprite sheet')}</button>
        <button className="btn-ghost" disabled={designCount === 0} onClick={() => onExport('godot')}>{t('Godot pack')}</button>
      </div>
      <button className="btn-ghost w-full" disabled={!design} onClick={() => setShow3D(!show3D)}>
        <Box size={15} /> {show3D ? t('Back to canvas') : t('3D standee preview')}
      </button>
      <button
        className={design?.is_public ? 'btn-ghost w-full border-teal-400/40 text-teal-200' : 'btn-ghost w-full'}
        disabled={!design}
        onClick={onTogglePublish}
        title={t('Shared designs appear in the public community gallery with your display name')}
      >
        <Globe2 size={15} /> {design?.is_public ? t('Shared · click to unshare') : t('Share to community')}
      </button>
      {design?.is_public && (
        <button className="btn-ghost w-full" onClick={onCopyLink}>
          <Link2 size={15} /> {t('Copy share link')}
        </button>
      )}
    </section>
  )
}
