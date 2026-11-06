import qrcode from 'qrcode-generator'
import { Copy, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MfaSetup } from '../lib/types'

/** QR code + manual key for an authenticator app, then a 6-digit confirmation code. */
export function MfaEnrolPanel({ setup, onConfirm }: { setup: MfaSetup; onConfirm: (code: string) => void }) {
  const [code, setCode] = useState('')
  const qr = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(setup.otpauth_uri)
    q.make()
    return q.createDataURL(5, 2)
  }, [setup.otpauth_uri])
  return (
    <div className="space-y-3">
      <p className="text-sm text-violet-200">
        Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password...), then
        enter the 6-digit code it shows.
      </p>
      <img src={qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
      <details className="text-xs text-violet-300/80">
        <summary className="cursor-pointer">Can't scan? Enter this key manually</summary>
        <code className="mt-1 block break-all rounded-lg bg-black/30 p-2 font-mono text-violet-100">{setup.secret}</code>
      </details>
      <CodeInput value={code} onChange={setCode} />
      <button className="btn-primary w-full" disabled={code.length !== 6} onClick={() => onConfirm(code)}>
        <ShieldCheck size={15} /> Turn on two-factor authentication
      </button>
    </div>
  )
}

export function CodeInput({ value, onChange, allowRecovery = false, id = 'mfa-code', autoFocus = true }: { value: string; onChange: (v: string) => void; allowRecovery?: boolean; id?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{allowRecovery ? 'Authentication code (or a recovery code)' : 'Authentication code'}</label>
      <input
        id={id}
        className="input text-center font-mono text-lg tracking-[0.3em]"
        inputMode={allowRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={allowRecovery ? 11 : 6}
        value={value}
        onChange={(e) => onChange(allowRecovery ? e.target.value.trim().toLowerCase() : e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoFocus={autoFocus}
      />
    </div>
  )
}

/** Shown once after MFA is turned on. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-bold">Save your recovery codes</h3>
      <p className="text-sm text-violet-200">
        If you lose your phone, each of these codes lets you log in once. They will not be shown again, so store them
        somewhere safe (a password manager, or printed).
      </p>
      <ul className="grid grid-cols-2 gap-1.5 rounded-xl bg-black/30 p-3 font-mono text-sm text-violet-100">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex gap-2">
        <button
          className="btn-ghost flex-1"
          onClick={() => navigator.clipboard?.writeText(codes.join('\n')).then(() => setCopied(true)).catch(() => setCopied(false))}
        >
          <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="btn-primary flex-1" onClick={onDone}>I saved them</button>
      </div>
    </div>
  )
}
