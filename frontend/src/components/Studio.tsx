import { Loader2, Sparkles } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl } from '../lib/api'
import type { Character, Design, Point, SegmentResult } from '../lib/types'
import CanvasStage from './CanvasStage'
import CharacterModal from './CharacterModal'
import Gallery from './Gallery'
import { EditPanel, ExportPanel, GeneratePanel } from './Panels'

const Preview3D = lazy(() => import('./Preview3D')) // three.js only loads when the 3D view is opened

type Props = {
  characters: Character[]
  charId: number | null
  setCharId: (id: number | null) => void
  refresh: () => Promise<Character[]>
  run: Run
  newCharacterSignal: number
}

export default function Studio({ characters, charId, setCharId, refresh, run, newCharacterSignal }: Props) {
  const [designs, setDesigns] = useState<Design[]>([])
  const [designId, setDesignId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [pointPositive, setPointPositive] = useState(true)
  const [points, setPoints] = useState<Point[]>([])
  const [segment, setSegment] = useState<SegmentResult | null>(null)
  const [show3D, setShow3D] = useState(false)
  const segSeq = useRef(0) // ignore out-of-order segment responses when clicking quickly

  const character = characters.find((c) => c.id === charId) ?? null
  const design = designs.find((d) => d.id === designId) ?? null

  useEffect(() => {
    if (newCharacterSignal > 0) setShowModal(true)
  }, [newCharacterSignal])

  const resetEditing = () => {
    segSeq.current++
    setEditMode(false)
    setPoints([])
    setSegment(null)
  }

  useEffect(() => {
    resetEditing()
    setShow3D(false)
    if (charId === null) {
      setDesigns([])
      setDesignId(null)
      return
    }
    run('Loading designs', async () => {
      const list = await api.listDesigns(charId)
      setDesigns(list)
      setDesignId(list.length ? list[list.length - 1].id : null)
    })
  }, [charId, run])

  const selectDesign = (id: number) => {
    resetEditing()
    setDesignId(id)
  }

  const handleCreate = (data: { name: string; description: string; style: string }, file: File | null) => {
    setShowModal(false)
    run('Creating character', async () => {
      let ch = await api.createCharacter(data)
      if (file) ch = await api.uploadReference(ch.id, file)
      await refresh()
      setCharId(ch.id)
    })
  }

  const addDesign = async (d: Design) => {
    setDesigns((prev) => [...prev, d])
    resetEditing()
    setDesignId(d.id)
    await refresh()
  }

  const handleGenerate = (prompt: string, lock: boolean) => {
    if (!character) return
    run('Generating design', async () => addDesign(await api.generate(character.id, prompt, lock)))
  }

  const handleAddPoint = (p: Point) => {
    if (!design) return
    const next = [...points, p]
    setPoints(next)
    const seq = ++segSeq.current
    run('Selecting region', async () => {
      const res = await api.segment(design.id, next)
      if (seq === segSeq.current) setSegment(res)
    })
  }

  const handleApplyEdit = (prompt: string) => {
    if (!design || !segment) return
    run('Applying edit', async () => addDesign(await api.edit(design.id, segment.mask_id, prompt)))
  }

  const handleTogglePublish = () => {
    if (!design) return
    run(design.is_public ? 'Removing from community' : 'Sharing to community', async () => {
      if (design.is_public) await api.unpublish(design.id)
      else await api.publish(design.id)
      setDesigns((prev) => prev.map((d) => (d.id === design.id ? { ...d, is_public: !d.is_public } : d)))
    })
  }

  const handleDownload = (path: string, filename: string) => run('Preparing download', () => api.download(path, filename))

  const modal = showModal && <CharacterModal onClose={() => setShowModal(false)} onCreate={handleCreate} />

  if (!character) {
    return (
      <>
        <div className="m-auto max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-glow">
            <Sparkles />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {characters.length ? 'Pick a character' : 'Start with a character'}
          </h2>
          <p className="mt-3 text-sm text-violet-300/80">
            Describe someone and add a reference picture if you have one. Then generate outfits, poses and edits that
            all look like the same person, and export them for your game, comic or animation.
          </p>
          <button className="btn-primary mt-6" onClick={() => setShowModal(true)}>Create a character</button>
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
      <header className="flex items-center gap-4">
        {character.reference_url && (
          <img src={fileUrl(character.reference_url)} alt="Reference" className="h-14 w-14 rounded-xl border border-white/10 object-cover" />
        )}
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold">{character.name}</h2>
          <p className="truncate text-sm text-violet-300/70">{character.style}{character.description && ` · ${character.description}`}</p>
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[1fr_340px]">
        <section className="panel relative min-h-[460px] overflow-hidden">
          {show3D && design ? (
            <Suspense fallback={<Loader2 className="absolute inset-0 m-auto animate-spin text-violet-300" />}>
              <Preview3D designId={design.id} />
            </Suspense>
          ) : (
            <CanvasStage
              imageUrl={design ? fileUrl(design.image_url) : null}
              overlayUrl={segment ? fileUrl(segment.overlay_url) : null}
              points={points}
              editMode={editMode}
              pointPositive={pointPositive}
              onAddPoint={handleAddPoint}
            />
          )}
          {!design && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-violet-300/70">
              No designs yet. Use "Generate first design" on the right.
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
            segment={segment}
            pointCount={points.length}
            onClear={resetEditing}
            onApply={handleApplyEdit}
          />
          <ExportPanel
            design={design}
            character={character}
            show3D={show3D}
            setShow3D={(v) => { setShow3D(v); if (v) resetEditing() }}
            onDownload={handleDownload}
            onTogglePublish={handleTogglePublish}
          />
        </div>
      </div>

      <Gallery designs={designs} selectedId={designId} onSelect={selectDesign} />
      {modal}
    </>
  )
}
