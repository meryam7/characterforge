import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import CommunityGallery from './components/CommunityGallery'
import HistoryView from './components/HistoryView'
import Landing, { focusSignUp } from './components/Landing'
import LegalView, { CookieNotice, LEGAL_DOCS } from './components/LegalView'
import SettingsView from './components/SettingsView'
import ShareView from './components/ShareView'
import Sidebar from './components/Sidebar'
import { api, LOGGED_OUT_EVENT, markLoggedIn } from './lib/api'
import { useI18n } from './lib/i18n'
import type { LegalDoc } from './lib/legal'
import type { Character, User } from './lib/types'

// Konva + three.js are heavy: keep them out of the landing page bundle.
const Studio = lazy(() => import('./components/Studio'))
const SecurityView = lazy(() => import('./components/SecurityView'))

export type View = 'studio' | 'history' | 'gallery' | 'settings' | 'security'
export type Run = <T>(label: string, fn: () => Promise<T>) => Promise<T | undefined>

const VIEWS: View[] = ['studio', 'history', 'gallery', 'settings', 'security']
const hashPath = () => window.location.hash.replace(/^#\/?/, '')
const readView = (): View => {
  const v = hashPath() as View
  return VIEWS.includes(v) ? v : 'studio'
}
const readLegal = (): LegalDoc | null => {
  const v = hashPath() as LegalDoc
  return LEGAL_DOCS.includes(v) ? v : null
}
/** /d/<id> share pages (served with social-preview tags by functions/d/[id].ts). */
const readShare = (): number | null => {
  const m = window.location.pathname.match(/^\/d\/(\d{1,12})\/?$/)
  return m ? Number(m[1]) : null
}

export default function App() {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [view, setViewState] = useState<View>(readView)
  const [legal, setLegal] = useState<LegalDoc | null>(readLegal)
  const [shareId, setShareId] = useState<number | null>(readShare)
  const [characters, setCharacters] = useState<Character[]>([])
  const [charId, setCharId] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newCharacterSignal, setNewCharacterSignal] = useState(0)

  // stable across language changes (views reload data when `run` changes); error text is translated when known
  const run: Run = useCallback(async (label, fn) => {
    setBusy(label)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(tRef.current(e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy((cur) => (cur === label ? null : cur))
    }
  }, [])

  /** Leave a /d/<id> share page and go to an app view. */
  const leaveShare = () => {
    if (shareId !== null) {
      window.history.pushState(null, '', '/')
      setShareId(null)
    }
  }

  const setView = (v: View) => {
    leaveShare()
    window.location.hash = `/${v}`
    setViewState(v)
    setLegal(null)
  }

  const resetSession = useCallback(() => {
    markLoggedIn(false)
    setUser(null)
    setCharacters([])
    setCharId(null)
    setNewCharacterSignal(0)
  }, [])

  useEffect(() => {
    const onHash = () => {
      setViewState(readView())
      setLegal(readLegal())
    }
    const onPop = () => {
      setShareId(readShare())
      onHash()
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onPop)
    window.addEventListener(LOGGED_OUT_EVENT, resetSession)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(LOGGED_OUT_EVENT, resetSession)
    }
  }, [resetSession])

  // restore the session from the HttpOnly cookie
  useEffect(() => {
    api.me()
      .then((u) => {
        markLoggedIn(true)
        setUser(u)
      })
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  const refresh = useCallback(async () => {
    const list = await api.listCharacters()
    setCharacters(list)
    return list
  }, [])

  useEffect(() => {
    if (user) run(tRef.current('Loading your characters'), refresh)
  }, [user?.id, run, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAuthed = (u: User) => {
    markLoggedIn(true)
    setError(null)
    setUser(u)
    if (shareId === null) setView('studio')
  }

  const logout = () => run(t('Logging out'), async () => {
    await api.logout().catch(() => undefined)
    resetSession()
  })

  const handleDeleteCharacter = (id: number) =>
    run(t('Deleting'), async () => {
      await api.deleteCharacter(id)
      await refresh()
      if (id === charId) setCharId(null)
    })

  const openCharacter = (id: number) => {
    setCharId(id)
    setView('studio')
  }

  /** "Start from this" created a new character from a community design: open it in the studio. */
  const onRemixed = async (c: Character) => {
    await refresh()
    openCharacter(c.id)
  }

  const goHome = () => {
    leaveShare()
    if (user) setView('studio')
    else {
      window.location.hash = ''
      setLegal(null)
      setTimeout(focusSignUp, 50)
    }
  }

  const galleryActions = { run, user, onRemixed, onNeedLogin: goHome }

  const banner = error && (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <span>{error}</span>
      <button className="text-red-300 underline" onClick={() => setError(null)}>{t('Dismiss')}</button>
    </div>
  )

  const toast = busy && (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-violet-400/30 bg-ink-900/95 px-4 py-3 text-sm shadow-glow" role="status">
      <Loader2 size={16} className="animate-spin text-violet-300" /> {busy}...
    </div>
  )

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-violet-300">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  // pages that work logged in or out
  if (legal) {
    return (
      <>
        <LegalView doc={legal} onBack={() => (window.history.length > 1 ? window.history.back() : goHome())} />
        <CookieNotice />
      </>
    )
  }
  if (shareId !== null) {
    return (
      <>
        {banner && <div className="mx-auto max-w-3xl px-4 pt-4">{banner}</div>}
        <ShareView designId={shareId} onHome={goHome} {...galleryActions} />
        {toast}
        <CookieNotice />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Landing onAuthed={onAuthed} run={run} banner={banner} />
        {toast}
        <CookieNotice />
      </>
    )
  }

  const spinner = <Loader2 className="m-auto animate-spin text-violet-300" />

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <Sidebar
        user={user}
        view={view}
        setView={setView}
        characters={characters}
        selectedId={charId}
        onSelect={openCharacter}
        onNew={() => {
          setView('studio')
          setNewCharacterSignal((n) => n + 1)
        }}
        onDelete={handleDeleteCharacter}
        onLogout={logout}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:overflow-y-auto lg:p-6">
        {banner}
        {view === 'studio' && (
          <Suspense fallback={spinner}>
            <Studio characters={characters} charId={charId} setCharId={setCharId} refresh={refresh} run={run} newCharacterSignal={newCharacterSignal} consumeNewCharacter={() => setNewCharacterSignal(0)} />
          </Suspense>
        )}
        {view === 'history' && <HistoryView run={run} onOpenCharacter={openCharacter} />}
        {view === 'gallery' && <CommunityGallery {...galleryActions} />}
        {view === 'settings' && <SettingsView user={user} setUser={setUser} run={run} onLoggedOut={resetSession} />}
        {view === 'security' && user.is_admin && (
          <Suspense fallback={spinner}>
            <SecurityView run={run} />
          </Suspense>
        )}
      </main>

      {toast}
      <CookieNotice />
    </div>
  )
}
