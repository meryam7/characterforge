/** Character builder: Basics (name, style, notes, reference) then one step per trait section (lib/traits.ts),
 * with a live preview (procedural preview art redrawn on every choice) and "Surprise me". */
import { Check, ChevronLeft, ChevronRight, Dices, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NewCharacter } from '../lib/api'
import { mockCharacter } from '../lib/engine/mock'
import { useI18n } from '../lib/i18n'
import { cleanTraits, GROUPS, randomTraits, SECTIONS, traitsSummary, type Group, type Opt, type Traits } from '../lib/traits'
import { STYLES } from '../lib/types'

type Props = {
  onClose: () => void
  onCreate: (data: NewCharacter, reference: File | null) => void
}

const SWATCH_BG: Record<string, string> = {
  'eyeColor:hetero': 'linear-gradient(90deg, #3d7fd1 50%, #e0b23a 50%)',
  'hairColor:ombre': 'linear-gradient(180deg, #7b46c2, #f19ac0)',
}

/** "3d render" -> "3D render", "anime" -> "Anime" (style keys are lowercase prompt keys). */
const styleName = (s: string) => {
  const x = s.replace(/\b3d\b/i, '3D')
  return x.charAt(0).toUpperCase() + x.slice(1)
}

export default function CharacterModal({ onClose, onCreate }: Props) {
  const { t, lang } = useI18n()
  const [step, setStep] = useState(0) // 0 = basics, then SECTIONS
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState(STYLES[0])
  const [file, setFile] = useState<File | null>(null)
  const [traits, setTraits] = useState<Traits>({})
  const [needName, setNeedName] = useState(false)
  const [seed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff)
  const preview = useRef<HTMLCanvasElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const tr = (x: { en: string; fr: string }) => (lang === 'fr' ? x.fr : x.en)

  const steps = useMemo(() => [{ id: 'basics', label: t('Basics') }, ...SECTIONS.map((s) => ({ id: s.id, label: tr(s) }))], [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const section = steps[step].id
  const chosen = Object.keys(traits).length
  const summary = traitsSummary(traits, lang, 14)

  useEffect(() => {
    const target = preview.current
    if (!target) return
    const art = mockCharacter('', seed, traits)
    const g = target.getContext('2d')
    g?.clearRect(0, 0, target.width, target.height)
    g?.drawImage(art, 0, 0, target.width, target.height)
  }, [traits, seed])

  // Braces matter: newer browsers return a Promise from scrollTo, and React would call it as the effect cleanup (crash).
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [step])

  const pick = (g: Group, o: Opt) =>
    setTraits((prev) => {
      const next = { ...prev }
      if (g.kind === 'multi') {
        const list = Array.isArray(prev[g.id]) ? [...(prev[g.id] as string[])] : []
        const i = list.indexOf(o.id)
        if (i >= 0) list.splice(i, 1)
        else if (list.length < (g.max ?? 4)) list.push(o.id)
        if (list.length) next[g.id] = list
        else delete next[g.id]
      } else if (prev[g.id] === o.id) delete next[g.id] // click again to clear
      else next[g.id] = o.id
      return next
    })

  const submit = () => {
    if (!name.trim()) {
      setNeedName(true)
      setStep(0)
      return
    }
    onCreate({ name, description, style, traits: cleanTraits(traits), seed }, file)
  }

  const basicGroups = GROUPS.filter((g) => g.section === 'basics')
  const styleHints: Record<string, string> = {
    anime: t('Clean lines, bright colours'),
    'pixel art': t('Retro game sprite'),
    'comic book': t('Bold ink and halftones'),
    painterly: t('Digital painting'),
    chibi: t('Cute, big head'),
    'realistic concept art': t('Detailed and lifelike'),
    cartoon: t('Simple shapes, thick outlines'),
    watercolor: t('Soft washes on paper'),
    '3d render': t('Animated-movie 3D look'),
    'low poly': t('Faceted 3D game model'),
    'dark fantasy': t('Gritty and dramatic'),
    storybook: t("Whimsical children's book"),
    'ink sketch': t('Black ink linework'),
    'retro anime': t('90s cel animation'),
  }

  const basics = (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="c-name">{t('Name')}</label>
        <input
          id="c-name"
          className="input"
          value={name}
          onChange={(e) => { setName(e.target.value); setNeedName(false) }}
          placeholder="Mira the Stormcaller"
          maxLength={120}
          autoFocus
        />
        {needName && <p className="mt-1 text-xs text-amber-200">{t('Give your character a name first.')}</p>}
      </div>
      <fieldset>
        <legend className="label mb-2">{t('Art style')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => setStyle(s)}
              className={`rounded-xl border px-3 py-2 text-left transition ${
                style === s ? 'border-violet-300 bg-violet-500/30' : 'border-white/10 bg-white/5 hover:border-violet-400/50'
              }`}
            >
              <span className="block text-sm font-semibold text-white">{styleName(t(s))}</span>
              <span className="block text-[11px] leading-snug text-violet-300/70">{styleHints[s]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {basicGroups.map((g) => <GroupPicker key={g.id} group={g} value={traits[g.id]} onPick={(o) => pick(g, o)} tr={tr} />)}
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
      <div>
        <label className="label" htmlFor="c-desc">{t('Extra details (optional)')}</label>
        <textarea
          id="c-desc"
          className="input min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder={t('Anything the lists do not cover: a scar over the left eye, a silver locket, a star-shaped birthmark...')}
        />
        <p className="mt-1 text-[11px] text-violet-300/50">{t('Tip: prompts in English give the best AI results.')}</p>
      </div>
      <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-sm text-violet-200">
        {t('Next, choose every detail step by step: identity, body, skin, face, hair, outfit and extras. Or press Surprise me.')}
      </div>
      <p className="text-[11px] text-violet-300/50">{t('Only upload images you have the right to use. See the Content Policy.')}</p>
    </div>
  )

  const groups = GROUPS.filter((g) => g.section === section)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 pb-[calc(var(--notice-space,0px)+0.5rem)] backdrop-blur-sm sm:p-4 sm:pb-[calc(var(--notice-space,0px)+1rem)]"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[calc(94vh-var(--notice-space,0px))] w-full max-w-5xl flex-col overflow-hidden bg-ink-900/95 shadow-glow"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div>
            <h2 id="c-title" className="font-display text-lg font-bold">{t('Create your character')}</h2>
            <p className="text-sm text-violet-300/70">{t('Choose every detail, or let us surprise you. Every design will keep this identity.')}</p>
          </div>
          <button aria-label={t('Close')} className="rounded-lg p-1 hover:bg-white/10" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2" aria-label={t('Steps')}>
          {steps.map((s, i) => {
            const count = GROUPS.filter((g) => g.section === s.id && traits[g.id] !== undefined).length
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  i === step ? 'bg-violet-500/30 text-white' : 'text-violet-300 hover:bg-white/5'
                }`}
              >
                <span className="text-xs opacity-60">{i + 1}</span> {s.label}
                {count > 0 && <span className="rounded-full bg-violet-400/30 px-1.5 text-[10px]">{count}</span>}
              </button>
            )
          })}
        </nav>

        <div className="grid min-h-0 flex-1 md:grid-cols-[250px_1fr]">
          <aside className="flex gap-3 border-b border-white/10 p-3 md:flex-col md:border-b-0 md:border-r md:p-4">
            <div className="shrink-0">
              <p className="label mb-1 hidden md:block">{t('Live preview')}</p>
              <canvas
                ref={preview}
                width={256}
                height={384}
                className="h-40 w-auto rounded-xl border border-white/10 bg-[#fff] md:h-auto md:w-full"
                aria-label={t('Live preview')}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setTraits(randomTraits())}>
                  <Dices size={14} /> {t('Surprise me')}
                </button>
                <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" disabled={!chosen} onClick={() => setTraits({})}>
                  <RotateCcw size={14} /> {t('Reset')}
                </button>
              </div>
              <p className="text-xs text-violet-300/70">
                {chosen ? t('{n} details chosen', { n: chosen }) : t('Nothing chosen yet: pick details or press Surprise me.')}
              </p>
              {summary.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {summary.map((s) => (
                    <span key={s} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-violet-200">{s}</span>
                  ))}
                </div>
              )}
              <p className="hidden text-[11px] text-violet-300/50 md:block">{t('Preview art: the AI follows the same choices with real detail.')}</p>
            </div>
          </aside>

          <div ref={body} className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-5">
            {section === 'basics'
              ? basics
              : groups.map((g) => <GroupPicker key={g.id} group={g} value={traits[g.id]} onPick={(o) => pick(g, o)} tr={tr} />)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3 sm:px-5">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft size={16} /> {t('Back')}
          </button>
          <div className="flex gap-2">
            {step < steps.length - 1 && (
              <button type="button" className="btn-ghost" onClick={() => setStep((s) => s + 1)}>
                {t('Next')} <ChevronRight size={16} />
              </button>
            )}
            <button type="button" className="btn-primary" onClick={submit}>
              <Check size={16} /> {t('Create character')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupPicker({ group, value, onPick, tr }: {
  group: Group
  value: string | string[] | undefined
  onPick: (o: Opt) => void
  tr: (x: { en: string; fr: string }) => string
}) {
  const { t } = useI18n()
  const isOn = (o: Opt) => (Array.isArray(value) ? value.includes(o.id) : value === o.id)
  const current = group.options.find((o) => o.id === value)
  return (
    <fieldset>
      <legend className="label mb-2 flex items-baseline gap-2">
        {tr(group)}
        {group.kind === 'multi' && <span className="normal-case text-violet-300/60">{t('up to {n}', { n: group.max ?? 4 })}</span>}
        {group.kind === 'color' && current && <span className="normal-case text-violet-200">· {tr(current)}</span>}
      </legend>
      {group.kind === 'color' ? (
        <div className="flex flex-wrap gap-2">
          {group.options.map((o) => (
            <button
              key={o.id}
              type="button"
              title={tr(o)}
              aria-label={tr(o)}
              aria-pressed={isOn(o)}
              onClick={() => onPick(o)}
              className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${isOn(o) ? 'border-violet-200 ring-2 ring-violet-400' : 'border-white/20'}`}
              style={{ background: SWATCH_BG[`${group.id}:${o.id}`] ?? o.hex }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {group.options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={isOn(o)}
              onClick={() => onPick(o)}
              className={`rounded-lg border px-2.5 py-1 text-sm transition ${
                isOn(o) ? 'border-violet-300 bg-violet-500/30 text-white' : 'border-white/10 bg-white/5 text-violet-200 hover:border-violet-400/50'
              }`}
            >
              {isOn(o) && group.kind === 'multi' && <Check size={12} className="-ml-0.5 mr-1 inline" />}
              {tr(o)}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}
