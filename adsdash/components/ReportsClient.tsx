'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props { reports: any[]; clients: any[]; isAdmin: boolean }

const C = { bg:'#080c0f', s:'#0e1419', s2:'#121a21', s3:'#1a2530', b:'#1f2d38', cyan:'#00C8E0', txt:'#e8f0f5', mid:'#8ba0ae', muted:'#5a7080', green:'#00e09e', red:'#ff4d6a', yellow:'#ffc53d' }

const MDEFS = [
  { key:'spend',            label:'Total Spend',   ft:'eur' },
  { key:'conversion_value', label:'Conv. Value',   ft:'eur' },
  { key:'roas',             label:'ROAS',          ft:'x'   },
  { key:'conversions',      label:'Conversions',   ft:'num' },
  { key:'leads',            label:'Leads',         ft:'num' },
  { key:'clicks',           label:'Clicks',        ft:'num' },
  { key:'impressions',      label:'Impressions',   ft:'num' },
]

function fv(n:number, t:string) {
  const f = new Intl.NumberFormat('it-IT', { minimumFractionDigits:0, maximumFractionDigits:t==='x'?2:0 }).format(Number(n)||0)
  return t==='eur'?'€'+f:t==='x'?f+'x':f
}

function Modal({ title, onClose, children, wide=false }:any) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.8)' }} onClick={onClose}/>
      <div style={{ position:'relative', background:C.s, border:`1px solid ${C.b}`, borderRadius:'16px', width:'100%', maxWidth:wide?800:580, maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:`1px solid ${C.b}`, flexShrink:0 }}>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:'16px', fontWeight:700 }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'24px', lineHeight:1, padding:'0 4px' }}>×</button>
        </div>
        <div style={{ padding:'24px', overflowY:'auto', flex:1 }}>{children}</div>
      </div>
    </div>
  )
}

function Lbl({ children }:any) { return <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', color:C.muted, marginBottom:'7px' }}>{children}</div> }

function Dd({ value, onChange, children }:any) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:'100%', background:C.s3, border:`1px solid ${C.b}`, color:C.txt, padding:'9px 12px', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:'inherit' }}>{children}</select>
}

