import { KeyRound, LogOut, Monitor, Moon, Palette, Settings, ShieldCheck, ShieldOff, Sun, UserX } from 'lucide-react'
import { useState } from 'react'
import type { Run } from '../App'
import { api } from '../lib/api'
import type { MfaSetup, User } from '../lib/types'
import ConfirmButton from './ConfirmButton'
import { CodeInput, MfaEnrolPanel, RecoveryCodes } from './Mfa'
import { LANGS, useI18n } from '../lib/i18n'
import { THEME_MODES, useThemeMode, type ThemeMode } from '../lib/theme'

type Props = { user: User; setUser: (u: User) => void; run: Run; onLoggedOut: () => void; onLogout: () => void }

const THEME_META: Record<ThemeMode, { label: string; icon: typeof Sun }> = {
  dark: { label: 'Dark', icon: Moon },
  light: { label: 'Light', icon: Sun },
  system: { label: 'Same as my device', icon: Monitor },
}

export default function SettingsView({ user, setUser, run, onLoggedOut, onLogout }: Props) {
  const { t, lang, setLang } = useI18n()
  const [theme, setTheme] = useThemeMode()
  const [setup, setSetup] = useState<MfaSetup | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [disablePw, setDisablePw] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [delPw, setDelPw] = useState('')
  const [delCode, setDelCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const done = (m: string) => setMessage(m)

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Settings size={18} /> {t('Settings')}</h2>
      {message && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{message}</p>}

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div className="space-y-1">
          <div><span className="text-violet-300/70">{t('Name')}:</span> {user.display_name}</div>
          <div><span className="text-violet-300/70">{t('Email')}:</span> {user.email}</div>
          <div><span className="text-violet-300/70">{t('Role')}:</span> {user.is_admin ? t('Administrator') : t('Creator')}</div>
        </div>
        <button className="btn-ghost" onClick={onLogout}>
          <LogOut size={15} /> {t('Log out')}
        </button>
      </div>

      <div className="panel space-y-4 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Palette size={15} /> {t('Appearance')}</h3>
        <fieldset>
          <legend className="label">{t('Theme')}</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {THEME_MODES.map((m) => {
              const { label, icon: Icon } = THEME_META[m]
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={theme === m}
                  onClick={() => setTheme(m)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    theme === m ? 'border-violet-400 bg-violet-500/20 font-medium' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} /> {t(label)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">{t('Language')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:w-1/2" role="radiogroup">
            {LANGS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={lang === l.id}
                onClick={() => setLang(l.id)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  lang === l.id ? 'border-violet-400 bg-violet-500/20 font-medium' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                {l.id === 'en' ? 'English' : 'Français'}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="panel space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold"><ShieldCheck size={15} /> {t('Two-factor authentication')}</h3>
        {codes ? (
          <RecoveryCodes codes={codes} onDone={() => { setCodes(null); done(t('Two-factor authentication is on.')) }} />
        ) : user.mfa_enabled ? (
          <>
            <p className="text-sm text-emerald-200">{t('On. You\'ll be asked for a code from your authenticator app at every login.')}</p>
            {user.is_admin ? (
              <p className="text-xs text-violet-300/70">{t('Admin accounts can\'t turn it off.')}</p>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(t('Turning off two-factor authentication'), async () => {
                    await api.mfaDisable(disablePw, disableCode)
                    setUser({ ...user, mfa_enabled: false, mfa_verified: false })
                    setDisablePw('')
                    setDisableCode('')
                    done(t('Two-factor authentication is off.'))
                  })
                }}
              >
                <label className="label" htmlFor="mfa-off-password">{t('Password')}</label>
                <input id="mfa-off-password" type="password" className="input" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} autoComplete="current-password" required />
                <CodeInput id="mfa-off-code" value={disableCode} onChange={setDisableCode} allowRecovery autoFocus={false} />
                <button type="submit" className="btn-ghost w-full text-red-200"><ShieldOff size={14} /> {t('Turn off')}</button>
              </form>
            )}
          </>
        ) : setup ? (
          <MfaEnrolPanel
            setup={setup}
            onConfirm={(code) => run(t('Turning on two-factor authentication'), async () => {
              const res = await api.mfaEnable(code)
              setSetup(null)
              setUser(res.user)
              setCodes(res.recovery_codes)
            })}
          />
        ) : (
          <>
            <p className="text-sm text-violet-200">{t('Protect your account with a code from your phone in addition to your password.')}</p>
            <button className="btn-primary" onClick={() => run(t('Preparing'), async () => setSetup(await api.mfaSetup()))}>{t('Set up')}</button>
          </>
        )}
      </div>

      <form
        className="panel space-y-2 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(t('Changing password'), async () => {
            await api.changePassword(cur, next)
            setCur('')
            setNext('')
            done(t('Password changed. Other devices were signed out.'))
          })
        }}
      >
        <h3 className="flex items-center gap-2 font-display text-sm font-bold"><KeyRound size={15} /> {t('Change password')}</h3>
        <input aria-label={t('Current password')} type="password" className="input" placeholder={t('Current password')} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
        <input aria-label={t('New password')} type="password" className="input" placeholder={t('New password (10+ characters)')} value={next} onChange={(e) => setNext(e.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required />
        <button type="submit" className="btn-ghost">{t('Change password')}</button>
      </form>

      <div className="panel space-y-2 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold"><LogOut size={15} /> {t('Sessions')}</h3>
        <p className="text-sm text-violet-200">{t('Lost a device or used a shared computer? Sign out everywhere except here.')}</p>
        <button className="btn-ghost" onClick={() => run(t('Signing out other devices'), async () => { await api.revokeOtherSessions(); done(t('All other devices were signed out.')) })}>
          {t('Sign out other devices')}
        </button>
      </div>

      <div className="panel space-y-2 border-red-400/20 p-4">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-red-200"><UserX size={15} /> {t('Delete account')}</h3>
        <p className="text-sm text-violet-200">{t('Permanently deletes your characters, designs, history and shared posts.')}</p>
        <label className="label" htmlFor="delete-password">{t('Password')}</label>
        <input id="delete-password" type="password" className="input" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
        {user.mfa_enabled && <CodeInput id="delete-code" value={delCode} onChange={setDelCode} allowRecovery autoFocus={false} />}
        <ConfirmButton
          question={t('Delete everything permanently?')}
          className="btn-ghost text-red-200"
          onConfirm={() => run(t('Deleting account'), async () => { await api.deleteAccount(delPw, delCode || undefined); onLoggedOut() })}
        >
          <UserX size={14} /> {t('Delete my account')}
        </ConfirmButton>
      </div>
    </section>
  )
}
