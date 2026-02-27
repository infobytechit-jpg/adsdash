'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  reports: any[]
  clients: any[]
  isAdmin: boolean
}

const S = {
  surface: '#0e1419', surface2: '#121a21', surface3: '#1a2530',
  border: '#1f2d38', cyan: '#00C8E0', text: '#e8f0f5',
  textMid: '#8ba0ae', textMuted: '#5a7080', black: '#080c0f',
  green: '#00e09e', red: '#ff4d6a', yellow: '#ffc53d', purple: '#a855f7',
}

const METRICS = [
  { key: 'spend', label: 'Spend', fmt: 'eur' },
  { key: 'conversion_value', label: 'Conv. Value', fmt: 'eur' },
  { key: 'roas', label: 'ROAS', fmt: 'x' },
  { key: 'conversions', label: 'Conversions', fmt: 'num' },
  { key: 'leads', label: 'Leads', fmt: 'num' },
  { key: 'clicks', label: 'Clicks', fmt: 'num' },
  { key: 'impressions', label: 'Impressions', fmt: 'num' },
]

function fmt(n: number, type: string) {
  const f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: type === 'x' ? 2 : 0 }).format(n)
  if (type === 'eur') return '€' + f
  if (type === 'x') return f + 'x'
  return f
}

function Modal({ title, onClose, children, width = 560 }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: S.surface, border: `1px solid ${S.border}`, borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

function Label({ children }: any) {
  return <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: S.textMuted, marginBottom: '8px' }}>{children}</div>
}

function Select({ value, onChange, children, style = {} }: any) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: S.surface3, border: `1px solid ${S.border}`, color: S.text, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', ...style }}>
      {children}
    </select>
  )
}