function Toggle({ checked, onChange }:any) {
  return (
    <div onClick={()=>onChange(!checked)} style={{ width:'16px', height:'16px', borderRadius:'4px', border:`2px solid ${checked?C.cyan:C.b}`, background:checked?C.cyan:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
      {checked&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="#080c0f" strokeWidth="1.8" strokeLinecap="round"/></svg>}
    </div>
  )
}

function MultiCheck({ items, checked, onChange }:{ items:{key:string,label:string}[], checked:string[], onChange:(v:string[])=>void }) {
  return (
    <div style={{ background:C.s3, border:`1px solid ${C.b}`, borderRadius:'8px', padding:'8px 12px' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', padding:'5px 0', borderBottom:`1px solid ${C.b}`, marginBottom:'6px' }}>
        <Toggle checked={checked.length===items.length} onChange={(v:boolean)=>onChange(v?items.map(i=>i.key):[])}/>
        <span style={{ fontSize:'12px', color:C.mid, fontWeight:600 }}>Select all</span>
      </label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px' }}>
        {items.map(item=>(
          <label key={item.key} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', padding:'4px 0' }}>
            <Toggle checked={checked.includes(item.key)} onChange={(v:boolean)=>onChange(v?[...checked,item.key]:checked.filter(k=>k!==item.key))}/>
            <span style={{ fontSize:'12px', color:C.txt }}>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function PeriodSel({ value, onChange }:any) {
  return (
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
      {[['today','Today'],['week','Last 7 days'],['month','This month'],['custom','Custom']].map(([v,l])=>(
        <button key={v} onClick={()=>onChange(v)} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', border:`1px solid ${value===v?C.cyan:C.b}`, background:value===v?'rgba(0,200,224,0.1)':C.s3, color:value===v?C.cyan:C.muted }}>
          {l}
        </button>
      ))}
    </div>
  )
}

export default function ReportsClient({ reports:initR, clients:initC, isAdmin:initIsAdmin }:Props) {
  const sb = createClient()
  const [tab, setTab] = useState<'reports'|'schedule'>('reports')
  const [reports, setReports] = useState(initR)
  const [clients, setClients] = useState(initC)
  const [isAdmin, setIsAdmin] = useState(initIsAdmin) // ✅ tracked in state
  const [busy, setBusy] = useState(initC.length===0)

  // builder
  const [showB, setShowB] = useState(false)
  const [step, setStep] = useState<'cfg'|'preview'>('cfg')
  const [bClient, setBClient] = useState(initC[0]?.id||'')
  const [bPlat, setBPlat] = useState('all')
  const [bPeriod, setBPeriod] = useState('week')
  const [bStart, setBStart] = useState('')
  const [bEnd, setBEnd] = useState('')
  const [bAccs, setBAccs] = useState<string[]>([])
  const [bMets, setBMets] = useState<string[]>(['spend','conversions','roas','leads'])
  const [availAccs, setAvailAccs] = useState<string[]>([])
  const [genBusy, setGenBusy] = useState(false)
  const [rdata, setRdata] = useState<any>(null)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ok:boolean,txt:string}|null>(null)

  // schedules
  const [scheds, setScheds] = useState<any[]>([])
  const [showSM, setShowSM] = useState(false)
  const [sClient, setSClient] = useState(initC[0]?.id||'')
  const [sPlat, setSPlat] = useState('all')
  const [sPeriod, setSPeriod] = useState('week')
  const [sAccs, setSAccs] = useState<string[]>([])
  const [sMets, setSMets] = useState<string[]>(['spend','conversions','roas','leads'])
  const [sFreq, setSFreq] = useState('weekly')
  const [sDay, setSDay] = useState('1')
  const [sHour, setSHour] = useState('09')
  const [sEmail, setSEmail] = useState('')
  const [savingS, setSavingS] = useState(false)
  const [sAccAvail, setSAccAvail] = useState<string[]>([])

  // ✅ Client-side fallback — also detects isAdmin from session
  useEffect(() => {
    async function go() {
      const { data:{session} } = await sb.auth.getSession()
      if (!session) { setBusy(false); return }

      // Always re-check role from DB (fixes server-side auth cookie issue)
      const { data:p } = await sb.from('profiles').select('role').eq('id',session.user.id).single()
      const detectedAdmin = p?.role === 'admin'
      setIsAdmin(detectedAdmin)

      // If server already loaded data, just update isAdmin and stop
      if (initC.length > 0) { setBusy(false); return }

      let cl:any[]=[]
      if (detectedAdmin) {
        const { data } = await sb.from('clients').select('id,name,email').order('name')
        cl=data||[]
      } else {
        const { data } = await sb.from('clients').select('id,name,email').eq('user_id',session.user.id)
        cl=data||[]
      }
      setClients(cl)
      if (cl[0]) { setBClient(cl[0].id); setSClient(cl[0].id); setSEmail(cl[0].email||'') }
      const { data:r } = await sb.from('reports').select('*,clients(name)').order('created_at',{ascending:false})
      setReports(r||[])
      const { data:s } = await sb.from('report_schedules').select('*,clients(name)').order('created_at',{ascending:false})
      setScheds(s||[])
      setBusy(false)
    }
    go()
  }, [])

  // load schedules when tab switches
  useEffect(() => {
    if (tab!=='schedule' || !isAdmin) return
    sb.from('report_schedules').select('*,clients(name)').order('created_at',{ascending:false}).then(({data})=>setScheds(data||[]))
  }, [tab, isAdmin])

  useEffect(() => {
    if (!bClient) return
    sb.from('metrics_cache').select('account_name').eq('client_id',bClient).not('account_name','is',null).then(({data})=>{
      const a=Array.from(new Set((data||[]).map((d:any)=>d.account_name).filter(Boolean))) as string[]
      setAvailAccs(a); setBAccs(a)
    })
  }, [bClient])

  useEffect(() => {
    if (!sClient) return
    sb.from('metrics_cache').select('account_name').eq('client_id',sClient).not('account_name','is',null).then(({data})=>{
      const a=Array.from(new Set((data||[]).map((d:any)=>d.account_name).filter(Boolean))) as string[]
      setSAccAvail(a); setSAccs(a)
    })
  }, [sClient])

  useEffect(() => {
    if (clients.length>0 && !bClient) { setBClient(clients[0].id); setSClient(clients[0].id); setSEmail(clients[0].email||'') }
  }, [clients])

  function getRange() {
    const e=new Date(), s=new Date()
    if (bPeriod==='today') s.setHours(0,0,0,0)
    else if (bPeriod==='week') s.setDate(s.getDate()-7)
    else if (bPeriod==='month') s.setDate(1)
    else return { start:bStart, end:bEnd }
    return { start:s.toISOString().split('T')[0], end:e.toISOString().split('T')[0] }
  }

  async function generate() {
    if (!bClient) return
    setGenBusy(true); setSendMsg(null)
    const { start, end } = getRange()
    let q = sb.from('metrics_cache').select('*').eq('client_id',bClient).gte('date',start).lte('date',end)
    if (bPlat!=='all') q=q.eq('platform',bPlat)
    const { data:rows } = await q
    const filtered = (rows||[]).filter((m:any)=>bAccs.length===0||bAccs.includes(m.account_name))
    const tot:any={spend:0,conversion_value:0,conversions:0,leads:0,clicks:0,impressions:0}
    const byDate:any={}, byPlat:any={}
    filtered.forEach((m:any)=>{
      tot.spend+=Number(m.spend||0); tot.conversion_value+=Number(m.conversion_value||0)
      tot.conversions+=Number(m.conversions||0); tot.leads+=Number(m.leads||0)
      tot.clicks+=Number(m.clicks||0); tot.impressions+=Number(m.impressions||0)
      if (!byDate[m.date]) byDate[m.date]={date:m.date,spend:0,conversions:0}
      byDate[m.date].spend+=Number(m.spend||0); byDate[m.date].conversions+=Number(m.conversions||0)
      const p=m.platform
      if (!byPlat[p]) byPlat[p]={spend:0,conversion_value:0,conversions:0,leads:0,clicks:0,impressions:0}
      byPlat[p].spend+=Number(m.spend||0); byPlat[p].conversion_value+=Number(m.conversion_value||0)
      byPlat[p].conversions+=Number(m.conversions||0); byPlat[p].leads+=Number(m.leads||0)
    })
    tot.roas=tot.spend>0?tot.conversion_value/tot.spend:0
    const cl=clients.find(c=>c.id===bClient)
    const d={ client:cl, totals:tot, byDate:Object.values(byDate).sort((a:any,b:any)=>a.date.localeCompare(b.date)), byPlatform:byPlat, selMetrics:bMets, start, end, generatedAt:new Date().toISOString() }
    const { data:saved } = await sb.from('reports').insert({ client_id:bClient, report_type:'custom', period_start:start, period_end:end, status:'generated', report_data:d }).select('id').single()
    const { data:r } = await sb.from('reports').select('*,clients(name)').order('created_at',{ascending:false})
    setReports(r||[]); setRdata({ ...d, reportId:saved?.id }); setStep('preview'); setGenBusy(false)
  }

  async function sendEmail() {
    if (!rdata) return
    setSendBusy(true); setSendMsg(null)
    try {
      const res = await fetch('/api/reports/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ clientId:rdata.client?.id, reportId:rdata.reportId, reportData:rdata })
      })
      const j = await res.json()
      if (j.error) setSendMsg({ ok:false, txt:'Error: '+j.error })
      else {
        setSendMsg({ ok:true, txt:`✓ Sent to ${rdata.client?.email}` })
        const { data:r } = await sb.from('reports').select('*,clients(name)').order('created_at',{ascending:false})
        setReports(r||[])
      }
    } catch(e:any) { setSendMsg({ ok:false, txt:'Error: '+e.message }) }
    setSendBusy(false)
  }

  async function saveSched() {
    if (!sClient||!sEmail) return
    setSavingS(true)
    const cl=clients.find(c=>c.id===sClient)
    const { data:s } = await sb.from('report_schedules').insert({
      client_id:sClient, client_name:cl?.name, accounts:sAccs, metrics:sMets,
      platform:sPlat, frequency:sFreq, day:sDay, hour:sHour,
      recipient_email:sEmail, report_period:sPeriod, active:true
    }).select().single()
    if (s) setScheds(prev=>[{ ...s, clients:{ name:cl?.name } }, ...prev])
    setSavingS(false); setShowSM(false)
  }

  async function delSched(id:string) {
    await sb.from('report_schedules').delete().eq('id',id)
    setScheds(prev=>prev.filter(s=>s.id!==id))
  }

  function exportExcel() {
    if (!rdata) return
    const rows:any[][]=[[`Report: ${rdata.client?.name}`],[`Period: ${rdata.start} → ${rdata.end}`],[],[`SUMMARY`],['Metric','Value']]
    MDEFS.filter(m=>rdata.selMetrics.includes(m.key)).forEach(m=>{ const v=m.key==='roas'?rdata.totals.roas:(rdata.totals[m.key]||0); rows.push([m.label,fv(v,m.ft)]) })
    rows.push([],['PLATFORM BREAKDOWN'],['Platform',...MDEFS.filter(m=>rdata.selMetrics.includes(m.key)).map(m=>m.label)])
    Object.entries(rdata.byPlatform||{}).forEach(([p,pd]:any)=>{ rows.push([p,...MDEFS.filter(m=>rdata.selMetrics.includes(m.key)).map(m=>{ const v=m.key==='roas'?(pd.spend>0?pd.conversion_value/pd.spend:0):(pd[m.key]||0); return fv(v,m.ft) })]) })
    rows.push([],['DAILY DATA'],['Date','Spend','Conversions'])
    ;(rdata.byDate||[]).forEach((d:any)=>rows.push([d.date,fv(d.spend,'eur'),fv(d.conversions,'num')]))
    const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=`${rdata.client?.name}-${rdata.start}.csv`; a.click()
  }

  if (busy) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
      <style dangerouslySetInnerHTML={{ __html:'@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}' }}/>
      <div style={{ display:'flex',gap:'8px' }}><div className="ld"/><div className="ld"/><div className="ld"/></div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:C.s, borderBottom:`1px solid ${C.b}`, padding:'0 28px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:'Syne, sans-serif', fontSize:'20px', fontWeight:700 }}>Reports</div>
          <div style={{ fontSize:'12px', color:C.muted }}>Generate, view and schedule performance reports</div>
        </div>
        <button onClick={()=>{ setStep('cfg'); setRdata(null); setSendMsg(null); setShowB(true) }}
          style={{ background:C.cyan, color:C.bg, border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Syne, sans-serif' }}>
          + New Report
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background:C.s, borderBottom:`1px solid ${C.b}`, padding:'0 28px', display:'flex', flexShrink:0 }}>
        <button onClick={()=>setTab('reports')} style={{ padding:'12px 18px', background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:tab==='reports'?700:500, color:tab==='reports'?C.cyan:C.muted, borderBottom:`2px solid ${tab==='reports'?C.cyan:'transparent'}`, marginBottom:'-1px' }}>
          📊 Reports
        </button>
        {/* ✅ Always show schedule tab for admin — isAdmin now detected client-side too */}
        {isAdmin && (
          <button onClick={()=>setTab('schedule')} style={{ padding:'12px 18px', background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:tab==='schedule'?700:500, color:tab==='schedule'?C.cyan:C.muted, borderBottom:`2px solid ${tab==='schedule'?C.cyan:'transparent'}`, marginBottom:'-1px' }}>
            ⏰ Scheduled Reports
          </button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        {/* ── REPORTS TAB ── */}
        {tab==='reports' && (
          reports.length===0 ? (
            <div style={{ background:C.s2, border:`1px solid ${C.b}`, borderRadius:'12px', padding:'60px', textAlign:'center' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>📊</div>
              <div style={{ fontFamily:'Syne, sans-serif', fontSize:'18px', fontWeight:700, marginBottom:'8px' }}>No reports yet</div>
              <div style={{ color:C.muted, fontSize:'14px', marginBottom:'24px' }}>Click "+ New Report" to generate your first report</div>
              <button onClick={()=>{ setStep('cfg'); setRdata(null); setShowB(true) }} style={{ background:C.cyan, color:C.bg, border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>+ New Report</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {reports.map((r:any)=>(
                <div key={r.id} style={{ background:C.s2, border:`1px solid ${C.b}`, borderRadius:'12px', padding:'14px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'9px', background:'rgba(0,200,224,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>📊</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:'14px' }}>{r.clients?.name||'Report'}</div>
                    <div style={{ fontSize:'12px', color:C.muted }}>{r.period_start} → {r.period_end} · {new Date(r.created_at).toLocaleDateString('it-IT')}</div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:'100px', fontSize:'11px', fontWeight:600, background:r.status==='sent'?'rgba(0,224,158,0.15)':'rgba(0,200,224,0.08)', color:r.status==='sent'?C.green:C.cyan }}>{r.status}</span>
                  {r.report_data && (
                    <button onClick={()=>{ setRdata({ ...r.report_data, reportId:r.id }); setStep('preview'); setSendMsg(null); setShowB(true) }}
                      style={{ padding:'6px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'transparent', border:`1px solid ${C.b}`, color:C.mid }}>
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── SCHEDULE TAB ── */}
        {tab==='schedule' && isAdmin && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div style={{ fontSize:'14px', color:C.muted }}>Schedules are saved. Connect a cron job at <strong style={{ color:C.mid }}>cron-job.org</strong> → <code style={{ fontSize:'12px', background:C.s3, padding:'2px 6px', borderRadius:'4px' }}>/api/reports/auto</code> to trigger sending.</div>
              <button onClick={()=>setShowSM(true)} style={{ background:C.cyan, color:C.bg, border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, marginLeft:'16px' }}>+ Add Schedule</button>
            </div>
            {scheds.length===0 ? (
              <div style={{ background:C.s2, border:`1px solid ${C.b}`, borderRadius:'12px', padding:'60px', textAlign:'center' }}>
                <div style={{ fontSize:'48px', marginBottom:'16px' }}>⏰</div>
                <div style={{ fontFamily:'Syne, sans-serif', fontSize:'18px', fontWeight:700, marginBottom:'8px' }}>No scheduled reports</div>
                <div style={{ color:C.muted, fontSize:'14px' }}>Schedule automatic report delivery to clients</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {scheds.map((s:any)=>(
                  <div key={s.id} style={{ background:C.s2, border:`1px solid ${C.b}`, borderRadius:'12px', padding:'14px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'9px', background:'rgba(168,85,247,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>⏰</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'14px' }}>{s.clients?.name||s.client_name}</div>
                      <div style={{ fontSize:'12px', color:C.muted }}>
                        {s.frequency==='daily'?`Daily`
                          :s.frequency==='weekly'?`Every week on ${['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][Number(s.day)]||'day '+s.day}`
                          :`Monthly on day ${s.day}`} at {s.hour}:00 · to {s.recipient_email}
                      </div>
                      <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                        {s.platform==='all'?'All platforms':s.platform} · {s.report_period} · {(s.metrics||[]).join(', ')}
                      </div>
                    </div>
                    <span style={{ padding:'3px 10px', borderRadius:'100px', fontSize:'11px', fontWeight:600, background:s.active?'rgba(0,224,158,0.12)':'rgba(90,112,128,0.12)', color:s.active?C.green:C.muted }}>{s.active?'Active':'Paused'}</span>
                    <button onClick={()=>delSched(s.id)} style={{ padding:'6px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'rgba(255,77,106,0.08)', border:`1px solid rgba(255,77,106,0.25)`, color:C.red }}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── BUILDER MODAL ── */}
      {showB && (
        <Modal title={step==='cfg'?'New Report':'Report Preview'} onClose={()=>setShowB(false)} wide={step==='preview'}>
          {step==='cfg' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {isAdmin && <div><Lbl>Client</Lbl><Dd value={bClient} onChange={setBClient}>{clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</Dd></div>}
              <div><Lbl>Time Period</Lbl><PeriodSel value={bPeriod} onChange={setBPeriod}/>
                {bPeriod==='custom'&&(
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginTop:'10px' }}>
                    <div><Lbl>From</Lbl><input type="date" value={bStart} onChange={e=>setBStart(e.target.value)} style={{ width:'100%', background:C.s3, border:`1px solid ${C.b}`, color:C.txt, padding:'9px 12px', borderRadius:'8px', fontSize:'13px', outline:'none' }}/></div>
                    <div><Lbl>To</Lbl><input type="date" value={bEnd} onChange={e=>setBEnd(e.target.value)} style={{ width:'100%', background:C.s3, border:`1px solid ${C.b}`, color:C.txt, padding:'9px 12px', borderRadius:'8px', fontSize:'13px', outline:'none' }}/></div>
                  </div>
                )}
              </div>
              <div><Lbl>Platform</Lbl><Dd value={bPlat} onChange={setBPlat}><option value="all">All Platforms</option><option value="google">Google Ads</option><option value="meta">Meta Ads</option></Dd></div>
              {availAccs.length>0&&<div><Lbl>Accounts</Lbl><MultiCheck items={availAccs.map(a=>({key:a,label:a}))} checked={bAccs} onChange={setBAccs}/></div>}
              <div><Lbl>Metrics to Include</Lbl><MultiCheck items={MDEFS} checked={bMets} onChange={setBMets}/></div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', paddingTop:'8px' }}>
                <button onClick={()=>setShowB(false)} style={{ padding:'9px 18px', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', background:'transparent', border:`1px solid ${C.b}`, color:C.mid }}>Cancel</button>
                <button onClick={generate} disabled={genBusy||bMets.length===0} style={{ padding:'9px 22px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer', background:C.cyan, color:C.bg, border:'none', opacity:genBusy?0.7:1, fontFamily:'Syne, sans-serif' }}>
                  {genBusy?'Generating…':'Generate Report →'}
                </button>
              </div>
            </div>
          )}

          {step==='preview'&&rdata&&(
            <div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'18px', flexWrap:'wrap', alignItems:'center' }}>
                <button onClick={()=>{ setStep('cfg'); setRdata(null); setSendMsg(null) }} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'transparent', border:`1px solid ${C.b}`, color:C.mid }}>← Edit</button>
                <div style={{ flex:1 }}/>
                <button onClick={exportExcel} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'rgba(0,224,158,0.08)', border:`1px solid rgba(0,224,158,0.3)`, color:C.green }}>⬇ Export Excel</button>
                <button onClick={()=>window.print()} style={{ padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', background:'rgba(0,200,224,0.08)', border:`1px solid rgba(0,200,224,0.3)`, color:C.cyan }}>🖨 Print / PDF</button>
                <button onClick={sendEmail} disabled={sendBusy} style={{ padding:'7px 16px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer', background:C.cyan, color:C.bg, border:'none', opacity:sendBusy?0.7:1, fontFamily:'Syne, sans-serif' }}>
                  {sendBusy?'Sending…':'✉ Send to Client'}
                </button>
              </div>

              {sendMsg&&(
                <div style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'13px', marginBottom:'14px', background:sendMsg.ok?'rgba(0,224,158,0.1)':'rgba(255,77,106,0.1)', border:`1px solid ${sendMsg.ok?'rgba(0,224,158,0.3)':'rgba(255,77,106,0.3)'}`, color:sendMsg.ok?C.green:C.red }}>
                  {sendMsg.txt}
                </div>
              )}

              {/* White paper preview */}
              <div style={{ background:'white', borderRadius:'12px', padding:'28px', color:'#1a1a2e' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', paddingBottom:'16px', borderBottom:'2px solid #00C8E0' }}>
                  <div>
                    <div style={{ fontFamily:'Syne, sans-serif', fontSize:'20px', fontWeight:800, color:'#080c0f' }}>Ads<span style={{ color:'#00C8E0' }}>Dash</span></div>
                    <div style={{ fontSize:'11px', color:'#5a7080' }}>by 360DigitalU</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'17px', fontWeight:700, color:'#080c0f' }}>{rdata.client?.name}</div>
                    <div style={{ fontSize:'12px', color:'#5a7080' }}>{rdata.start} → {rdata.end}</div>
                  </div>
                </div>

                <div style={{ marginBottom:'18px' }}>
                  <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#5a7080', marginBottom:'10px' }}>Performance Summary</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                    {MDEFS.filter(m=>rdata.selMetrics.includes(m.key)).map(m=>{
                      const v=m.key==='roas'?rdata.totals.roas:(rdata.totals[m.key]||0)
                      return <div key={m.key} style={{ background:'#f8fafb', borderRadius:'9px', padding:'14px', borderLeft:'3px solid #00C8E0' }}><div style={{ fontSize:'10px', color:'#5a7080', fontWeight:600, textTransform:'uppercase', marginBottom:'5px' }}>{m.label}</div><div style={{ fontSize:'19px', fontWeight:800, color:'#080c0f' }}>{fv(v,m.ft)}</div></div>
                    })}
                  </div>
                </div>

                {Object.keys(rdata.byPlatform||{}).length>0&&(
                  <div style={{ marginBottom:'18px' }}>
                    <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#5a7080', marginBottom:'10px' }}>Platform Breakdown</div>
                    <div style={{ display:'grid', gridTemplateColumns:`repeat(${Object.keys(rdata.byPlatform).length},1fr)`, gap:'10px' }}>
                      {Object.entries(rdata.byPlatform).map(([p,pd]:any)=>(
                        <div key={p} style={{ background:'#f8fafb', borderRadius:'9px', padding:'14px', borderLeft:`3px solid ${p==='google'?'#4285F4':'#1877F2'}` }}>
                          <div style={{ fontSize:'13px', fontWeight:700, marginBottom:'8px', color:p==='google'?'#4285F4':'#1877F2' }}>{p==='google'?'Google Ads':'Meta Ads'}</div>
                          {MDEFS.filter(m=>rdata.selMetrics.includes(m.key)).map(m=>{ const v=m.key==='roas'?(pd.spend>0?pd.conversion_value/pd.spend:0):(pd[m.key]||0); return <div key={m.key} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'3px 0', borderBottom:'1px solid #eef0f2' }}><span style={{ color:'#5a7080' }}>{m.label}</span><strong style={{ color:'#080c0f' }}>{fv(v,m.ft)}</strong></div> })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(rdata.byDate||[]).length>0&&(
                  <div>
                    <div style={{ fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#5a7080', marginBottom:'10px' }}>Daily Breakdown</div>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead><tr style={{ background:'#f0f2f5' }}>
                        <th style={{ padding:'7px 10px', textAlign:'left', fontWeight:600, color:'#5a7080' }}>Date</th>
                        <th style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, color:'#5a7080' }}>Spend</th>
                        <th style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, color:'#5a7080' }}>Conversions</th>
                      </tr></thead>
                      <tbody>
                        {rdata.byDate.map((d:any)=>(
                          <tr key={d.date} style={{ borderBottom:'1px solid #eef0f2' }}>
                            <td style={{ padding:'7px 10px' }}>{d.date}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fv(d.spend,'eur')}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right' }}>{fv(d.conversions,'num')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop:'20px', paddingTop:'12px', borderTop:'1px solid #eef0f2', display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#8ba0ae' }}>
                  <span>Generated by AdsDash · 360DigitalU</span>
                  <span>{new Date(rdata.generatedAt).toLocaleString('it-IT')}</span>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── SCHEDULE MODAL ── */}
      {showSM&&(
        <Modal title="New Scheduled Report" onClose={()=>setShowSM(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:'15px' }}>
            <div><Lbl>Client</Lbl><Dd value={sClient} onChange={(v:string)=>{ setSClient(v); setSEmail(clients.find((c:any)=>c.id===v)?.email||'') }}>{clients.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</Dd></div>
            <div><Lbl>Report covers</Lbl><Dd value={sPeriod} onChange={setSPeriod}><option value="day">Previous day</option><option value="week">Previous 7 days</option><option value="month">Previous month</option></Dd></div>
            <div><Lbl>Platform</Lbl><Dd value={sPlat} onChange={setSPlat}><option value="all">All Platforms</option><option value="google">Google Ads</option><option value="meta">Meta Ads</option></Dd></div>
            {sAccAvail.length>0&&<div><Lbl>Accounts</Lbl><MultiCheck items={sAccAvail.map(a=>({key:a,label:a}))} checked={sAccs} onChange={setSAccs}/></div>}
            <div><Lbl>Metrics</Lbl><MultiCheck items={MDEFS} checked={sMets} onChange={setSMets}/></div>
            <div><Lbl>Frequency</Lbl>
              <div style={{ display:'flex', gap:'8px' }}>
                {[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']].map(([v,l])=>(
                  <button key={v} onClick={()=>setSFreq(v)} style={{ flex:1, padding:'9px', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', border:`1px solid ${sFreq===v?C.cyan:C.b}`, background:sFreq===v?'rgba(0,200,224,0.1)':C.s3, color:sFreq===v?C.cyan:C.muted }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:sFreq==='daily'?'1fr':'1fr 1fr', gap:'12px' }}>
              {sFreq!=='daily'&&(
                <div><Lbl>{sFreq==='weekly'?'Day of Week':'Day of Month'}</Lbl>
                  <Dd value={sDay} onChange={setSDay}>
                    {sFreq==='weekly'
                      ?[['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday'],['6','Saturday'],['7','Sunday']].map(([v,l])=><option key={v} value={v}>{l}</option>)
                      :Array.from({length:28},(_,i)=><option key={i+1} value={String(i+1)}>Day {i+1}</option>)
                    }
                  </Dd>
                </div>
              )}
              <div><Lbl>Send at</Lbl><Dd value={sHour} onChange={setSHour}>{Array.from({length:24},(_,i)=>{ const h=String(i).padStart(2,'0'); return <option key={h} value={h}>{h}:00</option> })}</Dd></div>
            </div>
            <div><Lbl>Recipient Email</Lbl>
              <input value={sEmail} onChange={e=>setSEmail(e.target.value)} type="email" placeholder="client@company.com"
                style={{ width:'100%', background:C.s3, border:`1px solid ${C.b}`, color:C.txt, padding:'9px 12px', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:'inherit' }}/>
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={()=>setShowSM(false)} style={{ padding:'9px 18px', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', background:'transparent', border:`1px solid ${C.b}`, color:C.mid }}>Cancel</button>
              <button onClick={saveSched} disabled={savingS||!sEmail} style={{ padding:'9px 22px', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer', background:C.cyan, color:C.bg, border:'none', opacity:savingS?0.7:1, fontFamily:'Syne, sans-serif' }}>
                {savingS?'Saving…':'Save Schedule'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}