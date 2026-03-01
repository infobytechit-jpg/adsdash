'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

interface Props {
  profile: any; clientData: any; metrics: any[]; campaigns: any[]
  period: string; platform: string; isAdmin: boolean
  accounts?: string[]; selectedAccount?: string
}

const COLORS = ['#00C8E0', '#a855f7', '#ffc53d', '#00e09e']

const ALL_METRICS = [
  { key: 'spend',            label: '💰 Spend',       accent: '#00C8E0', fmt: 'eur', col: 'show_spend',            defaultOn: true  },
  { key: 'conversions',      label: '✅ Conversions',  accent: '#00e09e', fmt: 'num', col: 'show_conversions',      defaultOn: true  },
  { key: 'roas',             label: '📈 ROAS',         accent: '#ffc53d', fmt: 'x',   col: 'show_roas',             defaultOn: true  },
  { key: 'leads',            label: '🎯 Leads',        accent: '#a855f7', fmt: 'num', col: 'show_leads',            defaultOn: true  },
  { key: 'conversion_value', label: '💵 Conv. Value',  accent: '#00e09e', fmt: 'eur', col: 'show_conversion_value', defaultOn: false },
  { key: 'clicks',           label: '🖱 Clicks',       accent: '#4285F4', fmt: 'num', col: 'show_clicks',           defaultOn: false },
  { key: 'impressions',      label: '👁 Impressions',  accent: '#1877F2', fmt: 'num', col: 'show_impressions',      defaultOn: false },
]

function doFmt(n: number, type: string) {
  const f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: type === 'x' ? 2 : 0 }).format(n)
  return type === 'eur' ? '€' + f : type === 'x' ? f + 'x' : f
}

function useCountUp(target: number, duration = 1200) {
  const [cur, setCur] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current; const start = Date.now()
    let raf: number
    function tick() {
      const p = Math.min((Date.now() - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCur(Math.round(from + (target - from) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return cur
}

function KpiCard({ label, accent, rawValue, displayValue, sub, delta, onDragStart, onDragEnter, onDragEnd, dragging }: any) {
  const animated = useCountUp(rawValue)
  const isEur = displayValue.startsWith('€')
  const isX = displayValue.endsWith('x')
  function render(n: number) {
    if (isX) return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n / 100) + 'x'
    if (isEur) return '€' + new Intl.NumberFormat('it-IT').format(n)
    return new Intl.NumberFormat('it-IT').format(n)
  }
  return (
    <div draggable onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDragOver={(e: any) => e.preventDefault()}
      style={{ background: 'var(--surface2)', border: `1px solid ${dragging ? accent : 'var(--border)'}`, borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', cursor: 'grab', userSelect: 'none', opacity: dragging ? 0.4 : 1, transition: 'opacity 0.15s, border-color 0.15s' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--border)', cursor: 'grab' }}>⠿</div>
      </div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '6px' }}>{render(animated)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
        {delta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: delta.up ? 'var(--green)' : 'var(--red)', background: delta.up ? 'rgba(0,224,158,0.1)' : 'rgba(255,77,106,0.1)', padding: '2px 7px', borderRadius: '100px' }}>
            {delta.up ? '↑' : '↓'} {delta.pct}%
          </div>
        )}
      </div>
    </div>
  )
}

