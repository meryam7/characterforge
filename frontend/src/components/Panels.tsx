import { Box, Download, Eraser, Globe2, MousePointerClick, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { slug as toSlug } from '../lib/format'
import type { Character, Design, SegmentResult } from '../lib/types'

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
  const [prompt, setPrompt] = useState('')
  const [lock, setLock] = useState(true)
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Sparkles size={15} /> Generate a design</h3>
      <textarea
        className="input min-h-20"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={hasDesigns ? 'What changes? e.g. winter coat, holding a lantern' : 'Optional extra detail for the first design'}
      />
      <div className="flex flex-wrap gap-1.5">
        {IDEAS.map((i) => (
          <button key={i} className="chip" onClick={() => setPrompt(i)}>{i}</button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-violet-200">
        <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="accent-violet-500" />
        Keep {character.name}'s identity (reference lock)
      </label>
      <button className="btn-primary w-full" onClick={() => onGenerate(prompt, lock)}>
        {hasDesigns ? 'Generate variation' : 'Generate first design'}
      </button>
    </section>
  )
}

export function EditPanel({
  design,
  editMode,
  setEditMode,
  pointPositive,
  setPointPositive,
  segment,
  pointCount,
  onClear,
  onApply,
}: {
  design: Design | null
  editMode: boolean
  setEditMode: (v: boolean) => void
  pointPositive: boolean
  setPointPositive: (v: boolean) => void
  segment: SegmentResult | null
  pointCount: number
  onClear: () => void
  onApply: (prompt: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Wand2 size={15} /> Edit a detail</h3>
      {!editMode ? (
        <>
          <p className="text-xs text-violet-300/70">Click a part of the character (hair, jacket, boots), then describe the change.</p>
          <button className="btn-ghost w-full" disabled={!design} onClick={() => setEditMode(true)}>
            <MousePointerClick size={15} /> Select a region
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button className={pointPositive ? 'btn-primary' : 'btn-ghost'} onClick={() => setPointPositive(true)}>Add area</button>
            <button className={!pointPositive ? 'btn-primary' : 'btn-ghost'} onClick={() => setPointPositive(false)}>Remove area</button>
          </div>
          <p className="text-xs text-violet-300/70">
            {pointCount === 0
              ? 'Click on the canvas to select a part.'
              : segment
                ? `Selected ${(segment.coverage * 100).toFixed(1)}% of the image. Keep clicking to refine.`
                : 'Selecting...'}
          </p>
          <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. bright red hair" />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => { onClear(); setEditMode(false) }}><Eraser size={15} /> Cancel</button>
            <button
              className="btn-primary"
              disabled={!segment || !prompt.trim()}
              onClick={() => { onApply(prompt); setPrompt('') }}
            >
              Apply change
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export function ExportPanel({
  design,
  character,
  show3D,
  setShow3D,
  onDownload,
  onTogglePublish,
}: {
  design: Design | null
  character: Character
  show3D: boolean
  setShow3D: (v: boolean) => void
  onDownload: (path: string, filename: string) => void
  onTogglePublish: () => void
}) {
  const slug = toSlug(character.name)
  return (
    <section className="panel space-y-3 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Download size={15} /> Export</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={!design} onClick={() => design && onDownload(`/api/designs/${design.id}/export?format=png`, `${slug}_${design.id}.png`)}>PNG</button>
        <button className="btn-ghost" disabled={!design} onClick={() => design && onDownload(`/api/designs/${design.id}/export?format=transparent`, `${slug}_${design.id}_transparent.png`)}>Transparent</button>
        <button className="btn-ghost" disabled={character.design_count === 0} onClick={() => onDownload(`/api/characters/${character.id}/export?target=sheet`, `${slug}_sheet.zip`)}>Sprite sheet</button>
        <button className="btn-ghost" disabled={character.design_count === 0} onClick={() => onDownload(`/api/characters/${character.id}/export?target=godot`, `${slug}_godot.zip`)}>Godot pack</button>
      </div>
      <button className="btn-ghost w-full" disabled={!design} onClick={() => setShow3D(!show3D)}>
        <Box size={15} /> {show3D ? 'Back to canvas' : '3D standee preview'}
      </button>
      <button
        className={design?.is_public ? 'btn-ghost w-full border-teal-400/40 text-teal-200' : 'btn-ghost w-full'}
        disabled={!design}
        onClick={onTogglePublish}
        title="Shared designs appear in the public community gallery with your display name"
      >
        <Globe2 size={15} /> {design?.is_public ? 'Shared · click to unshare' : 'Share to community'}
      </button>
    </section>
  )
}
