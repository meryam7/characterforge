import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LanguageSwitch, useI18n } from '../lib/i18n'
import type { PublicDesign } from '../lib/types'
import { DesignCard, type GalleryActions } from './CommunityGallery'
import { LegalLinks } from './LegalView'

/** /d/<id>: public page of one shared design (the server adds social-preview tags for the same URL). */
export default function ShareView({ designId, onHome, ...actions }: GalleryActions & { designId: number; onHome: () => void }) {
  const { t } = useI18n()
  const [design, setDesign] = useState<PublicDesign | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    api.publicDesign(designId).then(setDesign).catch(() => setMissing(true))
  }, [designId, actions.user?.id])

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <button onClick={onHome} className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300 bg-clip-text font-display text-xl font-bold text-transparent">
          CharaForge
        </button>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onHome}>{actions.user ? t('Open the studio') : t('Log in')}</button>
        </div>
      </header>

      {missing && (
        <p className="panel p-8 text-center text-sm text-violet-300/80">{t('This design is not shared anymore, or the link is wrong.')}</p>
      )}
      {design && (
        <div className="grid gap-6 md:grid-cols-[1fr_260px] md:items-start">
          <div className="panel overflow-hidden">
            <DesignCard design={design} onChange={setDesign} large {...actions} />
          </div>
          <aside className="panel space-y-3 p-5">
            <h1 className="font-display text-lg font-bold">{design.character_name}</h1>
            <p className="text-sm text-violet-200/80">{t('Made with CharaForge, the free AI character design studio.')}</p>
            <ul className="space-y-1 text-xs text-violet-300/80">
              <li>• {t('Keep the same character across poses and outfits')}</li>
              <li>• {t('Click any part to repaint it')}</li>
              <li>• {t('Export sprites, sprite sheets and Godot packs')}</li>
            </ul>
            {!actions.user && (
              <button className="btn-primary w-full" onClick={onHome}><Sparkles size={15} /> {t('Create your own for free')}</button>
            )}
          </aside>
        </div>
      )}
      <footer className="mt-auto border-t border-white/10 pt-4"><LegalLinks className="text-xs" /></footer>
    </div>
  )
}