// ── Date Range Picker ──────────────────────────────────────────────
function DateRangePicker({ startDate, endDate, onApply, onClose }: {
  startDate: string; endDate: string
  onApply: (s: string, e: string) => void
  onClose: () => void
}) {
  const [s, setS] = useState(startDate)
  const [e, setE] = useState(endDate)
  const [viewDate, setViewDate] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  function getDaysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate()
  }
  function getFirstDay(y: number, m: number) {
    return new Date(y, m, 1).getDay()
  }

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function handleDay(day: number) {
    const clicked = toStr(viewDate.year, viewDate.month, day)
    if (!s || (s && e)) { setS(clicked); setE('') }
    else {
      if (clicked < s) { setE(s); setS(clicked) }
      else { setE(clicked) }
    }
  }

  function isInRange(day: number) {
    if (!s || !e) return false
    const d = toStr(viewDate.year, viewDate.month, day)
    return d > s && d < e
  }
  function isStart(day: number) { return toStr(viewDate.year, viewDate.month, day) === s }
  function isEnd(day: number) { return toStr(viewDate.year, viewDate.month, day) === e }

  function prevMonth() {
    setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  function nextMonth() {
    setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  // Quick presets
  function preset(days: number) {
    const end = new Date(), start = new Date()
    start.setDate(start.getDate() - days)
    setS(start.toISOString().split('T')[0])
    setE(end.toISOString().split('T')[0])
  }
  function presetMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    setS(start.toISOString().split('T')[0])
    setE(now.toISOString().split('T')[0])
  }
  function presetLastMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    setS(start.toISOString().split('T')[0])
    setE(end.toISOString().split('T')[0])
  }

  const totalDays = getDaysInMonth(viewDate.year, viewDate.month)
  const firstDay = getFirstDay(viewDate.year, viewDate.month)
  const cells = Array.from({ length: firstDay + totalDays }, (_, i) => i < firstDay ? null : i - firstDay + 1)

  const C = { bg:'#080c0f', s:'#0e1419', s2:'#121a21', s3:'#1a2530', b:'#1f2d38', cyan:'#00C8E0', txt:'#e8f0f5', mid:'#8ba0ae', muted:'#5a7080' }

  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 500, marginTop: '6px', background: C.s, border: `1px solid ${C.b}`, borderRadius: '14px', padding: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', width: '300px' }}>
      {/* Presets */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${C.b}` }}>
        {[['7d', () => preset(7)], ['30d', () => preset(30)], ['90d', () => preset(90)], ['This month', presetMonth], ['Last month', presetLastMonth]].map(([label, fn]: any) => (
          <button key={label as string} onClick={fn}
            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: C.s3, border: `1px solid ${C.b}`, color: C.mid }}>
            {label as string}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: C.mid, cursor: 'pointer', fontSize: '18px', padding: '2px 8px' }}>‹</button>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px' }}>{MONTHS[viewDate.month]} {viewDate.year}</div>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: C.mid, cursor: 'pointer', fontSize: '18px', padding: '2px 8px' }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: C.muted, padding: '2px 0' }}>{d}</div>)}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const start = isStart(day), end = isEnd(day), inRange = isInRange(day)
          const today = toStr(viewDate.year, viewDate.month, day) === new Date().toISOString().split('T')[0]
          return (
            <button key={i} onClick={() => handleDay(day)}
              style={{
                padding: '6px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: start || end ? 700 : 400,
                background: start || end ? C.cyan : inRange ? 'rgba(0,200,224,0.15)' : 'transparent',
                color: start || end ? '#080c0f' : inRange ? C.cyan : today ? C.cyan : C.txt,
                outline: today && !start && !end ? `1px solid ${C.b}` : 'none',
              }}>
              {day}
            </button>
          )
        })}
      </div>

      {/* Selected range display */}
      <div style={{ marginTop: '14px', padding: '10px 12px', background: C.s3, borderRadius: '8px', fontSize: '12px', color: C.mid, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{s || '—'}</span>
        <span style={{ color: C.muted }}>→</span>
        <span>{e || '—'}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button onClick={onClose} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.b}`, color: C.mid }}>Cancel</button>
        <button onClick={() => { if (s && e) onApply(s, e) }} disabled={!s || !e}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: s && e ? C.cyan : C.s3, color: s && e ? '#080c0f' : C.muted, border: 'none', fontFamily: 'Syne, sans-serif' }}>
          Apply
        </button>
      </div>
    </div>
  )
}