function Checkbox({ checked, onChange, label }: any) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: S.text, padding: '6px 0' }}>
      <div onClick={() => onChange(!checked)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${checked ? S.cyan : S.border}`, background: checked ? S.cyan : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#080c0f" strokeWidth="2" strokeLinecap="round"/></svg>}
      </div>
      {label}
    </label>
  )
}

export default function ReportsClient({ reports: initialReports, clients: initialClients, isAdmin }: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'reports' | 'schedule'>('reports')
  const [reports, setReports] = useState(initialReports)
  const [clients, setClients] = useState(initialClients)
  const [dataLoading, setDataLoading] = useState(initialClients.length === 0)

  // Report builder state
  const [showBuilder, setShowBuilder] = useState(false)
  const [builderStep, setBuilderStep] = useState<'config' | 'preview'>('config')

  // Builder config
  const [selAccounts, setSelAccounts] = useState<string[]>([])
  const [selMetrics, setSelMetrics] = useState<string[]>(['spend', 'conversions', 'roas', 'leads'])
  const [selPlatform, setSelPlatform] = useState('all')
  const [periodType, setPeriodType] = useState<'today' | 'week' | 'month' | 'custom'>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selClientId, setSelClientId] = useState('')
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([])
  const [reportData, setReportData] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  // Schedule state
  const [schedules, setSchedules] = useState<any[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedClientId, setSchedClientId] = useState('')
  const [schedAccounts, setSchedAccounts] = useState<string[]>([])
  const [schedMetrics, setSchedMetrics] = useState<string[]>(['spend', 'conversions', 'roas', 'leads'])
  const [schedPlatform, setSchedPlatform] = useState('all')
  const [schedFreq, setSchedFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [schedDay, setSchedDay] = useState('1') // weekday 1-7 or month day 1-28
  const [schedHour, setSchedHour] = useState('09')
  const [schedEmail, setSchedEmail] = useState('')
  const [schedPeriod, setSchedPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [savingSched, setSavingSched] = useState(false)
  const [schedAccAvail, setSchedAccAvail] = useState<string[]>([])

  // Load data client-side if server returned empty
  useEffect(() => {
    if (initialClients.length > 0) { setDataLoading(false); return }
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setDataLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      const admin = p?.role === 'admin'
      if (admin) {
        const { data: c } = await supabase.from('clients').select('id,name,email').order('name')
        setClients(c || [])
        if (c?.[0]) setSelClientId(c[0].id)
      } else {
        const { data: c } = await supabase.from('clients').select('id,name').eq('user_id', session.user.id).single()
        if (c) { setClients([c]); setSelClientId(c.id) }
      }
      const { data: r } = await supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false })
      setReports(r || [])
      // Load schedules
      const { data: s } = await supabase.from('report_schedules').select('*, clients(name)').order('created_at', { ascending: false })
      setSchedules(s || [])
      setDataLoading(false)
    }
    load()
  }, [])

  // When client selected, load their accounts
  useEffect(() => {
    if (!selClientId) return
    supabase.from('metrics_cache').select('account_name').eq('client_id', selClientId).not('account_name','is',null)
      .then(({ data }) => {
        const accs = Array.from(new Set((data||[]).map((d:any) => d.account_name).filter(Boolean))) as string[]
        setAvailableAccounts(accs)
        setSelAccounts(accs) // select all by default
      })
  }, [selClientId])

  useEffect(() => {
    if (!schedClientId) return
    supabase.from('metrics_cache').select('account_name').eq('client_id', schedClientId).not('account_name','is',null)
      .then(({ data }) => {
        const accs = Array.from(new Set((data||[]).map((d:any) => d.account_name).filter(Boolean))) as string[]
        setSchedAccAvail(accs)
        setSchedAccounts(accs)
      })
  }, [schedClientId])

  // Init client selection
  useEffect(() => {
    if (clients.length > 0 && !selClientId) {
      setSelClientId(clients[0].id)
      setSchedClientId(clients[0].id)
      setSchedEmail(clients[0].email || '')
    }
  }, [clients])

  function getDateRange() {
    const end = new Date()
    const start = new Date()
    if (periodType === 'today') start.setHours(0,0,0,0)
    else if (periodType === 'week') start.setDate(start.getDate() - 7)
    else if (periodType === 'month') start.setDate(1)
    else return { start: customStart, end: customEnd }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }

  async function generateReport() {
    if (!selClientId || selAccounts.length === 0 || selMetrics.length === 0) return
    setGenerating(true)
    const { start, end } = getDateRange()

    let q = supabase.from('metrics_cache').select('*').eq('client_id', selClientId).gte('date', start).lte('date', end)
    if (selPlatform !== 'all') q = q.eq('platform', selPlatform)
    const { data: metrics } = await q

    const filtered = (metrics || []).filter((m:any) => selAccounts.includes(m.account_name) || selAccounts.length === 0)

    // Aggregate
    const totals: any = { spend: 0, conversion_value: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0 }
    const byDate: Record<string, any> = {}
    const byPlatform: Record<string, any> = {}

    filtered.forEach((m:any) => {
      totals.spend += Number(m.spend||0)
      totals.conversion_value += Number(m.conversion_value||0)
      totals.conversions += Number(m.conversions||0)
      totals.leads += Number(m.leads||0)
      totals.clicks += Number(m.clicks||0)
      totals.impressions += Number(m.impressions||0)

      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0, conversions: 0 }
      byDate[m.date].spend += Number(m.spend||0)
      byDate[m.date].conversions += Number(m.conversions||0)

      const p = m.platform
      if (!byPlatform[p]) byPlatform[p] = { spend: 0, conversion_value: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0 }
      byPlatform[p].spend += Number(m.spend||0)
      byPlatform[p].conversion_value += Number(m.conversion_value||0)
      byPlatform[p].conversions += Number(m.conversions||0)
      byPlatform[p].leads += Number(m.leads||0)
      byPlatform[p].clicks += Number(m.clicks||0)
      byPlatform[p].impressions += Number(m.impressions||0)
    })

    totals.roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0

    const client = clients.find(c => c.id === selClientId)
    const data = {
      client, totals, byDate: Object.values(byDate).sort((a:any,b:any) => a.date.localeCompare(b.date)),
      byPlatform, selMetrics, selAccounts, selPlatform, period: periodType, start, end,
      generatedAt: new Date().toISOString(),
    }

    // Save to DB
    await supabase.from('reports').insert({
      client_id: selClientId, report_type: 'custom',
      period_start: start, period_end: end,
      status: 'generated',
      report_data: data,
    })

    const { data: r } = await supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false })
    setReports(r || [])
    setReportData(data)
    setBuilderStep('preview')
    setGenerating(false)
  }

  async function deleteSchedule(id: string) {
    await supabase.from('report_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function saveSchedule() {
    if (!schedClientId || !schedEmail) return
    setSavingSched(true)
    const client = clients.find(c => c.id === schedClientId)
    const { data } = await supabase.from('report_schedules').insert({
      client_id: schedClientId,
      client_name: client?.name,
      accounts: schedAccounts,
      metrics: schedMetrics,
      platform: schedPlatform,
      frequency: schedFreq,
      day: schedDay,
      hour: schedHour,
      recipient_email: schedEmail,
      report_period: schedPeriod,
      active: true,
    }).select()
    if (data?.[0]) setSchedules(prev => [...prev, { ...data[0], clients: { name: client?.name } }])
    setSavingSched(false)
    setShowScheduleModal(false)
  }

  async function exportExcel() {
    if (!reportData) return
    const rows: any[][] = []
    const client = reportData.client
    rows.push([`Report: ${client?.name}`])
    rows.push([`Period: ${reportData.start} → ${reportData.end}`])
    rows.push([`Generated: ${new Date(reportData.generatedAt).toLocaleString('it-IT')}`])
    rows.push([])
    rows.push(['SUMMARY'])
    const headers = ['Metric', 'Value']
    rows.push(headers)
    METRICS.filter(m => reportData.selMetrics.includes(m.key)).forEach(m => {
      const val = m.key === 'roas' ? reportData.totals.roas : reportData.totals[m.key]
      rows.push([m.label, fmt(val, m.fmt)])
    })
    rows.push([])
    rows.push(['PLATFORM BREAKDOWN'])
    rows.push(['Platform', ...METRICS.filter(m => reportData.selMetrics.includes(m.key)).map(m => m.label)])
    Object.entries(reportData.byPlatform).forEach(([plat, data]: any) => {
      rows.push([plat, ...METRICS.filter(m => reportData.selMetrics.includes(m.key)).map(m => {
        const val = m.key === 'roas' ? (data.spend > 0 ? data.conversion_value / data.spend : 0) : data[m.key]
        return fmt(val, m.fmt)
      })])
    })
    rows.push([])
    rows.push(['DAILY DATA'])
    rows.push(['Date', 'Spend', 'Conversions'])
    reportData.byDate.forEach((d:any) => rows.push([d.date, fmt(d.spend, 'eur'), fmt(d.conversions, 'num')]))

    // Build CSV and trigger download (Excel-compatible)
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${client?.name}-report-${reportData.start}-${reportData.end}.csv`
    a.click()
  }

  function exportPDF() {
    window.print()
  }

  const tabs = isAdmin
    ? [{ key: 'reports', label: '📊 Reports' }, { key: 'schedule', label: '⏰ Scheduled' }]
    : [{ key: 'reports', label: '📊 Reports' }]

  if (dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}' }} />
      <div style={{ display: 'flex', gap: '8px' }}><div className="ld"/><div className="ld"/><div className="ld"/></div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `@media print { .no-print { display: none !important; } .print-area { position: fixed !important; inset: 0 !important; z-index: 9999 !important; background: white !important; overflow: auto !important; } }` }} />

      {/* Header */}
      <div className="no-print" style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Reports</div>
          <div style={{ fontSize: '12px', color: S.textMuted }}>Generate, view and export performance reports</div>
        </div>
        <button onClick={() => { setBuilderStep('config'); setReportData(null); setShowBuilder(true) }}
          style={{ background: S.cyan, color: S.black, border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
          + New Report
        </button>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="no-print" style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 28px', display: 'flex', gap: '4px', flexShrink: 0 }}>
          {tabs.map((t: any) => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === t.key ? 700 : 400, color: activeTab === t.key ? S.cyan : S.textMuted, borderBottom: `2px solid ${activeTab === t.key ? S.cyan : 'transparent'}`, transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="no-print" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <>
            {reports.length === 0 ? (
              <div style={{ background: S.surface2, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No reports yet</div>
                <div style={{ color: S.textMuted, fontSize: '14px', marginBottom: '24px' }}>Create your first report to get started</div>
                <button onClick={() => { setBuilderStep('config'); setReportData(null); setShowBuilder(true) }}
                  style={{ background: S.cyan, color: S.black, border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  + New Report
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.map((r: any) => (
                  <div key={r.id} style={{ background: S.surface2, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,200,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📊</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{r.clients?.name || 'Report'}</div>
                      <div style={{ fontSize: '12px', color: S.textMuted }}>
                        {r.period_start} → {r.period_end} · {new Date(r.created_at).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: r.status === 'sent' ? 'rgba(0,224,158,0.15)' : 'rgba(0,200,224,0.1)', color: r.status === 'sent' ? S.green : S.cyan }}>
                      {r.status}
                    </span>
                    {r.report_data && (
                      <button onClick={() => { setReportData(r.report_data); setBuilderStep('preview'); setShowBuilder(true) }}
                        style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${S.border}`, color: S.textMid }}>
                        View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && isAdmin && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => setShowScheduleModal(true)}
                style={{ background: S.cyan, color: S.black, border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                + Add Schedule
              </button>
            </div>

            {schedules.length === 0 ? (
              <div style={{ background: S.surface2, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No scheduled reports</div>
                <div style={{ color: S.textMuted, fontSize: '14px' }}>Schedule automatic report delivery to clients</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {schedules.map((s: any) => (
                  <div key={s.id} style={{ background: S.surface2, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>⏰</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{s.clients?.name || s.client_name}</div>
                      <div style={{ fontSize: '12px', color: S.textMuted }}>
                        {s.frequency === 'daily' ? `Daily at ${s.hour}:00` : s.frequency === 'weekly' ? `Every week on day ${s.day} at ${s.hour}:00` : `Monthly on day ${s.day} at ${s.hour}:00`}
                        {' · '}{s.recipient_email}
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: s.active ? 'rgba(0,224,158,0.15)' : 'rgba(90,112,128,0.15)', color: s.active ? S.green : S.textMuted }}>
                      {s.active ? 'Active' : 'Paused'}
                    </span>
                    <button onClick={() => deleteSchedule(s.id)}
                      style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid rgba(255,77,106,0.3)`, color: S.red }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* REPORT BUILDER MODAL */}
      {showBuilder && (
        <Modal title={builderStep === 'config' ? 'New Report' : 'Report Preview'} onClose={() => setShowBuilder(false)} width={builderStep === 'preview' ? 800 : 600}>
          {builderStep === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {isAdmin && (
                <div>
                  <Label>Client</Label>
                  <Select value={selClientId} onChange={setSelClientId}>
                    {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              )}

              <div>
                <Label>Time Period</Label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[['today','Today'],['week','Last 7 days'],['month','This month'],['custom','Custom']].map(([v,l]) => (
                    <button key={v} onClick={() => setPeriodType(v as any)}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${periodType === v ? S.cyan : S.border}`, background: periodType === v ? 'rgba(0,200,224,0.1)' : S.surface3, color: periodType === v ? S.cyan : S.textMuted }}>
                      {l}
                    </button>
                  ))}
                </div>
                {periodType === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div>
                      <Label>From</Label>
                      <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                        style={{ width: '100%', background: S.surface3, border: `1px solid ${S.border}`, color: S.text, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}/>
                    </div>
                    <div>
                      <Label>To</Label>
                      <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                        style={{ width: '100%', background: S.surface3, border: `1px solid ${S.border}`, color: S.text, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }}/>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Platform</Label>
                <Select value={selPlatform} onChange={setSelPlatform}>
                  <option value="all">All Platforms</option>
                  <option value="google">Google Ads</option>
                  <option value="meta">Meta Ads</option>
                </Select>
              </div>

              {availableAccounts.length > 0 && (
                <div>
                  <Label>Accounts</Label>
                  <div style={{ background: S.surface3, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '4px 12px' }}>
                    <Checkbox checked={selAccounts.length === availableAccounts.length} onChange={(v:boolean) => setSelAccounts(v ? [...availableAccounts] : [])} label="All accounts" />
                    {availableAccounts.map(acc => (
                      <Checkbox key={acc} checked={selAccounts.includes(acc)}
                        onChange={(v:boolean) => setSelAccounts(prev => v ? [...prev, acc] : prev.filter(a => a !== acc))}
                        label={acc} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Metrics to Include</Label>
                <div style={{ background: S.surface3, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '4px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {METRICS.map(m => (
                    <Checkbox key={m.key} checked={selMetrics.includes(m.key)}
                      onChange={(v:boolean) => setSelMetrics(prev => v ? [...prev, m.key] : prev.filter(k => k !== m.key))}
                      label={m.label} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button onClick={() => setShowBuilder(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${S.border}`, color: S.textMid }}>
                  Cancel
                </button>
                <button onClick={generateReport} disabled={generating || selMetrics.length === 0}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: S.cyan, color: S.black, border: 'none', opacity: generating ? 0.7 : 1, fontFamily: 'Syne, sans-serif' }}>
                  {generating ? 'Generating...' : 'Generate Report →'}
                </button>
              </div>
            </div>
          )}

          {builderStep === 'preview' && reportData && (
            <div>
              {/* Export buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setBuilderStep('config'); setReportData(null) }}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${S.border}`, color: S.textMid }}>
                  ← Edit
                </button>
                <button onClick={exportExcel}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,224,158,0.1)', border: `1px solid rgba(0,224,158,0.3)`, color: S.green }}>
                  ⬇ Export Excel
                </button>
                <button onClick={exportPDF}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: `1px solid rgba(0,200,224,0.3)`, color: S.cyan }}>
                  🖨 Print / PDF
                </button>
              </div>

              {/* Report preview */}
              <div className="print-area" style={{ background: 'white', borderRadius: '12px', padding: '32px', color: '#1a1a2e' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #00C8E0' }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, color: '#080c0f' }}>
                      Ads<span style={{ color: '#00C8E0' }}>Dash</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#5a7080', fontWeight: 500 }}>by 360DigitalU</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#080c0f' }}>{reportData.client?.name}</div>
                    <div style={{ fontSize: '12px', color: '#5a7080', marginTop: '2px' }}>
                      {reportData.start} → {reportData.end}
                    </div>
                  </div>
                </div>

                {/* KPI grid */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#5a7080', marginBottom: '12px' }}>Performance Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {METRICS.filter(m => reportData.selMetrics.includes(m.key)).map(m => {
                      const val = m.key === 'roas' ? reportData.totals.roas : reportData.totals[m.key]
                      return (
                        <div key={m.key} style={{ background: '#f8fafb', borderRadius: '10px', padding: '16px', borderLeft: '3px solid #00C8E0' }}>
                          <div style={{ fontSize: '11px', color: '#5a7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{m.label}</div>
                          <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#080c0f' }}>{fmt(val, m.fmt)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Platform breakdown */}
                {Object.keys(reportData.byPlatform).length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#5a7080', marginBottom: '12px' }}>Platform Breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(reportData.byPlatform).length}, 1fr)`, gap: '12px' }}>
                      {Object.entries(reportData.byPlatform).map(([plat, data]: any) => (
                        <div key={plat} style={{ background: '#f8fafb', borderRadius: '10px', padding: '16px', borderLeft: `3px solid ${plat === 'google' ? '#4285F4' : '#1877F2'}` }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: plat === 'google' ? '#4285F4' : '#1877F2' }}>
                            {plat === 'google' ? 'Google Ads' : 'Meta Ads'}
                          </div>
                          {METRICS.filter(m => reportData.selMetrics.includes(m.key)).map(m => {
                            const val = m.key === 'roas' ? (data.spend > 0 ? data.conversion_value / data.spend : 0) : data[m.key]
                            return (
                              <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: '1px solid #eef0f2' }}>
                                <span style={{ color: '#5a7080' }}>{m.label}</span>
                                <span style={{ fontWeight: 600, color: '#080c0f' }}>{fmt(val, m.fmt)}</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily table */}
                {reportData.byDate.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#5a7080', marginBottom: '12px' }}>Daily Breakdown</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f0f2f5' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#5a7080' }}>Date</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#5a7080' }}>Spend</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#5a7080' }}>Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.byDate.map((d:any) => (
                          <tr key={d.date} style={{ borderBottom: '1px solid #eef0f2' }}>
                            <td style={{ padding: '8px 12px', color: '#080c0f' }}>{d.date}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#080c0f' }}>{fmt(d.spend, 'eur')}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#080c0f' }}>{fmt(d.conversions, 'num')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #eef0f2', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8ba0ae' }}>
                  <span>Generated by AdsDash · 360DigitalU</span>
                  <span>{new Date(reportData.generatedAt).toLocaleString('it-IT')}</span>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <Modal title="New Scheduled Report" onClose={() => setShowScheduleModal(false)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <Label>Client</Label>
              <Select value={schedClientId} onChange={(v:string) => { setSchedClientId(v); setSchedEmail(clients.find((c:any) => c.id === v)?.email || '') }}>
                {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            <div>
              <Label>Report Period</Label>
              <Select value={schedPeriod} onChange={setSchedPeriod}>
                <option value="day">Previous day</option>
                <option value="week">Previous 7 days</option>
                <option value="month">Previous month</option>
              </Select>
            </div>

            <div>
              <Label>Platform</Label>
              <Select value={schedPlatform} onChange={setSchedPlatform}>
                <option value="all">All Platforms</option>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </Select>
            </div>

            {schedAccAvail.length > 0 && (
              <div>
                <Label>Accounts</Label>
                <div style={{ background: S.surface3, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '4px 12px' }}>
                  <Checkbox checked={schedAccounts.length === schedAccAvail.length} onChange={(v:boolean) => setSchedAccounts(v ? [...schedAccAvail] : [])} label="All accounts" />
                  {schedAccAvail.map((acc:string) => (
                    <Checkbox key={acc} checked={schedAccounts.includes(acc)}
                      onChange={(v:boolean) => setSchedAccounts(prev => v ? [...prev, acc] : prev.filter((a:string) => a !== acc))}
                      label={acc} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Metrics</Label>
              <div style={{ background: S.surface3, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '4px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                {METRICS.map(m => (
                  <Checkbox key={m.key} checked={schedMetrics.includes(m.key)}
                    onChange={(v:boolean) => setSchedMetrics(prev => v ? [...prev, m.key] : prev.filter(k => k !== m.key))}
                    label={m.label} />
                ))}
              </div>
            </div>

            <div>
              <Label>Frequency</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']].map(([v,l]) => (
                  <button key={v} onClick={() => setSchedFreq(v as any)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${schedFreq === v ? S.cyan : S.border}`, background: schedFreq === v ? 'rgba(0,200,224,0.1)' : S.surface3, color: schedFreq === v ? S.cyan : S.textMuted }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: schedFreq === 'daily' ? '1fr' : '1fr 1fr', gap: '12px' }}>
              {schedFreq !== 'daily' && (
                <div>
                  <Label>{schedFreq === 'weekly' ? 'Day of Week' : 'Day of Month'}</Label>
                  <Select value={schedDay} onChange={setSchedDay}>
                    {schedFreq === 'weekly'
                      ? [['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday'],['6','Saturday'],['7','Sunday']].map(([v,l]) => <option key={v} value={v}>{l}</option>)
                      : Array.from({length: 28}, (_,i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)
                    }
                  </Select>
                </div>
              )}
              <div>
                <Label>Time</Label>
                <Select value={schedHour} onChange={setSchedHour}>
                  {Array.from({length: 24}, (_,i) => {
                    const h = String(i).padStart(2,'0')
                    return <option key={h} value={h}>{h}:00</option>
                  })}
                </Select>
              </div>
            </div>

            <div>
              <Label>Recipient Email</Label>
              <input value={schedEmail} onChange={e => setSchedEmail(e.target.value)} type="email" placeholder="client@company.com"
                style={{ width: '100%', background: S.surface3, border: `1px solid ${S.border}`, color: S.text, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}/>
            </div>

            <div style={{ background: 'rgba(255,197,61,0.1)', border: '1px solid rgba(255,197,61,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: S.yellow }}>
              ⚠ Email delivery requires RESEND_API_KEY in Vercel environment variables.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowScheduleModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${S.border}`, color: S.textMid }}>
                Cancel
              </button>
              <button onClick={saveSchedule} disabled={savingSched || !schedEmail}
                style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: S.cyan, color: S.black, border: 'none', opacity: savingSched ? 0.7 : 1, fontFamily: 'Syne, sans-serif' }}>
                {savingSched ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
