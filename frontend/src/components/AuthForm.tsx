import { useState } from 'react'
import type { Run } from '../App'
import { api } from '../lib/api'
import type { User } from '../lib/types'

export default function AuthForm({ onAuthed, run }: { onAuthed: (u: User, token: string) => void; run: Run }) {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(mode === 'login' ? 'Logging in' : 'Creating your account', async () => {
      const res = mode === 'login' ? await api.login(email, password) : await api.register(email, password, name)
      onAuthed(res.user, res.token)
    })
  }

  return (
    <form onSubmit={submit} className="panel w-full space-y-4 bg-ink-900/80 p-6 shadow-glow">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1" role="tablist">
        {(['register', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg py-1.5 text-sm font-medium transition ${mode === m ? 'bg-violet-500/30 text-white' : 'text-violet-300/70'}`}
          >
            {m === 'register' ? 'Sign up free' : 'Log in'}
          </button>
        ))}
      </div>

      {mode === 'register' && (
        <div>
          <label className="label" htmlFor="a-name">Display name (shown in the community gallery)</label>
          <input id="a-name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoComplete="nickname" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="a-email">Email</label>
        <input id="a-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="a-pass">Password {mode === 'register' && '(8+ characters)'}</label>
        <input
          id="a-pass"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'register' ? 8 : undefined}
          required
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />
      </div>
      <button type="submit" className="btn-primary w-full">{mode === 'register' ? 'Create account' : 'Log in'}</button>
      {mode === 'register' && (
        <p className="text-center text-[11px] text-violet-300/60">
          Your characters are private. Only designs you choose to share appear in the community gallery.
        </p>
      )}
    </form>
  )
}