export default function DashboardClient({
  profile: initProfile, clientData: initClientData, metrics: initMetrics,
  campaigns: initCampaigns, period: initPeriod, platform: initPlatform, isAdmin: initIsAdmin,
  accounts: initAccounts = [], selectedAccount: initSelectedAccount = 'all'
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // ✅ Always read live filter values from URL
  const period = searchParams.get('period') || initPeriod || 'week'
  const platform = searchParams.get('platform') || initPlatform || 'all'
  const selectedAccount = searchParams.get('account') || initSelectedAccount || 'all'
  const customStart = searchParams.get('start') || ''
  const customEnd = searchParams.get('end') || ''

  const [profile, setProfile] = useState(initProfile)
  const [clientData, setClientData] = useState(initClientData)
  const [metrics, setMetrics] = useState(initMetrics)
  const [campaigns, setCampaigns] = useState(initCampaigns)
  const [isAdmin, setIsAdmin] = useState(initIsAdmin)
  const [accounts, setAccounts] = useState(initAccounts)
  const [loading, setLoading] = useState(!initProfile)
  const [fetching, setFetching] = useState(false)
  const [showMetricPicker, setShowMetricPicker] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragTo, setDragTo] = useState<number | null>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)

  const [metricOrder, setMetricOrder] = useState<string[]>(() => ALL_METRICS.map(m => m.key))
  const clientId = searchParams.get('client') || initClientData?.id

  // Close date picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    if (showDatePicker) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDatePicker])

  // Client-side fallback when server auth failed
  useEffect(() => {
    if (initProfile) { setLoading(false); return }
    async function load() {
      // ✅ Use getUser() not getSession() — getSession() reads localStorage which may be empty
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { setLoading(false); return }
      setProfile(p); setIsAdmin(p.role === 'admin')
      const clientParam = searchParams.get('client')
      let cData: any = null, cId: string | null = null
      if (p.role === 'admin') {
        if (clientParam) {
          const { data } = await supabase.from('clients').select('*').eq('id', clientParam).single()
          cData = data; cId = data?.id
        } else {
          const { data } = await supabase.from('clients').select('*').order('name').limit(1).single()
          cData = data; cId = data?.id
        }
      } else {
        const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).single()
        cData = data; cId = data?.id
      }
      setClientData(cData)
      if (!cId) { setLoading(false); return }
      const { data: aData } = await supabase.from('metrics_cache').select('account_name').eq('client_id', cId).not('account_name', 'is', null)
      setAccounts(Array.from(new Set((aData || []).map((a: any) => a.account_name).filter(Boolean))))
      setLoading(false)
    }
    load()
  }, [initProfile])

  // ✅ Re-fetch when filters change (including custom date range)
  useEffect(() => {
    if (!clientId) return
    async function refetch() {
      setFetching(true)
      const end = new Date(), start = new Date()

      let s: string, e: string
      if (period === 'custom' && customStart && customEnd) {
        s = customStart; e = customEnd
      } else {
        if (period === 'today') start.setHours(0, 0, 0, 0)
        else if (period === 'week') start.setDate(start.getDate() - 7)
        else if (period === 'month') start.setDate(1)
        else start.setFullYear(start.getFullYear() - 1)
        s = start.toISOString().split('T')[0]
        e = end.toISOString().split('T')[0]
      }

      const { data: aData } = await supabase.from('metrics_cache').select('account_name').eq('client_id', clientId).not('account_name', 'is', null)
      setAccounts(Array.from(new Set((aData || []).map((a: any) => a.account_name).filter(Boolean))))

      let q = supabase.from('metrics_cache').select('*').eq('client_id', clientId).gte('date', s).lte('date', e).order('date')
      if (platform !== 'all') q = q.eq('platform', platform)
      if (selectedAccount !== 'all') q = q.eq('account_name', selectedAccount)
      const { data: m } = await q
      setMetrics(m || [])

      const { data: camp } = await supabase.from('campaign_metrics').select('*, campaigns(campaign_name,platform,status)').eq('client_id', clientId).gte('date', s).lte('date', e)
      setCampaigns(camp || [])
      setFetching(false)
    }
    refetch()
  }, [period, platform, selectedAccount, clientId, customStart, customEnd])

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set(key, val)
    router.push(`/dashboard?${p.toString()}`)
  }

  function applyCustomRange(s: string, e: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('period', 'custom')
    p.set('start', s)
    p.set('end', e)
    router.push(`/dashboard?${p.toString()}`)
    setShowDatePicker(false)
  }

  function setPresetPeriod(p: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', p)
    params.delete('start')
    params.delete('end')
    router.push(`/dashboard?${params.toString()}`)
  }

  // Custom range label for button
  const customLabel = period === 'custom' && customStart && customEnd
    ? `${customStart.slice(5)} → ${customEnd.slice(5)}`
    : '📅'

  function isVisible(key: string) {
    const m = ALL_METRICS.find(x => x.key === key)!
    if (!clientData) return m.defaultOn
    const val = clientData[m.col]
    return val === undefined || val === null ? m.defaultOn : val
  }

  async function toggleMetric(key: string) {
    if (!clientData?.id) return
    const m = ALL_METRICS.find(x => x.key === key)!
    const newVal = !isVisible(key)
    setClientData((prev: any) => ({ ...prev, [m.col]: newVal }))
    await supabase.from('clients').update({ [m.col]: newVal }).eq('id', clientData.id)
  }

  function handleDragEnd() {
    if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
      const o = [...metricOrder]; const [moved] = o.splice(dragFrom, 1); o.splice(dragTo, 0, moved)
      setMetricOrder(o)
    }
    setDragFrom(null); setDragTo(null)
  }

  // ── Previous period totals for delta calculation ──
  const [prevTotals, setPrevTotals] = useState<any>(null)
  useEffect(() => {
    if (!clientId) return
    async function fetchPrev() {
      const end = new Date(), start = new Date()
      let pStart: Date, pEnd: Date
      if (period === 'today') {
        pEnd = new Date(); pEnd.setHours(0,0,0,0); pEnd.setSeconds(-1)
        pStart = new Date(pEnd); pStart.setHours(0,0,0,0); pStart.setDate(pStart.getDate()-1)
      } else if (period === 'week') {
        pEnd = new Date(); pEnd.setDate(pEnd.getDate()-7)
        pStart = new Date(pEnd); pStart.setDate(pStart.getDate()-7)
      } else if (period === 'month') {
        pEnd = new Date(); pEnd.setDate(0) // last day of prev month
        pStart = new Date(pEnd.getFullYear(), pEnd.getMonth(), 1)
      } else if (period === 'custom' && customStart && customEnd) {
        const diff = new Date(customEnd).getTime() - new Date(customStart).getTime()
        pEnd = new Date(new Date(customStart).getTime() - 86400000)
        pStart = new Date(pEnd.getTime() - diff)
      } else {
        setPrevTotals(null); return
      }
      const s = pStart.toISOString().split('T')[0]
      const e = pEnd.toISOString().split('T')[0]
      let q = supabase.from('metrics_cache').select('spend,conversions,leads,clicks,impressions,conversion_value')
        .eq('client_id', clientId).gte('date', s).lte('date', e)
      if (platform !== 'all') q = q.eq('platform', platform)
      if (selectedAccount !== 'all') q = q.eq('account_name', selectedAccount)
      const { data } = await q
      if (!data?.length) { setPrevTotals(null); return }
      const t = data.reduce((a: any, m: any) => ({
        spend: a.spend + Number(m.spend||0),
        conversions: a.conversions + Number(m.conversions||0),
        leads: a.leads + Number(m.leads||0),
        clicks: a.clicks + Number(m.clicks||0),
        impressions: a.impressions + Number(m.impressions||0),
        conversion_value: a.conversion_value + Number(m.conversion_value||0),
      }), { spend:0, conversions:0, leads:0, clicks:0, impressions:0, conversion_value:0 })
      t.roas = t.spend > 0 ? t.conversion_value / t.spend : 0
      setPrevTotals(t)
    }
    fetchPrev()
  }, [period, platform, selectedAccount, clientId, customStart, customEnd])

  function getDelta(key: string): { pct: number; up: boolean } | null {
    if (!prevTotals) return null
    const cur = allTotals[key] || 0
    const prev = prevTotals[key] || 0
    if (prev === 0) return null
    const pct = ((cur - prev) / prev) * 100
    return { pct: Math.abs(Math.round(pct)), up: pct >= 0 }
  }

  const totals = useMemo(() => metrics.reduce((a, m) => ({
    spend: a.spend + Number(m.spend || 0),
    conversions: a.conversions + Number(m.conversions || 0),
    leads: a.leads + Number(m.leads || 0),
    clicks: a.clicks + Number(m.clicks || 0),
    impressions: a.impressions + Number(m.impressions || 0),
    conversion_value: a.conversion_value + Number(m.conversion_value || 0),
  }), { spend: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0, conversion_value: 0 }), [metrics])

  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0
  const allTotals: any = { ...totals, roas }

  const gM = metrics.filter(m => m.platform === 'google')
  const mM = metrics.filter(m => m.platform === 'meta')
  const gSpend = gM.reduce((a, m) => a + Number(m.spend || 0), 0)
  const mSpend = mM.reduce((a, m) => a + Number(m.spend || 0), 0)
  const gConv = gM.reduce((a, m) => a + Number(m.conversions || 0), 0)
  const mConv = mM.reduce((a, m) => a + Number(m.conversions || 0), 0)

  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {}
    metrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, google: 0, meta: 0 }
      if (m.platform === 'google') byDate[m.date].google += Number(m.spend || 0)
      if (m.platform === 'meta') byDate[m.date].meta += Number(m.spend || 0)
    })
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date))
  }, [metrics])

  const convData = [
    { name: 'Purchase',   value: Math.round(totals.conversions * 0.42) },
    { name: 'Lead Form',  value: Math.round(totals.conversions * 0.33) },
    { name: 'Phone Call', value: Math.round(totals.conversions * 0.25) },
  ]

  const campaignMap: Record<string, any> = {}
  campaigns.forEach((cm: any) => {
    const k = cm.campaign_id
    if (!campaignMap[k]) campaignMap[k] = { name: cm.campaigns?.campaign_name || 'Unknown', platform: cm.campaigns?.platform || 'unknown', status: cm.campaigns?.status || 'active', spend: 0, conversions: 0, leads: 0, conversion_value: 0 }
    campaignMap[k].spend += Number(cm.spend || 0)
    campaignMap[k].conversions += Number(cm.conversions || 0)
    campaignMap[k].leads += Number(cm.leads || 0)
    campaignMap[k].conversion_value += Number(cm.conversion_value || 0)
  })
  const campaignList = Object.values(campaignMap)

  const orderedKeys = [...metricOrder.filter(k => ALL_METRICS.find(m => m.key === k)), ...ALL_METRICS.map(m => m.key).filter(k => !metricOrder.includes(k))]
  const visibleMetrics = orderedKeys.map(k => ALL_METRICS.find(m => m.key === k)!).filter(m => m && isVisible(m.key))

  function getSub(key: string) {
    if (key === 'spend') return `G: ${doFmt(gSpend, 'eur')} · M: ${doFmt(mSpend, 'eur')}`
    if (key === 'conversions') return `G: ${doFmt(gConv, 'num')} · M: ${doFmt(mConv, 'num')}`
    if (key === 'roas') return 'Return on ad spend'
    if (key === 'leads') return 'Form fills & calls'
    return ''
  }

  function getRaw(key: string, val: number) {
    if (key === 'roas') return Math.round(val * 100)
    return Math.round(val)
  }

  async function exportCSV() {
    const rows = [['Date', 'Platform', 'Spend', 'Conversions', 'Leads', 'Clicks', 'Impressions'],
      ...metrics.map(m => [m.date, m.platform, m.spend, m.conversions, m.leads, m.clicks, m.impressions])]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${clientData?.name || 'report'}-${period}.csv`; a.click()
  }

  const noData = metrics.length === 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}' }} />
      <div style={{ display: 'flex', gap: '8px' }}><div className="ld" /><div className="ld" /><div className="ld" /></div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: 0 }}>
        <div style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {clientData?.name || 'Dashboard'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {fetching ? 'Loading…' : noData ? 'No data for this period' : `Google Ads + Meta Ads · ${period === 'custom' ? `${customStart} → ${customEnd}` : period + ' view'}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Account filter */}
          {accounts.length > 0 && (
            <select value={selectedAccount} onChange={e => setParam('account', e.target.value)}
              style={{ fontSize: '12px', padding: '6px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', outline: 'none', maxWidth: '120px', width: 'auto' }}>
              <option value="all">All Accounts</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {/* Period preset buttons */}
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
            {([['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['all', 'All']] as const).map(([p, label]) => (
              <button key={p} onClick={() => setPresetPeriod(p)}
                style={{ padding: '6px 9px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: period === p ? 'var(--cyan)' : 'transparent', color: period === p ? 'var(--black)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
          </div>

          {/* ✅ Custom date range button */}
          <div ref={datePickerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowDatePicker(v => !v)}
              style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: `1px solid ${period === 'custom' ? 'var(--cyan)' : 'var(--border)'}`, background: period === 'custom' ? 'rgba(0,200,224,0.1)' : 'transparent', color: period === 'custom' ? 'var(--cyan)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {customLabel}
            </button>
            {showDatePicker && (
              <DateRangePicker
                startDate={customStart}
                endDate={customEnd}
                onApply={applyCustomRange}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>

          <button onClick={() => setShowMetricPicker(v => !v)}
            style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: showMetricPicker ? 'var(--cyan)' : 'transparent', border: '1px solid var(--border)', color: showMetricPicker ? 'var(--black)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            🎛
          </button>
          <button onClick={exportCSV}
            style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ⬇
          </button>
        </div>
      </div>

      {/* Metric picker panel */}
      {showMetricPicker && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>TOGGLE METRICS · Drag cards to reorder</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ALL_METRICS.map(m => {
              const on = isVisible(m.key)
              return (
                <button key={m.key} onClick={() => toggleMetric(m.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? m.accent : 'var(--border)'}`, background: on ? `${m.accent}22` : 'var(--surface2)', color: on ? m.accent : 'var(--text-muted)', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '11px' }}>{on ? '✓' : '+'}</span> {m.label.replace(/^\S+ /, '')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', opacity: fetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>

        {/* Platform pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All Platforms', color: '#00C8E0' }, { key: 'google', label: 'Google Ads', color: '#4285F4' }, { key: 'meta', label: 'Meta Ads', color: '#1877F2' }].map(p => (
            <button key={p.key} onClick={() => setParam('platform', p.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${platform === p.key ? p.color : 'var(--border)'}`, background: platform === p.key ? `${p.color}20` : 'var(--surface2)', color: platform === p.key ? p.color : 'var(--text-muted)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.color }} />{p.label}
            </button>
          ))}
        </div>

        {noData && !fetching && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No data for this period</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try a different time period or import data first.</div>
          </div>
        )}

        {/* KPI Cards */}
        {visibleMetrics.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {visibleMetrics.map((m, i) => {
              const val = allTotals[m.key] || 0
              return (
                <KpiCard key={m.key} label={m.label} accent={m.accent}
                  rawValue={getRaw(m.key, val)}
                  displayValue={doFmt(val, m.fmt)}
                  sub={getSub(m.key)}
                  delta={getDelta(m.key)}
                  dragging={dragFrom === i}
                  onDragStart={() => setDragFrom(i)}
                  onDragEnter={() => setDragTo(i)}
                  onDragEnd={handleDragEnd}
                />
              )
            })}
          </div>
        )}

        {/* Charts */}
        {!noData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Spend Over Time</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Daily spend by platform</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4285F4" stopOpacity={0.3} /><stop offset="95%" stopColor="#4285F4" stopOpacity={0} /></linearGradient>
                    <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} /><stop offset="95%" stopColor="#1877F2" stopOpacity={0} /></linearGradient>
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
        )}

        {/* Campaign table */}
        {campaignList.length > 0 && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700 }}>Campaign Performance</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All campaigns in selected period</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface3)' }}>
                    {['Campaign', 'Platform', 'Spend', 'Conversions', 'ROAS', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignList.map((c: any, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: c.platform === 'google' ? 'rgba(66,133,244,0.2)' : 'rgba(24,119,242,0.2)', color: c.platform === 'google' ? '#4285F4' : '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{c.platform === 'google' ? 'G' : 'f'}</div>
                          {c.platform === 'google' ? 'Google' : 'Meta'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{doFmt(c.spend, 'eur')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{doFmt(c.conversions, 'num')}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{c.spend > 0 ? doFmt(c.conversion_value / c.spend, 'x') : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: c.status === 'active' ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: c.status === 'active' ? 'var(--green)' : 'var(--yellow)' }}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
