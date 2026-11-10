import { AlertTriangle, Flag, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Run } from '../App'
import { api, fileUrl } from '../lib/api'
import { timeAgo } from '../lib/format'
import type { ReportItem, SecurityEvent, SecuritySummary } from '../lib/types'
import { useI18n } from '../lib/i18n'

const TONE = { info: 'text-violet-200', warn: 'text-amber-200', alert: 'text-red-300' } as const

/** Admin security console: alerts, 24 h counts and the event log. Data never includes passwords, codes or tokens. */
export default function SecurityView({ run }: { run: Run }) {
  const { t } = useI18n()
  const [summary, setSummary] = useState<SecuritySummary | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [severity, setSeverity] = useState('')
  const [reports, setReports] = useState<ReportItem[]>([])

  const load = useCallback(
    (before: number | null) =>
      run(t('Loading security log'), async () => {
        if (!before) {
          setSummary(await api.securitySummary())
          setReports((await api.reports()).items)
        }
        const page = await api.securityEvents(before, severity || undefined)
        setEvents((prev) => (before ? [...prev, ...page.items] : page.items))
        setNext(page.next_before)
      }),
    [run, severity], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const resolve = (designId: number, action: 'dismiss' | 'remove') =>
    run(t('Saving'), async () => {
      await api.resolveReport(designId, action)
      setReports((prev) => prev.filter((r) => r.design_id !== designId))
    })

  useEffect(() => {
    load(null)
  }, [load])

  return (
    <section className="w-full space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold"><ShieldAlert size={18} /> {t('Security console')}</h2>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel p-4"><div className="text-2xl font-bold">{summary.users.n}</div><div className="text-xs text-violet-300/70">{t('accounts ({n} with MFA)', { n: summary.users.mfa ?? 0 })}</div></div>
          <div className="panel p-4"><div className="text-2xl font-bold">{summary.active_sessions}</div><div className="text-xs text-violet-300/70">{t('active sessions')}</div></div>
          <div className="panel p-4"><div className="text-2xl font-bold text-red-300">{summary.recent_alerts.length}</div><div className="text-xs text-violet-300/70">{t('recent alerts')}</div></div>
        </div>
      )}

      <div className="panel space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Flag size={15} /> {t('Reported designs')} ({reports.length})</h3>
        {reports.length === 0 && <p className="text-xs text-violet-300/60">{t('No open reports.')}</p>}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => (
            <li key={r.design_id} className="flex gap-3 rounded-xl border border-white/10 p-2">
              <img src={fileUrl(r.image_url)} alt="" className="h-28 w-20 shrink-0 rounded-lg bg-[#fff] object-cover" />
              <div className="min-w-0 flex-1 space-y-1 text-xs">
                <div className="truncate text-sm font-medium">{r.character_name}</div>
                <div className="truncate text-violet-300/70">{t('by {author}', { author: r.author })} · #{r.design_id}</div>
                <div className="text-red-200">{t('{n} reports', { n: r.reports })}: {r.reasons}</div>
                {r.notes && <div className="line-clamp-2 text-violet-300/70">{r.notes}</div>}
                <div className="flex gap-1.5 pt-1">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => resolve(r.design_id, 'dismiss')}>{t('Keep')}</button>
                  <button className="btn-ghost px-2 py-1 text-xs text-red-200" onClick={() => resolve(r.design_id, 'remove')}>{t('Remove from gallery')}</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {summary && summary.recent_alerts.length > 0 && (
        <div className="panel space-y-2 border-red-400/30 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-red-200"><AlertTriangle size={15} /> {t('Alerts')}</h3>
          <ul className="space-y-1 text-sm">
            {summary.recent_alerts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3"><span className="font-mono">{a.type}</span><span className="text-xs text-violet-300/60">{timeAgo(a.created_at)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="panel overflow-x-auto p-4">
          <h3 className="mb-2 text-sm font-bold">{t('Last 24 hours')}</h3>
          <table className="w-full text-left text-sm">
            <tbody>
              {summary.last_24h.map((r) => (
                <tr key={`${r.type}-${r.severity}`} className="border-t border-white/5">
                  <td className="py-1 font-mono">{r.type}</td>
                  <td className={TONE[r.severity as keyof typeof TONE]}>{r.severity}</td>
                  <td className="text-right">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel overflow-x-auto p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{t('Event log')}</h3>
          <select className="input w-36" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label={t('Filter by severity')}>
            <option value="">{t('All')}</option>
            <option value="alert">{t('Alerts')}</option>
            <option value="warn">{t('Warnings')}</option>
            <option value="info">{t('Info')}</option>
          </select>
        </div>
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-violet-300/70">
            <tr><th className="py-1">{t('When')}</th><th>{t('Type')}</th><th>{t('Severity')}</th><th>{t('User')}</th><th>{t('IP (hashed)')}</th><th>{t('Path')}</th><th>{t('Detail')}</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-white/5 align-top">
                <td className="py-1 pr-2" title={e.created_at}>{timeAgo(e.created_at)}</td>
                <td className="pr-2 font-mono">{e.type}</td>
                <td className={`pr-2 ${TONE[e.severity]}`}>{e.severity}</td>
                <td className="pr-2">{e.user_id ?? '-'}</td>
                <td className="pr-2 font-mono">{e.ip_hash?.slice(0, 10) ?? '-'}</td>
                <td className="pr-2 font-mono">{e.path}</td>
                <td className="max-w-[16rem] break-all font-mono text-violet-300/80">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {next && <div className="mt-3 text-center"><button className="btn-ghost" onClick={() => load(next)}>{t('Load older')}</button></div>}
      </div>
    </section>
  )
}
