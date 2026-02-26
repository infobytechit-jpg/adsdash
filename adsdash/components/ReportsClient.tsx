'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reports: any[]
  clients: any[]
  isAdmin: boolean
}

export default function ReportsClient({ reports: initialReports, clients, isAdmin }: Props) {
  const [reports, setReports] = useState(initialReports)
  const [generating, setGenerating] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [genClientId, setGenClientId] = useState(clients[0]?.id || '')
  const [genPeriod, setGenPeriod] = useState<'last_month' | 'last_week' | 'custom'>('last_month')
  const [genStart, setGenStart] = useState('')
  const [genEnd, setGenEnd] = useState('')
  const [scheduleClient, setScheduleClient] = useState(clients[0]?.id || '')
  const [scheduleDay, setScheduleDay] = useState('1')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [previewReport, setPreviewReport] = useState<any | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const router = useRouter()

  const fmt = (n: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  const fmtEur = (n: number) => '€' + fmt(n)

  async function generateReport() {
    if (!genClientId) return
    setGenerating(genClientId)
    setShowGenerate(false)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: genClientId, period: genPeriod, customStart: genStart, customEnd: genEnd }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.report) setReports(prev => [data.report, ...prev])
      if (data.reportData) setPreviewReport(data.reportData)
    } catch (e: any) { alert('Error: ' + e.message) }
    setGenerating(null)
  }

  async function viewReport(r: any) {
    setPreviewLoading(r.id)
    try {
      const res = await fetch('/api/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: r.client_id, start: r.period_start, end: r.period_end }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreviewReport(data.reportData)
    } catch (e: any) { alert('Error: ' + e.message) }
    setPreviewLoading(null)
  }

  async function sendReport(r: any) {
    setSending(r.id)
    try {
      const res = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: r.client_id, periodStart: r.period_start, periodEnd: r.period_end, reportId: r.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: 'sent' } : x))
      alert('✅ Report sent to ' + (r.clients?.name || 'client') + '!')
    } catch (e: any) { alert(e.message) }
    setSending(null)
  }

  async function saveSchedule() {
    setSavingSchedule(true)
    try {
      const res = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: scheduleClient, dayOfMonth: parseInt(scheduleDay) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShowSchedule(false)
      alert('✅ Auto-report scheduled! Reports will generate on day ' + scheduleDay + ' each month.')
    } catch (e: any) { alert('Error: ' + e.message) }
    setSavingSchedule(false)
  }

  const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`@media print { .no-print { display:none!important } body { background:white!important } }`}</style>

      {/* Topbar */}
      <div className="no-print" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Reports</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isAdmin ? 'Generate and send performance reports to clients' : 'Your performance reports'}</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowSchedule(true)}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
              ⏰ Auto-Schedule
            </button>
            <button onClick={() => setShowGenerate(true)} disabled={!!generating}
              style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
              {generating ? '⏳ Generating...' : '＋ Generate Report'}
            </button>
          </div>
        )}
      </div>

      {/* Main content - split layout when preview is open */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '0' }}>

        {/* Report list */}
        <div className="no-print" style={{ width: previewReport ? '360px' : '100%', minWidth: previewReport ? '360px' : undefined, overflowY: 'auto', padding: '24px 28px', borderRight: previewReport ? '1px solid var(--border)' : 'none', transition: 'width 0.2s' }}>

          {isAdmin && reports.length === 0 && (
            <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>No reports yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Generate your first report to preview and send it to a client</div>
              <button onClick={() => setShowGenerate(true)}
                style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                ＋ Generate First Report
              </button>
            </div>
          )}

          {!isAdmin && reports.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>No reports yet</div>
              <div style={{ fontSize: '13px' }}>Your reports will appear here when your admin generates them.</div>
            </div>
          )}

          {reports.map(r => {
            const clientName = r.clients?.name || clients.find((c: any) => c.id === r.client_id)?.name || '—'
            const isPreviewActive = previewReport?.periodStart === r.period_start && previewReport?.clientName === clientName
            return (
              <div key={r.id} style={{ background: isPreviewActive ? 'rgba(0,200,224,0.06)' : 'var(--surface2)', border: `1px solid ${isPreviewActive ? 'rgba(0,200,224,0.3)' : 'var(--border)'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', transition: 'all 0.15s' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📊</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isAdmin ? clientName + ' — ' : ''}{r.report_type}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.period_start} → {r.period_end}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 600, flexShrink: 0,
                  background: r.status === 'sent' ? 'rgba(0,224,158,0.15)' : r.status === 'generated' ? 'rgba(0,200,224,0.15)' : 'rgba(255,197,61,0.15)',
                  color: r.status === 'sent' ? 'var(--green)' : r.status === 'generated' ? 'var(--cyan)' : 'var(--yellow)' }}>
                  {r.status}
                </span>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => viewReport(r)} disabled={previewLoading === r.id}
                    style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: isPreviewActive ? 'rgba(0,200,224,0.2)' : 'transparent', border: '1px solid var(--border)', color: isPreviewActive ? 'var(--cyan)' : 'var(--text-muted)' }}>
                    {previewLoading === r.id ? '⏳' : '👁 View'}
                  </button>
                  {isAdmin && (
                    <button onClick={() => sendReport(r)} disabled={sending === r.id}
                      style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.08)', border: '1px solid rgba(0,200,224,0.25)', color: 'var(--cyan)' }}>
                      {sending === r.id ? '⏳' : '✉ Send'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Preview panel */}
        {previewReport && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--surface3)' }}>
            {/* Print button row */}
            <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => window.print()}
                style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                🖨 Print / Save PDF
              </button>
              <button onClick={() => setPreviewReport(null)}
                style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                ✕ Close
              </button>
            </div>

            {/* The actual report — white card, looks like a real doc */}
            <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', maxWidth: '640px', margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.25)', fontFamily: 'Helvetica Neue, Arial, sans-serif', color: '#1a1a2e' }}>
              {/* Header */}
              <div style={{ background: '#080c0f', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
                    Ads<span style={{ color: '#00C8E0' }}>Dash</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#2a3a45', marginTop: '2px', fontWeight: 600 }}>by 360DigitalU</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: 'rgba(0,200,224,0.15)', color: '#00C8E0', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', letterSpacing: '1px', display: 'inline-block' }}>
                    PERFORMANCE REPORT
                  </div>
                  <div style={{ color: '#5a7080', fontSize: '11px', marginTop: '6px' }}>{previewReport.period}</div>
                </div>
              </div>

              <div style={{ padding: '28px 32px' }}>
                {/* Greeting */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#080c0f', marginBottom: '4px' }}>
                    Hello, {previewReport.clientName}! 👋
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    Ad performance overview · <strong>{previewReport.period}</strong>
                  </div>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
                  {[
                    { label: '💰 Total Spend', value: fmtEur(previewReport.totals.spend), accent: '#00C8E0' },
                    { label: '💎 Conv. Value', value: fmtEur(previewReport.totals.conversion_value), accent: '#a855f7' },
                    { label: '📈 ROAS', value: previewReport.roas + 'x', accent: '#ffc53d' },
                    { label: '✅ Conversions', value: fmt(previewReport.totals.conversions), accent: '#00e09e' },
                    { label: '🎯 Leads', value: fmt(previewReport.totals.leads), accent: '#f97316' },
                    { label: '🖱 Clicks', value: fmt(previewReport.totals.clicks), accent: '#4285F4' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ background: '#f8f9fa', borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${kpi.accent}` }}>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>{kpi.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#080c0f' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Platform breakdown */}
                {(previewReport.google || previewReport.meta) && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '10px' }}>Platform Breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: previewReport.google && previewReport.meta ? '1fr 1fr' : '1fr', gap: '10px' }}>
                      {previewReport.google && (
                        <div style={{ background: '#f0f4ff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #dce8ff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '10px' }}>G</div>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#333' }}>Google Ads</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Spend: <strong>{fmtEur(previewReport.google.spend)}</strong></div>
                          <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Conv. Value: <strong>{fmtEur(previewReport.google.conversion_value)}</strong></div>
                          <div style={{ fontSize: '12px', color: '#555' }}>Conversions: <strong>{fmt(previewReport.google.conversions)}</strong></div>
                        </div>
                      )}
                      {previewReport.meta && (
                        <div style={{ background: '#f0f4ff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #dce8ff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '10px' }}>f</div>
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#333' }}>Meta Ads</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Spend: <strong>{fmtEur(previewReport.meta.spend)}</strong></div>
                          <div style={{ fontSize: '12px', color: '#555', marginBottom: '2px' }}>Conv. Value: <strong>{fmtEur(previewReport.meta.conversion_value)}</strong></div>
                          <div style={{ fontSize: '12px', color: '#555' }}>Conversions: <strong>{fmt(previewReport.meta.conversions)}</strong></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p style={{ color: '#555', fontSize: '13px', lineHeight: '1.6' }}>
                  Log in to your dashboard for the full breakdown by campaign, platform, and date range.
                </p>
              </div>

              {/* Footer */}
              <div style={{ background: '#f8f9fa', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: '11px', color: '#aaa' }}>Generated by AdsDash · {new Date().toLocaleDateString('it-IT')}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>© {new Date().getFullYear()} 360DigitalU</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GENERATE MODAL */}
      {showGenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGenerate(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Generate Report</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Choose client and period</div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client *</label>
              <select value={genClientId} onChange={e => setGenClientId(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Period</label>
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {([['last_month', '📅 Last Month'], ['last_week', '📆 Last Week'], ['custom', '✏️ Custom']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setGenPeriod(v)}
                    style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: genPeriod === v ? 'var(--cyan)' : 'transparent', color: genPeriod === v ? '#080c0f' : 'var(--text-muted)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {genPeriod === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Start</label>
                  <input type="date" value={genStart} onChange={e => setGenStart(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>End</label>
                  <input type="date" value={genEnd} onChange={e => setGenEnd(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(0,200,224,0.06)', border: '1px solid rgba(0,200,224,0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--text-mid)', marginBottom: '20px' }}>
              ℹ️ The report will be generated and shown as a preview. You can then send it via email from the list.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGenerate(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={generateReport} disabled={!!generating || (genPeriod === 'custom' && (!genStart || !genEnd))}
                style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                📊 Generate →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-SCHEDULE MODAL */}
      {showSchedule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSchedule(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>⏰ Auto-Schedule Reports</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Automatically generate & email reports every month</div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client</label>
              <select value={scheduleClient} onChange={e => setScheduleClient(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Send on day of month</label>
              <select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={String(d)}>{ordinal(d)} of each month</option>
                ))}
              </select>
            </div>

            <div style={{ background: 'rgba(255,197,61,0.08)', border: '1px solid rgba(255,197,61,0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--yellow)', marginBottom: '4px' }}>⚠ Email requires Resend setup</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                To send emails automatically, add <code style={{ background: 'var(--surface3)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>RESEND_API_KEY</code> and <code style={{ background: 'var(--surface3)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>RESEND_FROM_EMAIL</code> to Vercel → Settings → Environment Variables. Get a free key at <strong>resend.com</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSchedule(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={saveSchedule} disabled={savingSchedule}
                style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                {savingSchedule ? 'Saving...' : '⏰ Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
