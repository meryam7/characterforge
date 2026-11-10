import { Loader2, Sparkles } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl, shareUrl } from '../lib/api'
import { anchorFor, renderDesign, renderEdit, saveDesign, saveReference, type Rendered } from '../lib/engine'
import { designCanvas, godotZip, saveBlob, spriteSheetZip, transparentPng } from '../lib/engine/exporting'
import { ctx2d, toBlob } from '../lib/engine/image'
import { coverage, overlayUrl, regionMask } from '../lib/engine/select'
import { slug } from '../lib/format'
import type { AiStatus, Character, Design, Point, Selection } from '../lib/types'
import CanvasStage from './CanvasStage'
import CharacterModal from './CharacterModal'
import Gallery from './Gallery'
import { EditPanel, ExportPanel, GeneratePanel, type ExportKind } from './Panels'
import { useI18n } from '../lib/i18n'

const Preview3D = lazy(() => import('./Preview3D')) // three.js only loads when the 3D view is opened

type Props = {
  characters: Character[]
  charId: number | null
  setCharId: (id: number | null) => void
  refresh: () => Promise<Character[]>
  run: Run
  newCharacterSignal: number
  consumeNewCharacter: () => void
}

export default function Studio({ characters, charId, setCharId, refresh, run, newCharacterSignal, consumeNewCharacter }: Props) {
  const { t } = useI18n()
  const [designs, setDesigns] = useState<Design[]>([])
  const [designId, setDesignId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [pointPositive, setPointPositive] = useState(true)
  const [points, setPoints] = useState<Point[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [show3D, setShow3D] = useState(false)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pixels = useRef<{ id: number; canvas: HTMLCanvasElement; data: ImageData } | null>(null)

  const character = characters.find((c) => c.id === charId) ?? null
  const design = designs.find((d) => d.id === designId) ?? null
  const useAi = !!ai?.enabled && ai.remaining > 0

  // "New character" in the sidebar: open the dialog once, then clear the request (so it can't reopen on remount)
  useEffect(() => {
    if (newCharacterSignal > 0) {
      setShowModal(true)
      consumeNewCharacter()
    }
  }, [newCharacterSignal, consumeNewCharacter])

  useEffect(() => {
    api.aiStatus().then(setAi).catch(() => setAi(null))
  }, [])

  const resetEditing = useCallback(() => {
    setEditMode(false)
    setPoints([])
    setSelection(null)
  }, [])

  useEffect(() => {
    resetEditing()
    setShow3D(false)
    setNotice(null)
    if (charId === null) {
      setDesigns([])
      setDesignId(null)
      return
    }
    run(t('Loading designs'), async () => {
      const list = await api.listDesigns(charId)
      setDesigns(list)
      setDesignId(list.length ? list[list.length - 1].id : null)
    })
  }, [charId, run, resetEditing])

  /** Pixels of the selected design (cached), used for selection and edits. */
  const designPixels = async (d: Design) => {
    if (pixels.current?.id !== d.id) {
      const c = await designCanvas(d)
      pixels.current = { id: d.id, canvas: c, data: ctx2d(c).getImageData(0, 0, c.width, c.height) }
    }
    return pixels.current
  }

  const selectDesign = (id: number) => {
    resetEditing()
    setDesignId(id)
  }

  const handleCreate = (data: { name: string; description: string; style: string }, file: File | null) => {
    setShowModal(false)
    run(t('Creating character'), async () => {
      let ch = await api.createCharacter(data)
      if (file) ch = await saveReference(ch, file)
      await refresh()
      setCharId(ch.id)
    })
  }

  const afterRender = async (r: Rendered, kind: 'generate' | 'edit', prompt: string, parentId?: number) => {
    if (!character) return
    if (r.remaining !== null) setAi((s) => (s ? { ...s, remaining: r.remaining! } : s))
    setNotice(r.notice ? t(r.notice) : null)
    const d = await saveDesign(character, r, { kind, prompt, parentId })
    setDesigns((prev) => [...prev, d])
    resetEditing()
    setDesignId(d.id)
    await refresh()
  }

  const handleGenerate = (prompt: string, lock: boolean) => {
    if (!character) return
    run(useAi ? t('Generating with AI (5-30 s)') : t('Generating design'), async () => {
      const anchor = lock ? await anchorFor(character, designs) : null
      const r = await renderDesign(character, prompt, anchor, useAi)
      await afterRender(r, 'generate', prompt)
    })
  }

  const handleAddPoint = (p: Point) => {
    if (!design) return
    const next = [...points, p]
    setPoints(next)
    run(t('Selecting region'), async () => {
      const { data } = await designPixels(design)
      const mask = regionMask(data, next)
      setSelection({ mask, overlayUrl: overlayUrl(mask, data.width, data.height), coverage: coverage(mask) })
    })
  }

  const handleApplyEdit = (prompt: string) => {
    if (!design || !selection) return
    run(useAi ? t('Repainting with AI (10-40 s)') : t('Applying edit'), async () => {
      const { canvas } = await designPixels(design)
      const r = await renderEdit(design, canvas, selection.mask, prompt, useAi)
      await afterRender(r, 'edit', prompt, design.id)
    })
  }

  const handleTogglePublish = () => {
    if (!design) return
    run(design.is_public ? t('Removing from community') : t('Sharing to community'), async () => {
      if (design.is_public) await api.unpublish(design.id)
      else await api.publish(design.id)
      setDesigns((prev) => prev.map((d) => (d.id === design.id ? { ...d, is_public: !d.is_public } : d)))
    })
  }

  const handleCopyLink = () => {
    if (!design) return
    const url = shareUrl(design.id)
    navigator.clipboard?.writeText(url).then(() => setNotice(t('Link copied: {url}', { url })))
      .catch(() => setNotice(url))
  }

  const handleExport = (kind: ExportKind) => {
    if (!character) return
    const base = slug(character.name)
    run(t('Preparing download'), async () => {
      if ((kind === 'png' || kind === 'transparent') && design) {
        const blob = kind === 'png' ? await toBlob(await designCanvas(design), 'image/png') : await transparentPng(design)
        saveBlob(blob, `${base}_${design.id}${kind === 'transparent' ? '_transparent' : ''}.png`)
        await api.logExport(character.id, kind === 'png' ? 'png PNG' : 'transparent PNG', design.id)
      } else if (kind === 'sheet' || kind === 'godot') {
        if (!designs.length) throw new Error(t('Generate at least one design first'))
        saveBlob(kind === 'sheet' ? await spriteSheetZip(character, designs) : await godotZip(character, designs), `${base}_${kind}.zip`)
        await api.logExport(character.id, kind === 'sheet' ? 'sprite sheet' : 'Godot pack')
      }
    })
  }

  const modal = showModal && <CharacterModal onClose={() => setShowModal(false)} onCreate={handleCreate} />

  if (!character) {
    return (
      <>
        <div className="m-auto max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-glow">
            <Sparkles />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {characters.length ? t('Pick a character') : t('Start with a character')}
          </h2>
          <p className="mt-3 text-sm text-violet-300/80">
            {t('Describe someone and add a reference picture if you have one. Then generate outfits, poses and edits that all look like the same person, and export them for your game, comic or animation.')}
          </p>
          <button className="btn-primary mt-6" onClick={() => setShowModal(true)}>{t('Create a character')}</button>
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        {character.reference_url && (
          <img src={fileUrl(character.reference_url)} alt="Reference" className="h-14 w-14 rounded-xl border border-white/10 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold">{character.name}</h2>
          <p className="truncate text-sm text-violet-300/70">{character.style}{character.description && ` · ${character.description}`}</p>
        </div>
        <span className="chip" title={t('Real images come from Cloudflare Workers AI; when the daily allowance is used up, procedural preview art is used')}>
          {ai?.enabled ? (useAi ? t('AI · {n} left today', { n: ai.remaining }) : t('AI limit reached · preview art')) : t('Preview art mode')}
        </span>
      </header>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100" role="status">
          <span>{notice}</span>
          <button className="underline" onClick={() => setNotice(null)}>{t('OK')}</button>
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[1fr_340px]">
        <section className="panel relative min-h-[460px] overflow-hidden">
          {show3D && design ? (
            <Suspense fallback={<Loader2 className="absolute inset-0 m-auto animate-spin text-violet-300" />}>
              <Preview3D design={design} />
            </Suspense>
          ) : (
            <CanvasStage
              imageUrl={design ? fileUrl(design.image_url) : null}
              overlayUrl={selection?.overlayUrl ?? null}
              points={points}
              editMode={editMode}
              pointPositive={pointPositive}
              onAddPoint={handleAddPoint}
            />
          )}
          {!design && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-violet-300/70">
              {t('No designs yet. Use "Generate first design" on the right.')}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:overflow-y-auto">
          <GeneratePanel character={character} hasDesigns={designs.length > 0} onGenerate={handleGenerate} />
          <EditPanel
            design={design}
            editMode={editMode}
            setEditMode={(v) => { setEditMode(v); if (v) setShow3D(false) }}
            pointPositive={pointPositive}
            setPointPositive={setPointPositive}
            selection={selection}
            pointCount={points.length}
            onClear={resetEditing}
            onApply={handleApplyEdit}
          />
          <ExportPanel
            design={design}
            designCount={designs.length}
            show3D={show3D}
            setShow3D={(v) => { setShow3D(v); if (v) resetEditing() }}
            onExport={handleExport}
            onTogglePublish={handleTogglePublish}
            onCopyLink={handleCopyLink}
          />
        </div>
      </div>

      <Gallery designs={designs} selectedId={designId} onSelect={selectDesign} />
      {modal}
    </>
  )
}
