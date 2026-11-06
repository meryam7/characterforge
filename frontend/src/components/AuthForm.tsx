import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { Run } from '../App'
import { api } from '../lib/api'
import type { LoginResult, MfaSetup, User } from '../lib/types'
import { CodeInput, MfaEnrolPanel, RecoveryCodes } from './Mfa'

type Step =
  | { kind: 'credentials' }
  | { kind: 'mfa'; challenge: string }
  | { kind: 'enrol'; challenge: string; setup: MfaSetup | null }
  | { kind: 'recovery'; codes: string[]; user: User }

export default function AuthForm({ onAuthed, run }: { onAuthed: (u: User) => void; run: Run }) {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'credentials' })

  const handle = async (res: LoginResult) => {
    setCode('')
    if (res.status === 'ok') {
      if (res.recovery_codes?.length) setStep({ kind: 'recovery', codes: res.recovery_codes, user: res.user })
      else onAuthed(res.user)
    } else if (res.status === 'mfa_required') {
      setStep({ kind: 'mfa', challenge: res.challenge })
    } else {
      const setup = await api.mfaEnrolStart(res.challenge)
      setStep({ kind: 'enrol', challenge: res.challenge, setup })
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(mode === 'login' ? 'Logging in' : 'Creating your account', async () => {
      setPassword('')
      await handle(mode === 'login' ? await api.login(email, password) : await api.register(email, password, name))
    })
  }

  const back = () => {
    setStep({ kind: 'credentials' })
    setCode('')
  }

  const shell = (children: React.ReactNode) => (
    <div className="panel w-full space-y-4 bg-ink-900/80 p-6 shadow-glow">{children}</div>
  )

  if (step.kind === 'recovery') {
    return shell(<RecoveryCodes codes={step.codes} onDone={() => onAuthed(step.user)} />)
  }

  if (step.kind === 'mfa') {
    return shell(
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run('Checking code', async () => handle(await api.mfaVerify(step.challenge, code)))
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck size={18} /> Two-factor authentication</h2>
        <p className="text-sm text-violet-200">Open your authenticator app and enter the current code.</p>
        <CodeInput value={code} onChange={setCode} allowRecovery />
        <button type="submit" className="btn-primary w-full" disabled={code.length < 6}>Verify</button>
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>Back to login</button>
      </form>,
    )
  }

  if (step.kind === 'enrol') {
    return shell(
      <>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck size={18} /> Set up two-factor authentication</h2>
        <p className="text-xs text-amber-200">Admin accounts must use two-factor authentication.</p>
        {step.setup && (
          <MfaEnrolPanel
            setup={step.setup}
            onConfirm={(c) => run('Turning on two-factor authentication', async () => handle(await api.mfaEnrolFinish(step.challenge, c)))}
          />
        )}
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>Back to login</button>
      </>,
    )
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
        <input id="a-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="a-pass">Password {mode === 'register' && '(10+ characters)'}</label>
        <input
          id="a-pass"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'register' ? 10 : undefined}
          maxLength={128}
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
