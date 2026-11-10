import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'

type Props = {
  onConfirm: () => void
  children: ReactNode
  question: string
  className?: string
  label?: string
}

/** Two-step button: first click asks inline, second click confirms. Replaces window.confirm(). */
export default function ConfirmButton({ onConfirm, children, question, className = 'btn-ghost', label }: Props) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = setTimeout(() => setAsking(false), 5000)
    return () => clearTimeout(timer)
  }, [asking])

  if (!asking) {
    return (
      <button
        aria-label={label}
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setAsking(true)
        }}
      >
        {children}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" onClick={(e) => e.stopPropagation()} role="group">
      <span className="text-red-200">{question}</span>
      <button className="rounded-lg bg-red-500/80 px-2 py-1 font-medium text-[#fff] hover:bg-red-500" onClick={() => { setAsking(false); onConfirm() }}>
        {t('Yes')}
      </button>
      <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setAsking(false)}>
        {t('No')}
      </button>
    </span>
  )
}
