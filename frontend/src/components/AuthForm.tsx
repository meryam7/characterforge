import { KeyRound, MailCheck, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Run } from '../App'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { LoginResult, MfaSetup, User } from '../lib/types'
import { CodeInput, MfaEnrolPanel, RecoveryCodes } from './Mfa'

type Step =
  | { kind: 'credentials' }
  | { kind: 'mfa'; challenge: string }
  | { kind: 'enrol'; challenge: string; setup: MfaSetup | null }
  | { kind: 'recovery'; codes: string[]; user: User }
  | { kind: 'email'; challenge: string; email: string }
  | { kind: 'forgot' }
  | { kind: 'reset' }

export default function AuthForm({ onAuthed, run }: { onAuthed: (u: User) => void; run: Run }) {
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [terms, setTerms] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [newPassword, setNewPassword] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handle = async (res: LoginResult) => {
    setCode('')
    if (res.status === 'ok') {
      if (res.recovery_codes?.length) setStep({ kind: 'recovery', codes: res.recovery_codes, user: res.user })
      else onAuthed(res.user)
    } else if (res.status === 'mfa_required') {
      setStep({ kind: 'mfa', challenge: res.challenge })
    } else if (res.status === 'verify_email_required') {
      setStep({ kind: 'email', challenge: res.challenge, email: res.email })
      setCooldown(60)
    } else {
      const setup = await api.mfaEnrolStart(res.challenge)
      setStep({ kind: 'enrol', challenge: res.challenge, setup })
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(mode === 'login' ? t('Logging in') : t('Creating your account'), async () => {
      setPassword('')
      await handle(mode === 'login' ? await api.login(email, password, lang) : await api.register(email, password, name, terms, lang))
    })
  }

  const back = () => {
    setStep({ kind: 'credentials' })
    setCode('')
    setInfo(null)
  }

  const shell = (children: React.ReactNode) => (
    <div className="panel w-full space-y-4 bg-ink-900/80 p-6 shadow-glow">{children}</div>
  )

  if (step.kind === 'recovery') {
    return shell(<RecoveryCodes codes={step.codes} onDone={() => onAuthed(step.user)} />)
  }

  if (step.kind === 'email') {
    return shell(
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(t('Checking code'), async () => handle(await api.emailVerify(step.challenge, code, lang)))
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MailCheck size={18} /> {t('Check your email')}</h2>
        <p className="text-sm text-violet-200">
          {t('We sent a 6-digit code to {email}. Enter it to confirm that this email address is yours.', { email: step.email })}
        </p>
        <CodeInput id="email-code" value={code} onChange={setCode} />
        <button type="submit" className="btn-primary w-full" disabled={code.length !== 6}>{t('Confirm my email')}</button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-violet-300 underline disabled:no-underline disabled:opacity-50"
            disabled={cooldown > 0}
            onClick={() => run(t('Sending a new code'), async () => { await api.emailResend(step.challenge, lang); setCooldown(60) })}
          >
            {cooldown > 0 ? t('Send a new code ({n} s)', { n: cooldown }) : t('Send a new code')}
          </button>
          <button type="button" className="text-violet-300 underline" onClick={back}>{t('Back to login')}</button>
        </div>
        <p className="text-[11px] text-violet-300/60">{t("Can't find it? Check your spam folder. The code expires in 15 minutes.")}</p>
      </form>,
    )
  }

  if (step.kind === 'forgot') {
    return shell(
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(t('Sending the code'), async () => {
            await api.forgotPassword(email, lang)
            setInfo(t('If an account exists for this email, we sent it a 6-digit code.'))
            setStep({ kind: 'reset' })
          })
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound size={18} /> {t('Forgot your password?')}</h2>
        <p className="text-sm text-violet-200">{t('Enter your email: we will send you a code to choose a new password.')}</p>
        <div>
          <label className="label" htmlFor="f-email">{t('Email')}</label>
          <input id="f-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
        </div>
        <button type="submit" className="btn-primary w-full">{t('Send me a code')}</button>
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>{t('Back to login')}</button>
      </form>,
    )
  }

  if (step.kind === 'reset') {
    return shell(
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(t('Saving your new password'), async () => {
            await api.resetPassword(email, code, newPassword)
            setNewPassword('')
            setCode('')
            setMode('login')
            setStep({ kind: 'credentials' })
            setInfo(t('Password changed. You can log in now.'))
          })
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound size={18} /> {t('Choose a new password')}</h2>
        {info && <p className="text-sm text-emerald-200" role="status">{info}</p>}
        <CodeInput id="reset-code" value={code} onChange={setCode} />
        <div>
          <label className="label" htmlFor="r-pass">{t('New password (10+ characters)')}</label>
          <input id="r-pass" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} maxLength={128} required autoComplete="new-password" />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={code.length !== 6}>{t('Save new password')}</button>
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>{t('Back to login')}</button>
      </form>,
    )
  }

  if (step.kind === 'mfa') {
    return shell(
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(t('Checking code'), async () => handle(await api.mfaVerify(step.challenge, code)))
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck size={18} /> {t('Two-factor authentication')}</h2>
        <p className="text-sm text-violet-200">{t('Open your authenticator app and enter the current code.')}</p>
        <CodeInput value={code} onChange={setCode} allowRecovery />
        <button type="submit" className="btn-primary w-full" disabled={code.length < 6}>{t('Verify')}</button>
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>{t('Back to login')}</button>
      </form>,
    )
  }

  if (step.kind === 'enrol') {
    return shell(
      <>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck size={18} /> {t('Set up two-factor authentication')}</h2>
        <p className="text-xs text-amber-200">{t('Admin accounts must use two-factor authentication.')}</p>
        {step.setup && (
          <MfaEnrolPanel
            setup={step.setup}
            onConfirm={(c) => run(t('Turning on two-factor authentication'), async () => handle(await api.mfaEnrolFinish(step.challenge, c)))}
          />
        )}
        <button type="button" className="w-full text-xs text-violet-300 underline" onClick={back}>{t('Back to login')}</button>
      </>,
    )
  }

  return (
    <form onSubmit={submit} className="panel w-full space-y-4 bg-ink-900/80 p-6 shadow-glow">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label={t('Account')}>
        {(['register', 'login'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg py-1.5 text-sm font-medium transition ${mode === m ? 'bg-violet-500/30 text-white' : 'text-violet-300/70'}`}
          >
            {m === 'register' ? t('Sign up free') : t('Log in')}
          </button>
        ))}
      </div>

      {mode === 'register' && (
        <div>
          <label className="label" htmlFor="a-name">{t('Display name (shown in the community gallery)')}</label>
          <input id="a-name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoComplete="nickname" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="a-email">{t('Email')}</label>
        <input id="a-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="a-pass">{t('Password')} {mode === 'register' && t('(10+ characters)')}</label>
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
      {info && <p className="text-sm text-emerald-200" role="status">{info}</p>}
      {mode === 'login' && (
        <button type="button" className="text-xs text-violet-300 underline" onClick={() => { setInfo(null); setStep({ kind: 'forgot' }) }}>
          {t('Forgot password?')}
        </button>
      )}
      {mode === 'register' && (
        <label htmlFor="a-terms" className="flex cursor-pointer items-start gap-2 text-xs text-violet-200">
          <input id="a-terms" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required className="mt-0.5 accent-violet-500" />
          <span>
            {t('I accept the')} <a href="#/terms" className="underline">{t('Terms of Use')}</a>, {t('the')}{' '}
            <a href="#/privacy" className="underline">{t('Privacy Policy')}</a> {t('and the')}{' '}
            <a href="#/content-policy" className="underline">{t('Content Policy')}</a>.
          </span>
        </label>
      )}
      <button type="submit" className="btn-primary w-full" disabled={mode === 'register' && !terms}>
        {mode === 'register' ? t('Create account') : t('Log in')}
      </button>
      {mode === 'register' && (
        <p className="text-center text-[11px] text-violet-300/60">
          {t('Your characters are private. Only designs you choose to share appear in the community gallery.')}
        </p>
      )}
    </form>
  )
}
