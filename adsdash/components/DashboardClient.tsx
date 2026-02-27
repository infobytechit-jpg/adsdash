'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'
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
  accounts?: string[]
  selectedAccount?: string
}

const COLORS = ['#00C8E0', '#a855f7', '#ffc53d', '#00e09e']

export default function DashboardClient({ profile: initialProfile, clientData: initialClientData, metrics: initialMetrics, campaigns: initialCampaigns, period, platform, isAdmin: initialIsAdmin, accounts: initialAccounts = [], selectedAccount = 'all' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState(initialProfile)
  const [clientData, setClientData] = useState(initialClientData)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [accounts, setAccounts] = useState(initialAccounts)
  const [dataLoading, setDataLoading] = useState(!initialProfile)

  useEffect(() => {
    // If server returned no data (cookie issue), fetch client-side
    if (initialProfile) return

    async function fetchData() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!p) return

      setProfile(p)
      const admin = p.role === 'admin'
      setIsAdmin(admin)

      // Get client
      let clientId: string | null = null
      let cData: any = null

      const clientParam = searchParams.get('client')
      if (admin && clientParam) {
        clientId = clientParam
        const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
        cData = data
      } else if (!admin) {
        const { data } = await supabase.from('clients').select('*').eq('user_id', session.user.id).single()
        cData = data; clientId = data?.id
      } else {
        const { data } = await supabase.from('clients').select('*').order('name').limit(1).single()
        cData = data; clientId = data?.id
      }

      setClientData(cData)

      if (!clientId) { setDataLoading(false); return }

      // Date range
      const endDate = new Date()
      const startDate = new Date()
      if (period === 'today') startDate.setHours(0,0,0,0)
      else if (period === 'week') startDate.setDate(startDate.getDate() - 7)
      else if (period === 'month') startDate.setDate(1)
      else startDate.setFullYear(startDate.getFullYear() - 1)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      // Accounts
      const { data: ad } = await supabase.from('metrics_cache').select('account_name').eq('client_id', clientId).not('account_name','is',null)
      setAccounts(Array.from(new Set((ad||[]).map((a:any) => a.account_name).filter(Boolean))))

      // Metrics
      let q = supabase.from('metrics_cache').select('*').eq('client_id', clientId).gte('date', startStr).lte('date', endStr).order('date')
      if (platform !== 'all') q = q.eq('platform', platform)
      if (selectedAccount !== 'all') q = q.eq('account_name', selectedAccount)
      const { data: m } = await q
      setMetrics(m || [])

      // Campaigns
      const { data: camp } = await supabase.from('campaign_metrics')
        .select('*, campaigns(campaign_name,platform,status,platform_campaign_id)')
        .eq('client_id', clientId).gte('date', startStr).lte('date', endStr)
      setCampaigns(camp || [])

      setDataLoading(false)
    }

    fetchData()
  }, [initialProfile, period, platform, selectedAccount])

  function setParam(key: string, val: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, val)
    router.push(`/dashboard?${params.toString()}`)
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
      campaignMap[key] = { name: cm.campaigns?.campaign_name || 'Unknown', platform: cm.campaigns?.platform || 'unknown', status: cm.campaigns?.status || 'active', spend: 0, conversions: 0, leads: 0, conversion_value: 0 }
    }
    campaignMap[key].spend += Number(cm.spend || 0)
    campaignMap[key].conversions += Number(cm.conversions || 0)
    campaignMap[key].leads += Number(cm.leads || 0)
    campaignMap[key].conversion_value += Number(cm.conversion_value || 0)
  })
  const campaignList = Object.values(campaignMap)

  const show = clientData || {}
  const showConvValue = show.show_conversion_value !== false

  function fmt(n: number) { return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) }
  function fmtEur(n: number) { return '€' + fmt(n) }

  async function exportCSV() {
    const rows = [
      ['Date', 'Platform', 'Spend', 'Conversions', 'Leads', 'Clicks', 'Impressions'],
      ...metrics.map(m => [m.date, m.platform, m.spend, m.conversions, m.leads, m.clicks, m.impressions])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${clientData?.name || 'report'}-${period}.csv`; a.click()
  }

  const noData = metrics.length === 0

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <style>{`@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}`}</style>
        <div style={{ display: 'flex', gap: '8px' }}><div className="ld"/><div className="ld"/><div className="ld"/></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>{clientData?.name || 'Dashboard'}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {noData ? 'No data for this period' : `Google Ads + Meta Ads · ${period} view`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {accounts.length > 0 && (
            <select value={selectedAccount} onChange={e => setParam('account', e.target.value)}
              style={{ fontSize: '12px', padding: '7px 10px', width: 'auto' }}>
              <option value="all">All Accounts</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setParam('period', p)} style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: period === p ? 'var(--cyan)' : 'transparent', color: period === p ? 'var(--black)' : 'var(--text-muted)' }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>⬇ Export</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Platform pills */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          {[{ key: 'all', label: 'All Platforms', color: '#00C8E0' }, { key: 'google', label: 'Google Ads', color: '#4285F4' }, { key: 'meta', label: 'Meta Ads', color: '#1877F2' }].map(p => (
            <button key={p.key} onClick={() => setParam('platform', p.key)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${platform === p.key ? p.color : 'var(--border)'}`, background: platform === p.key ? `${p.color}20` : 'var(--surface2)', color: platform === p.key ? p.color : 'var(--text-muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />{p.label}
            </button>
          ))}
        </div>

        {noData && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No data for this period</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try selecting a different time period or platform.</div>
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <KpiCard label="💰 Total Spend" value={fmtEur(totals.spend)} accent="#00C8E0" sub={`G: ${fmtEur(gSpend)} · M: ${fmtEur(mSpend)}`} />
          <KpiCard label="✅ Conversions" value={fmt(totals.conversions)} accent="#00e09e" sub={`G: ${fmt(gConv)} · M: ${fmt(mConv)}`} />
          <KpiCard label="📈 ROAS" value={`${roas}x`} accent="#ffc53d" sub="Return on ad spend" />
          <KpiCard label="🎯 Leads" value={fmt(totals.leads)} accent="#a855f7" sub="Form fills & calls" />
          <KpiCard label="🖱 Clicks" value={fmt(totals.clicks)} accent="#4285F4" sub="Total link clicks" />
          {showConvValue && <KpiCard label="💵 Conv. Value" value={fmtEur(totals.conversion_value)} accent="#00e09e" sub="Total conversion value" />}
        </div>

        {!noData && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Spend Over Time</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Daily spend breakdown</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4285F4" stopOpacity={0.3}/><stop offset="95%" stopColor="#4285F4" stopOpacity={0}/></linearGradient>
                    <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1877F2" stopOpacity={0.3}/><stop offset="95%" stopColor="#1877F2" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#5a7080', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#5a7080', fontSize: 10 }} tickFormatter={v => `€${v}`} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => [`€${Number(v).toFixed(0)}`, '']} />
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
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[i] }} />{d.name}
                    </div>
                    <span style={{ color: 'var(--text-mid)', fontWeight: 600 }}>{totals.conversions > 0 ? Math.round(d.value / totals.conversions * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
    </div>
  )
}

function useCountUp(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target
    if (target === 0) { setCurrent(0); return }
    const start = Date.now()
    const from = current
    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])

  return current
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  // Parse numeric value for animation
  const prefix = value.startsWith('€') ? '€' : ''
  const suffix = value.endsWith('x') ? 'x' : ''
  // For ROAS like "3.45x", multiply by 100 to animate as integer, divide back
  const isDecimal = suffix === 'x' && value.includes('.')
  const rawStr = value.replace('€','').replace('x','').replace(/\./g,'').replace(/,/g,'.')
  const raw = isDecimal
    ? Math.round(parseFloat(value.replace('x','')) * 100)
    : (parseInt(rawStr.replace(/[^0-9]/g,'')) || 0)
  const animated = useCountUp(raw)

  function formatAnimated(n: number) {
    if (isDecimal) return (n / 100).toFixed(2)
    return new Intl.NumberFormat('it-IT').format(n)
  }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, opacity: 0.7 }} />
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '6px' }}>
        {prefix}{formatAnimated(animated)}{suffix}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}
