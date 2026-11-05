import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import CommunityGallery from './components/CommunityGallery'
import HistoryView from './components/HistoryView'
import Landing from './components/Landing'
import Sidebar from './components/Sidebar'

// Konva + three.js are heavy: keep them out of the landing page bundle.
const Studio = lazy(() => import('./components/Studio'))
import { api, auth, LOGGED_OUT_EVENT } from './lib/api'
import type { Character, User } from './lib/types'

export type View = 'studio' | 'history' | 'gallery'
export type Run = <T>(label: string, fn: () => Promise<T>) => Promise<T | undefined>

const readView = (): View => {
  const v = window.location.hash.replace(/^#\/?/, '')
  return v === 'history' || v === 'gallery' ? v : 'studio'
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(auth.token))
  const [view, setViewState] = useState<View>(readView)
  const [characters, setCharacters] = useState<Character[]>([])
  const [charId, setCharId] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newCharacterSignal, setNewCharacterSignal] = useState(0)

  const run: Run = useCallback(async (label, fn) => {
    setBusy(label)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy((cur) => (cur === label ? null : cur))
    }
  }, [])

  const setView = (v: View) => {
    window.location.hash = `/${v}`
    setViewState(v)
  }

  useEffect(() => {
    const onHash = () => setViewState(readView())
    const onLogout = () => {
      setUser(null)
      setCharacters([])
      setCharId(null)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener(LOGGED_OUT_EVENT, onLogout)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener(LOGGED_OUT_EVENT, onLogout)
    }
  }, [])

  // restore session
  useEffect(() => {
    if (!auth.token) return
    api.me().then(setUser).catch(() => auth.set(null)).finally(() => setChecking(false))
  }, [])

  const refresh = useCallback(async () => {
    const list = await api.listCharacters()
    setCharacters(list)
    return list
  }, [])

  useEffect(() => {
    if (user) run('Loading your characters', refresh)
  }, [user, run, refresh])

  const onAuthed = (u: User, token: string) => {
    auth.set(token)
    setError(null)
    setUser(u)
    setView('studio')
  }

  const logout = () => {
    auth.set(null)
    window.dispatchEvent(new Event(LOGGED_OUT_EVENT))
  }

  const deleteAccount = () =>
    run('Deleting account', async () => {
      await api.deleteAccount()
      logout()
    })

  const handleDeleteCharacter = (id: number) =>
    run('Deleting', async () => {
      await api.deleteCharacter(id)
      await refresh()
      if (id === charId) setCharId(null)
    })

  const openCharacter = (id: number) => {
    setCharId(id)
    setView('studio')
  }

  const banner = error && (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <span>{error}</span>
      <button className="text-red-300 underline" onClick={() => setError(null)}>Dismiss</button>
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

  if (!user) {
    return (
      <>
        <Landing onAuthed={onAuthed} run={run} banner={banner} />
        {toast}
      </>
    )
  }

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
        onDeleteAccount={deleteAccount}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:overflow-y-auto lg:p-6">
        {banner}
        {view === 'studio' && (
          <Suspense fallback={<Loader2 className="m-auto animate-spin text-violet-300" />}>
            <Studio
              characters={characters}
              charId={charId}
              setCharId={setCharId}
              refresh={refresh}
              run={run}
              newCharacterSignal={newCharacterSignal}
            />
          </Suspense>
        )}
        {view === 'history' && <HistoryView run={run} onOpenCharacter={openCharacter} />}
        {view === 'gallery' && <CommunityGallery run={run} />}
      </main>

      {toast}
    </div>
  )
}
