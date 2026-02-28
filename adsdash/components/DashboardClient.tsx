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

// Animated counter
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

function KpiCard({ label, accent, rawValue, displayValue, sub, onDragStart, onDragEnter, onDragEnd, dragging }: any) {
  const animated = useCountUp(rawValue)
  // Re-format animated value in same style as displayValue
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
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

export default function DashboardClient({
  profile: initProfile, clientData: initClientData, metrics: initMetrics,
  campaigns: initCampaigns, period, platform, isAdmin: initIsAdmin,
  accounts: initAccounts = [], selectedAccount = 'all'
}: Props) {
  const router = useRouter(); const searchParams = useSearchParams()
  const supabase = createClient()

  const [profile, setProfile] = useState(initProfile)
  const [clientData, setClientData] = useState(initClientData)
  const [metrics, setMetrics] = useState(initMetrics)
  const [campaigns, setCampaigns] = useState(initCampaigns)
  const [isAdmin, setIsAdmin] = useState(initIsAdmin)
  const [accounts, setAccounts] = useState(initAccounts)
  const [loading, setLoading] = useState(!initProfile)
  const [showMetricPicker, setShowMetricPicker] = useState(false)

  // Drag state
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragTo, setDragTo] = useState<number | null>(null)

  // Metric order — persisted in localStorage per client
  const orderKey = `morder_${initClientData?.id || 'x'}`
  const [metricOrder, setMetricOrder] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const s = localStorage.getItem(orderKey)
        if (s) return JSON.parse(s)
      }
    } catch {}
    return ALL_METRICS.map(m => m.key)
  })

  // Client-side data load fallback when server auth failed
  useEffect(() => {
    if (initProfile) return
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!p) { setLoading(false); return }
      setProfile(p); setIsAdmin(p.role === 'admin')
      const clientParam = searchParams.get('client')
      let cData: any = null, cId: string | null = null
      if (p.role === 'admin') {
        if (clientParam) { const { data } = await supabase.from('clients').select('*').eq('id', clientParam).single(); cData = data; cId = data?.id }
        else { const { data } = await supabase.from('clients').select('*').order('name').limit(1).single(); cData = data; cId = data?.id }
      } else {
        const { data } = await supabase.from('clients').select('*').eq('user_id', session.user.id).single(); cData = data; cId = data?.id
      }
      setClientData(cData)
      if (!cId) { setLoading(false); return }
      const end = new Date(), start = new Date()
      if (period === 'today') start.setHours(0,0,0,0)
      else if (period === 'week') start.setDate(start.getDate() - 7)
      else if (period === 'month') start.setDate(1)
      else start.setFullYear(start.getFullYear() - 1)
      const s = start.toISOString().split('T')[0], e = end.toISOString().split('T')[0]
      const { data: aData } = await supabase.from('metrics_cache').select('account_name').eq('client_id', cId).not('account_name','is',null)
      setAccounts(Array.from(new Set((aData||[]).map((a:any)=>a.account_name).filter(Boolean))))
      let q = supabase.from('metrics_cache').select('*').eq('client_id', cId).gte('date', s).lte('date', e).order('date')
      if (platform !== 'all') q = q.eq('platform', platform)
      if (selectedAccount !== 'all') q = q.eq('account_name', selectedAccount)
      const { data: m } = await q; setMetrics(m || [])
      const { data: camp } = await supabase.from('campaign_metrics').select('*, campaigns(campaign_name,platform,status)').eq('client_id', cId).gte('date', s).lte('date', e)
      setCampaigns(camp || []); setLoading(false)
    }
    load()
  }, [initProfile])

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(searchParams.toString()); p.set(key, val); router.push(`/dashboard?${p.toString()}`)
  }

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

  // Drag handlers
  function handleDragEnd() {
    if (dragFrom !== null && dragTo !== null && dragFrom !== dragTo) {
      const o = [...metricOrder]; const [moved] = o.splice(dragFrom, 1); o.splice(dragTo, 0, moved)
      setMetricOrder(o)
      try { localStorage.setItem(orderKey, JSON.stringify(o)) } catch {}
    }
    setDragFrom(null); setDragTo(null)
  }

  const totals = useMemo(() => metrics.reduce((a, m) => ({
    spend: a.spend + Number(m.spend||0), conversions: a.conversions + Number(m.conversions||0),
    leads: a.leads + Number(m.leads||0), clicks: a.clicks + Number(m.clicks||0),
    impressions: a.impressions + Number(m.impressions||0), conversion_value: a.conversion_value + Number(m.conversion_value||0),
  }), { spend:0, conversions:0, leads:0, clicks:0, impressions:0, conversion_value:0 }), [metrics])

  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0
  const allTotals: any = { ...totals, roas }

  const gM = metrics.filter(m=>m.platform==='google'), mM = metrics.filter(m=>m.platform==='meta')
  const gSpend = gM.reduce((a,m)=>a+Number(m.spend||0),0), mSpend = mM.reduce((a,m)=>a+Number(m.spend||0),0)
  const gConv = gM.reduce((a,m)=>a+Number(m.conversions||0),0), mConv = mM.reduce((a,m)=>a+Number(m.conversions||0),0)

  const chartData = useMemo(() => {
    const byDate: Record<string,any> = {}
    metrics.forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, google:0, meta:0 }
      if (m.platform==='google') byDate[m.date].google += Number(m.spend||0)
      if (m.platform==='meta') byDate[m.date].meta += Number(m.spend||0)
    })
    return Object.values(byDate).sort((a:any,b:any)=>a.date.localeCompare(b.date))
  }, [metrics])

  const convData = [{ name:'Purchase', value: Math.round(totals.conversions*0.42) }, { name:'Lead Form', value: Math.round(totals.conversions*0.33) }, { name:'Phone Call', value: Math.round(totals.conversions*0.25) }]

  const campaignMap: Record<string,any> = {}
  campaigns.forEach((cm:any) => {
    const k = cm.campaign_id
    if (!campaignMap[k]) campaignMap[k] = { name: cm.campaigns?.campaign_name||'Unknown', platform: cm.campaigns?.platform||'unknown', status: cm.campaigns?.status||'active', spend:0, conversions:0, leads:0, conversion_value:0 }
    campaignMap[k].spend += Number(cm.spend||0); campaignMap[k].conversions += Number(cm.conversions||0); campaignMap[k].leads += Number(cm.leads||0); campaignMap[k].conversion_value += Number(cm.conversion_value||0)
  })
  const campaignList = Object.values(campaignMap)

  // Ordered visible metrics
  const orderedKeys = [...metricOrder.filter(k => ALL_METRICS.find(m=>m.key===k)), ...ALL_METRICS.map(m=>m.key).filter(k=>!metricOrder.includes(k))]
  const visibleMetrics = orderedKeys.map(k => ALL_METRICS.find(m=>m.key===k)!).filter(m => m && isVisible(m.key))

  function getSub(key: string) {
    if (key==='spend') return `G: ${doFmt(gSpend,'eur')} · M: ${doFmt(mSpend,'eur')}`
    if (key==='conversions') return `G: ${doFmt(gConv,'num')} · M: ${doFmt(mConv,'num')}`
    if (key==='roas') return 'Return on ad spend'
    if (key==='leads') return 'Form fills & calls'
    return ''
  }

  function getRaw(key: string, val: number) {
    if (key==='roas') return Math.round(val * 100) // store as integer ×100
    return Math.round(val)
  }

  async function exportCSV() {
    const rows = [['Date','Platform','Spend','Conversions','Leads','Clicks','Impressions'], ...metrics.map(m=>[m.date,m.platform,m.spend,m.conversions,m.leads,m.clicks,m.impressions])]
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], { type:'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${clientData?.name||'report'}-${period}.csv`; a.click()
  }

  const noData = metrics.length === 0

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}' }} />
      <div style={{ display:'flex', gap:'8px' }}><div className="ld"/><div className="ld"/><div className="ld"/></div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Topbar */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 28px', height:'64px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:'20px', fontWeight:700 }}>{clientData?.name||'Dashboard'}</div>
          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{noData?'No data for this period':`Google Ads + Meta Ads · ${period} view`}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {accounts.length > 0 && (
            <select value={selectedAccount} onChange={e=>setParam('account',e.target.value)}
              style={{ fontSize:'12px', padding:'7px 10px', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:'8px', outline:'none' }}>
              <option value="all">All Accounts</option>
              {accounts.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <div style={{ display:'flex', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
            {['today','week','month','all'].map(p=>(
              <button key={p} onClick={()=>setParam('period',p)} style={{ padding:'7px 12px', fontSize:'12px', fontWeight:600, border:'none', cursor:'pointer', background:period===p?'var(--cyan)':'transparent', color:period===p?'var(--black)':'var(--text-muted)' }}>
                {p.charAt(0).toUpperCase()+p.slice(1)}
              </button>
            ))}
          </div>
          {/* Metrics picker button */}
          <button onClick={()=>setShowMetricPicker(v=>!v)}
            style={{ padding:'7px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:showMetricPicker?'var(--cyan)':'transparent', border:'1px solid var(--border)', color:showMetricPicker?'var(--black)':'var(--text-muted)', whiteSpace:'nowrap' }}>
            🎛 Metrics
          </button>
          <button onClick={exportCSV} style={{ padding:'7px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'transparent', border:'1px solid var(--border)', color:'var(--text-muted)', whiteSpace:'nowrap' }}>⬇ Export</button>
        </div>
      </div>

      {/* Metric picker panel */}
      {showMetricPicker && (
        <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'12px 28px', flexShrink:0 }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'10px', fontWeight:600 }}>TOGGLE METRICS · Changes saved automatically · Drag cards below to reorder</div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {ALL_METRICS.map(m => {
              const on = isVisible(m.key)
              return (
                <button key={m.key} onClick={()=>toggleMetric(m.key)}
                  style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', borderRadius:'100px', fontSize:'13px', fontWeight:600, cursor:'pointer', border:`1px solid ${on?m.accent:'var(--border)'}`, background:on?`${m.accent}22`:'var(--surface2)', color:on?m.accent:'var(--text-muted)', transition:'all 0.15s' }}>
                  <span style={{ fontSize:'11px' }}>{on?'✓':'+'}</span> {m.label.replace(/^\S+ /,'')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {/* Platform pills */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'24px' }}>
          {[{key:'all',label:'All Platforms',color:'#00C8E0'},{key:'google',label:'Google Ads',color:'#4285F4'},{key:'meta',label:'Meta Ads',color:'#1877F2'}].map(p=>(
            <button key={p.key} onClick={()=>setParam('platform',p.key)} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 16px', borderRadius:'100px', fontSize:'13px', fontWeight:600, cursor:'pointer', border:`1px solid ${platform===p.key?p.color:'var(--border)'}`, background:platform===p.key?`${p.color}20`:'var(--surface2)', color:platform===p.key?p.color:'var(--text-muted)' }}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:p.color }} />{p.label}
            </button>
          ))}
        </div>

        {noData && (
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px', padding:'40px', textAlign:'center', marginBottom:'24px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
            <div style={{ fontFamily:'Syne, sans-serif', fontSize:'18px', fontWeight:700, marginBottom:'8px' }}>No data for this period</div>
            <div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Try a different time period or check that data has been imported.</div>
          </div>
        )}

        {/* KPI Cards — draggable */}
        {visibleMetrics.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:'16px', marginBottom:'24px' }}>
            {visibleMetrics.map((m, i) => {
              const val = allTotals[m.key] || 0
              return (
                <KpiCard key={m.key} label={m.label} accent={m.accent}
                  rawValue={getRaw(m.key, val)}
                  displayValue={doFmt(val, m.fmt)}
                  sub={getSub(m.key)}
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
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'16px', marginBottom:'24px' }}>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontSize:'15px', fontWeight:700, marginBottom:'4px' }}>Spend Over Time</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'20px' }}>Daily spend by platform</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4285F4" stopOpacity={0.3}/><stop offset="95%" stopColor="#4285F4" stopOpacity={0}/></linearGradient>
                    <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1877F2" stopOpacity={0.3}/><stop offset="95%" stopColor="#1877F2" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill:'#5a7080', fontSize:10 }} tickFormatter={d=>d.slice(5)} />
                  <YAxis tick={{ fill:'#5a7080', fontSize:10 }} tickFormatter={v=>`€${v}`} />
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px' }} formatter={(v:any)=>[`€${Number(v).toFixed(0)}`,'']} />
                  <Area type="monotone" dataKey="google" stroke="#4285F4" strokeWidth={2} fill="url(#gGrad)" name="Google" />
                  <Area type="monotone" dataKey="meta" stroke="#1877F2" strokeWidth={2} fill="url(#mGrad)" name="Meta" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:'16px', marginTop:'8px' }}>
                {[['#4285F4','Google Ads'],['#1877F2','Meta Ads']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text-mid)' }}>
                    <div style={{ width:'12px', height:'2px', background:c, borderRadius:'2px' }} />{l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px', padding:'20px' }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontSize:'15px', fontWeight:700, marginBottom:'4px' }}>Conversion Types</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>Breakdown</div>
              <div style={{ display:'flex', justifyContent:'center' }}>
                <PieChart width={160} height={160}>
                  <Pie data={convData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {convData.map((_,i)=><Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </div>
              {convData.map((d,i)=>(
                <div key={d.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', fontSize:'13px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}><div style={{ width:'8px', height:'8px', borderRadius:'50%', background:COLORS[i] }} />{d.name}</div>
                  <span style={{ color:'var(--text-mid)', fontWeight:600 }}>{totals.conversions>0?Math.round(d.value/totals.conversions*100):0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {campaignList.length > 0 && (
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'Syne, sans-serif', fontSize:'15px', fontWeight:700 }}>Campaign Performance</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>All campaigns in selected period</div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--surface3)' }}>
                  {['Campaign','Platform','Spend','Conversions','ROAS','Status'].map(h=>(
                    <th key={h} style={{ padding:'10px 20px', textAlign:'left', fontSize:'11px', fontWeight:600, letterSpacing:'0.8px', textTransform:'uppercase', color:'var(--text-muted)', borderBottom:'1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignList.map((c:any,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'12px 20px', fontSize:'13px', fontWeight:600 }}>{c.name}</td>
                    <td style={{ padding:'12px 20px', fontSize:'13px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{ width:'24px', height:'24px', borderRadius:'6px', background:c.platform==='google'?'rgba(66,133,244,0.2)':'rgba(24,119,242,0.2)', color:c.platform==='google'?'#4285F4':'#1877F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:800 }}>{c.platform==='google'?'G':'f'}</div>
                        {c.platform==='google'?'Google':'Meta'}
                      </div>
                    </td>
                    <td style={{ padding:'12px 20px', fontSize:'13px' }}>{doFmt(c.spend,'eur')}</td>
                    <td style={{ padding:'12px 20px', fontSize:'13px' }}>{doFmt(c.conversions,'num')}</td>
                    <td style={{ padding:'12px 20px', fontSize:'13px' }}>{c.spend>0?doFmt(c.conversion_value/c.spend,'x'):'—'}</td>
                    <td style={{ padding:'12px 20px', fontSize:'13px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:'100px', fontSize:'11px', fontWeight:600, background:c.status==='active'?'rgba(0,224,158,0.15)':'rgba(255,197,61,0.15)', color:c.status==='active'?'var(--green)':'var(--yellow)' }}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
