'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface Props {
  profile: any
  clientData: any
  metrics: any[]
  campaigns: any[]
  period: string
  platform: string
  isAdmin: boolean
  accounts: string[]
  selectedAccount: string
}

const COLORS = ['#00C8E0', '#a855f7', '#ffc53d', '#00e09e']

const ALL_METRICS = [
  { key: 'spend', label: '💰 Total Spend', accent: '#00C8E0' },
  { key: 'conversions', label: '✅ Conversions', accent: '#00e09e' },
  { key: 'roas', label: '📈 ROAS', accent: '#ffc53d' },
  { key: 'leads', label: '🎯 Leads', accent: '#a855f7' },
  { key: 'clicks', label: '🖱 Clicks', accent: '#4285F4' },
  { key: 'impressions', label: '👁 Impressions', accent: '#1877F2' },
  { key: 'cpc', label: '💡 CPC', accent: '#f97316' },
  { key: 'ctr', label: '📊 CTR', accent: '#00e09e' },
]

export default function DashboardClient({ profile, clientData, metrics, campaigns, period, platform, isAdmin, accounts, selectedAccount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Metric visibility state — admin starts with their own prefs, clients use clientData settings
  const defaultVisible = {
    spend: clientData?.show_spend ?? true,
    conversions: clientData?.show_conversions ?? true,
    roas: clientData?.show_roas ?? true,
    leads: clientData?.show_leads ?? true,
    clicks: clientData?.show_clicks ?? false,
    impressions: clientData?.show_impressions ?? false,
    cpc: clientData?.show_cpc ?? false,
    ctr: clientData?.show_ctr ?? false,
  }

  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>(defaultVisible)
  const [showMetricPicker, setShowMetricPicker] = useState(false)
  const [savingMetrics, setSavingMetrics] = useState(false)

  function setParam(key: string, val: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, val)
    router.push(`/dashboard?${params.toString()}`)
  }

  async function saveMetricVisibility() {
    if (!clientData?.id) return
    setSavingMetrics(true)
    await supabase.from('clients').update({
      show_spend: visibleMetrics.spend,
      show_conversions: visibleMetrics.conversions,
      show_roas: visibleMetrics.roas,
      show_leads: visibleMetrics.leads,
      show_clicks: visibleMetrics.clicks,
      show_impressions: visibleMetrics.impressions,
      show_cpc: visibleMetrics.cpc,
      show_ctr: visibleMetrics.ctr,
    }).eq('id', clientData.id)
    setSavingMetrics(false)
    setShowMetricPicker(false)
  }

  const totals = useMemo(() => {
    return metrics.reduce((acc, m) => ({
      spend: acc.spend + Number(m.spend || 0),
      conversions: acc.conversions + Number(m.conversions || 0),
      leads: acc.leads + Number(m.leads || 0),
      clicks: acc.clicks + Number(m.clicks || 0),
      impressions: acc.impressions + Number(m.impressions || 0),
      conversion_value: acc.conversion_value + Number(m.conversion_value || 0),
    }), { spend: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0, conversion_value: 0 })
  }, [metrics])

  const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'
  const cpc = totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0.00'
  const ctr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00'

  const gMetrics = metrics.filter(m => m.platform === 'google')
  const mMetrics = metrics.filter(m => m.platform === 'meta')
  const gSpend = gMetrics.reduce((a, m) => a + Number(m.spend || 0), 0)
  const mSpend = mMetrics.reduce((a, m) => a + Number(m.spend || 0), 0)
  const gConv = gMetrics.reduce((a, m) => a + Number(m.conversions || 0), 0)
  const mConv = mMetrics.reduce((a, m) => a + Number(m.conversions || 0), 0)

  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {}
    metrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, google: 0, meta: 0, total: 0 }
      if (m.platform === 'google') byDate[m.date].google += Number(m.spend || 0)
      if (m.platform === 'meta') byDate[m.date].meta += Number(m.spend || 0)
      byDate[m.date].total += Number(m.spend || 0)
    })
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }, [metrics])

  const convData = [
    { name: 'Purchase', value: Math.round(totals.conversions * 0.42) },
    { name: 'Lead Form', value: Math.round(totals.conversions * 0.33) },
    { name: 'Phone Call', value: Math.round(totals.conversions * 0.25) },
  ]

  const campaignMap: Record<string, any> = {}
  campaigns.forEach((cm: any) => {
    const key = cm.campaign_id
    if (!campaignMap[key]) {
      campaignMap[key] = {
        name: cm.campaigns?.campaign_name || 'Unknown',
        platform: cm.campaigns?.platform || 'unknown',
        status: cm.campaigns?.status || 'active',
        spend: 0, conversions: 0, leads: 0, conversion_value: 0,
      }
    }
    campaignMap[key].spend += Number(cm.spend || 0)
    campaignMap[key].conversions += Number(cm.conversions || 0)
    campaignMap[key].leads += Number(cm.leads || 0)
    campaignMap[key].conversion_value += Number(cm.conversion_value || 0)
  })
  const campaignList = Object.values(campaignMap)
  const noData = metrics.length === 0

  function fmt(n: number) {
    return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  }
  function fmtEur(n: number) { return '€' + fmt(n) }

  async function exportCSV() {
    const rows = [
      ['Date', 'Platform', 'Account', 'Spend', 'Conversions', 'Leads', 'Clicks', 'Impressions'],
      ...metrics.map(m => [m.date, m.platform, m.account_name || '', m.spend, m.conversions, m.leads, m.clicks, m.impressions])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientData?.name || 'report'}-${period}.csv`
    a.click()
  }

  const kpiValues: Record<string, { value: string; sub: string }> = {
    spend: { value: fmtEur(totals.spend), sub: `G: ${fmtEur(gSpend)} · M: ${fmtEur(mSpend)}` },
    conversions: { value: fmt(totals.conversions), sub: `G: ${fmt(gConv)} · M: ${fmt(mConv)}` },
    roas: { value: `${roas}x`, sub: 'Return on ad spend' },
    leads: { value: fmt(totals.leads), sub: 'Form fills & calls' },
    clicks: { value: fmt(totals.clicks), sub: 'Total link clicks' },
    impressions: { value: fmt(totals.impressions), sub: 'Total impressions' },
    cpc: { value: `€${cpc}`, sub: 'Cost per click' },
    ctr: { value: `${ctr}%`, sub: 'Click-through rate' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            {clientData?.name || 'Dashboard'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {noData ? 'No data yet — import a CSV to see metrics' : `Google Ads + Meta Ads · ${period} view`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Period filter */}
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setParam('period', p)} style={{
                padding: '7px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: period === p ? 'var(--cyan)' : 'transparent',
                color: period === p ? 'var(--black)' : 'var(--text-muted)',
              }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Metric picker button (admin only) */}
          {isAdmin && (
            <button onClick={() => setShowMetricPicker(true)} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
              ⊞ Metrics
            </button>
          )}

          <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
            ⬇ Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Filters row: Platform + Account */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {/* Platform pills */}
          {[
            { key: 'all', label: 'All Platforms', color: '#00C8E0' },
            { key: 'google', label: 'Google Ads', color: '#4285F4' },
            { key: 'meta', label: 'Meta Ads', color: '#1877F2' },
          ].map(p => (
            <button key={p.key} onClick={() => setParam('platform', p.key)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
              borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${platform === p.key ? p.color : 'var(--border)'}`,
              background: platform === p.key ? `${p.color}20` : 'var(--surface2)',
              color: platform === p.key ? p.color : 'var(--text-muted)',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
              {p.label}
            </button>
          ))}

          {/* Account selector — only show if multiple accounts */}
          {accounts.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Account:</span>
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button onClick={() => setParam('account', 'all')} style={{
                  padding: '7px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: selectedAccount === 'all' ? 'var(--cyan)' : 'transparent',
                  color: selectedAccount === 'all' ? 'var(--black)' : 'var(--text-muted)',
                }}>All</button>
                {accounts.map(acc => (
                  <button key={acc} onClick={() => setParam('account', acc)} style={{
                    padding: '7px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: selectedAccount === acc ? 'var(--cyan)' : 'transparent',
                    color: selectedAccount === acc ? 'var(--black)' : 'var(--text-muted)',
                    borderLeft: '1px solid var(--border)',
                  }}>{acc}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {noData && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No data yet</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              {isAdmin ? 'Import a CSV from Google Ads or Meta Ads to get started.' : 'Your data will appear here once your ad accounts are connected.'}
            </div>
            {isAdmin && (
              <button onClick={() => window.location.href = '/dashboard/Upload'} style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                ⬆ Import Data →
              </button>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {ALL_METRICS.filter(m => visibleMetrics[m.key]).map(m => (
            <KpiCard
              key={m.key}
              label={m.label}
              value={kpiValues[m.key]?.value || '—'}
              accent={m.accent}
              sub={kpiValues[m.key]?.sub || ''}
            />
          ))}
        </div>

        {/* Charts row */}
        {!noData && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Spend Over Time</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Daily spend breakdown</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4285F4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#5a7080', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#5a7080', fontSize: 10 }} tickFormatter={v => `€${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: any) => [`€${Number(v).toFixed(0)}`, '']}
                  />
                  <Area type="monotone" dataKey="google" stroke="#4285F4" strokeWidth={2} fill="url(#gGrad)" name="Google" />
                  <Area type="monotone" dataKey="meta" stroke="#1877F2" strokeWidth={2} fill="url(#mGrad)" name="Meta" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                {[['#4285F4', 'Google Ads'], ['#1877F2', 'Meta Ads']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-mid)' }}>
                    <div style={{ width: '12px', height: '2px', background: c, borderRadius: '2px' }} />{l}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Conversion Types</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Breakdown</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PieChart width={160} height={160}>
                  <Pie data={convData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {convData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </div>
              <div style={{ marginTop: '8px' }}>
                {convData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i] }} />
                      {d.name}
                    </div>
                    <span style={{ color: 'var(--text-mid)', fontWeight: 600 }}>{totals.conversions > 0 ? Math.round(d.value / totals.conversions * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Campaigns table */}
        {campaignList.length > 0 && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700 }}>Campaign Performance</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All campaigns in selected period</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface3)' }}>
                  {['Campaign', 'Platform', 'Spend', 'Conversions', 'ROAS', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignList.map((c: any, i) => {
                  const cRoas = c.spend > 0 ? (c.conversion_value / c.spend).toFixed(1) : '—'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: c.platform === 'google' ? 'rgba(66,133,244,0.2)' : 'rgba(24,119,242,0.2)', color: c.platform === 'google' ? '#4285F4' : '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                            {c.platform === 'google' ? 'G' : 'f'}
                          </div>
                          {c.platform === 'google' ? 'Google' : 'Meta'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>{fmtEur(c.spend)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>{fmt(c.conversions)}</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>{cRoas}x</td>
                      <td style={{ padding: '12px 20px', fontSize: '13px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: c.status === 'active' ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: c.status === 'active' ? 'var(--green)' : 'var(--yellow)' }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* METRIC PICKER MODAL */}
      {showMetricPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowMetricPicker(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '480px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Customize Metrics</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Choose which metrics are visible. {isAdmin && 'This also updates what the client sees.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {ALL_METRICS.map(m => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: `1px solid ${visibleMetrics[m.key] ? m.accent + '40' : 'var(--border)'}`, borderRadius: '8px', transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.accent }} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <button
                    onClick={() => setVisibleMetrics(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                    style={{ width: '40px', height: '22px', background: visibleMetrics[m.key] ? m.accent : 'var(--surface3)', borderRadius: '100px', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: 'white', top: '3px', left: visibleMetrics[m.key] ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowMetricPicker(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                Cancel
              </button>
              <button onClick={saveMetricVisibility} disabled={savingMetrics} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                {savingMetrics ? 'Saving...' : 'Save & Apply →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, opacity: 0.7 }} />
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}
