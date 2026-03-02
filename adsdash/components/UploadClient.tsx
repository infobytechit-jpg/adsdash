'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clients: any[]
  adAccounts: any[]
}

export default function UploadClient({ clients: initialClients, adAccounts: initialAccounts }: Props) {
  const [clients, setClients] = useState(initialClients)
  const [adAccounts, setAdAccounts] = useState(initialAccounts)
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [clientId, setClientId] = useState(initialClients[0]?.id || '')
  const [platform, setPlatform] = useState<'google' | 'meta'>('google')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [newAccountName, setNewAccountName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manualMode, setManualMode] = useState<'daily' | 'range'>('daily')
  const [manualRows, setManualRows] = useState([{ date: '', spend: '', conversion_value: '', conversions: '', leads: '' }])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [rangeSpend, setRangeSpend] = useState('')
  const [rangeConvValue, setRangeConvValue] = useState('')
  const [rangeConversions, setRangeConversions] = useState('')
  const [rangeLeads, setRangeLeads] = useState('')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [csvStep, setCsvStep] = useState<'setup' | 'map' | 'done'>('setup')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Client-side fallback: if server didn't load clients/accounts (SSR auth issue), fetch via API route
  useEffect(() => {
    if (initialClients.length > 0) return // server loaded successfully, skip

    async function fetchData() {
      try {
        const res = await fetch('/api/upload/data')
        if (!res.ok) throw new Error('Failed to fetch upload data')
        const { clients: loadedClients, adAccounts: loadedAccounts } = await res.json()
        setClients(loadedClients || [])
        if (loadedClients?.length > 0) setClientId(loadedClients[0].id)
        setAdAccounts(loadedAccounts || [])
      } catch (e) {
        console.error('Failed to load upload data:', e)
      }
    }

    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAccounts = adAccounts.filter(a => a.client_id === clientId && a.platform === platform)

  function getAccountName(): string {
    if (selectedAccountId && selectedAccountId !== 'new')
      return adAccounts.find(a => a.id === selectedAccountId)?.account_name || 'Default'
    return newAccountName.trim() || 'Default'
  }

  function handleClientChange(id: string) { setClientId(id); setSelectedAccountId(''); setNewAccountName('') }
  function handlePlatformChange(p: string) { setPlatform(p as any); setSelectedAccountId(''); setNewAccountName('') }
  function addRow() { setManualRows(p => [...p, { date: '', spend: '', conversion_value: '', conversions: '', leads: '' }]) }
  function removeRow(i: number) { setManualRows(p => p.filter((_, idx) => idx !== i)) }
  function updateRow(i: number, field: string, val: string) { setManualRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r)) }

  function saveNewAccountLocally(name: string) {
    const na = { id: `local-${Date.now()}`, client_id: clientId, platform, account_name: name, is_active: true }
    setAdAccounts(p => [...p, na]); setSelectedAccountId(na.id); setNewAccountName('')
  }

  async function submitManual() {
    if (!clientId) { setError('Select a client.'); return }
    const rows = manualRows.filter(r => r.date && r.spend)
    if (!rows.length) { setError('Fill at least date and spend.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const accountName = getAccountName()
      const records = rows.map(r => ({
        client_id: clientId, platform, account_name: accountName, date: r.date,
        spend: parseFloat(r.spend) || 0, conversion_value: parseFloat(r.conversion_value) || 0,
        conversions: parseFloat(r.conversions) || 0, leads: parseFloat(r.leads) || 0,
        impressions: 0, clicks: 0,
      }))
      const { error: err } = await supabase.from('metrics_cache').upsert(records, { onConflict: 'client_id,platform,date,account_name' })
      if (err) throw new Error(err.message)
      if (selectedAccountId === 'new' && newAccountName.trim()) saveNewAccountLocally(newAccountName.trim())
      setSuccess('✅ ' + records.length + ' day' + (records.length > 1 ? 's' : '') + ' saved successfully!')
      setManualRows([{ date: '', spend: '', conversion_value: '', conversions: '', leads: '' }])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  async function submitRange() {
    if (!rangeStart || !rangeEnd) { setError('Select start and end dates.'); return }
    if (!rangeSpend) { setError('Enter spend amount.'); return }
    const start = new Date(rangeStart), end = new Date(rangeEnd)
    if (start > end) { setError('Start date must be before end date.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const accountName = getAccountName()
      const days: string[] = []; const cur = new Date(start)
      while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
      const n = days.length, r2 = (x: number) => Math.round(x * 100) / 100
      const records = days.map(date => ({
        client_id: clientId, platform, account_name: accountName, date,
        spend: r2(parseFloat(rangeSpend) / n), conversion_value: r2(parseFloat(rangeConvValue || '0') / n),
        conversions: r2(parseFloat(rangeConversions || '0') / n), leads: r2(parseFloat(rangeLeads || '0') / n),
        impressions: 0, clicks: 0,
      }))
      const { error: err } = await supabase.from('metrics_cache').upsert(records, { onConflict: 'client_id,platform,date,account_name' })
      if (err) throw new Error(err.message)
      if (selectedAccountId === 'new' && newAccountName.trim()) saveNewAccountLocally(newAccountName.trim())
      setSuccess('✅ ' + n + ' days saved (' + rangeStart + ' → ' + rangeEnd + ')')
      setRangeSpend(''); setRangeConvValue(''); setRangeConversions(''); setRangeLeads(''); setRangeStart(''); setRangeEnd('')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  function pNum(val: string): number {
    if (!val) return 0
    let v = val.replace(/[€$£\s%]/g, '').trim()
    if (v.includes(',') && v.includes('.')) {
      v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '')
    } else if (v.includes(',')) {
      v = v.split(',')[1]?.length <= 2 ? v.replace(',', '.') : v.replace(/,/g, '')
    }
    return parseFloat(v) || 0
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string, string>[] }
    const parseLine = (line: string) => {
      const r: string[] = []; let cur = ''; let q = false
      for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(cur.trim()); cur = '' } else cur += ch }
      r.push(cur.trim()); return r
    }
    const headers = parseLine(lines[0])
    const rows = lines.slice(1).map(l => {
      const v = parseLine(l); const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = v[i] || '' }); return row
    }).filter(r => Object.values(r).some(v => v !== ''))
    return { headers, rows }
  }

  function autoDetect(cols: string[]) {
    const map: Record<string, string> = {}
    const lower = cols.map(c => c.toLowerCase().trim())
    const m: Record<string, string[]> = {
      date: ['day', 'date', 'data'], spend: ['cost', 'spend', 'amount spent', 'costo', 'cost (eur)', 'cost (usd)'],
      impressions: ['impressions', 'impr.'], clicks: ['clicks', 'link clicks', 'clic'],
      conversions: ['conversions', 'conv.', 'results', 'purchases'], leads: ['leads', 'lead'],
      conversion_value: ['conv. value', 'conversion value', 'purchase value', 'revenue'],
    }
    for (const [field, patterns] of Object.entries(m)) {
      for (const p of patterns) { const idx = lower.findIndex(c => c.includes(p)); if (idx !== -1) { map[field] = cols[idx]; break } }
    }
    return map
  }

  function handleFile(f: File) {
    setFile(f); setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target?.result as string)
      if (!headers.length) { setError('Could not parse CSV.'); return }
      setHeaders(headers); setPreview(rows.slice(0, 3)); setMapping(autoDetect(headers)); setCsvStep('map')
    }
    reader.readAsText(f)
  }

  async function submitCSV() {
    if (!mapping.date || !mapping.spend) { setError('Map Date and Spend columns.'); return }
    setLoading(true); setError('')
    try {
      const accountName = getAccountName()
      const text = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.onerror = () => rej(new Error('Failed')); r.readAsText(file!) })
      const { rows } = parseCSV(text)
      const pDate = (val: string) => {
        const t = val.trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) { const p = t.split('/'); return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0') }
        const d = new Date(t); return isNaN(d.getTime()) ? t : d.toISOString().split('T')[0]
      }
      const records = rows.map(row => ({
        client_id: clientId, platform, account_name: accountName, date: pDate(row[mapping.date] || ''),
        spend: pNum(row[mapping.spend] || '0'), impressions: pNum(row[mapping.impressions] || '0'),
        clicks: pNum(row[mapping.clicks] || '0'), conversions: pNum(row[mapping.conversions] || '0'),
        leads: pNum(row[mapping.leads] || '0'), conversion_value: pNum(row[mapping.conversion_value] || '0'),
      })).filter(r => r.date && r.date.length === 10)
      if (!records.length) { setError('No valid rows found.'); setLoading(false); return }
      for (let i = 0; i < records.length; i += 100) {
        const { error: err } = await supabase.from('metrics_cache').upsert(records.slice(i, i+100), { onConflict: 'client_id,platform,date,account_name' })
        if (err) throw new Error(err.message)
      }
      if (selectedAccountId === 'new' && newAccountName.trim()) saveNewAccountLocally(newAccountName.trim())
      setCsvStep('done')
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const inp = { fontSize: '13px', padding: '7px 10px', background: 'var(--surface3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', outline: 'none', width: '100%', fontFamily: 'inherit' } as React.CSSProperties
  const rangeDays = rangeStart && rangeEnd && rangeStart <= rangeEnd ? Math.round((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 86400000) + 1 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700 }}>Import Data</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'none' }} className="desk-sub">Add data manually or upload a CSV</div>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
          {(['manual', 'csv'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === m ? 'var(--cyan)' : 'transparent', color: mode === m ? '#080c0f' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {m === 'manual' ? '✏️ Manual' : '📂 CSV'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Client + Platform — stack on mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client *</label>
              <select value={clientId} onChange={e => handleClientChange(e.target.value)} style={inp}>
                {clients.length === 0 && <option value="">Loading clients...</option>}
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform *</label>
              <select value={platform} onChange={e => handlePlatformChange(e.target.value)} style={inp}>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>
          </div>

          {/* Ad Account */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Ad Account</div>
            <select value={selectedAccountId} onChange={e => { setSelectedAccountId(e.target.value); if (e.target.value !== 'new') setNewAccountName('') }} style={inp}>
              <option value="">— Select or create account —</option>
              {filteredAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              <option value="new">＋ Create new account...</option>
            </select>
            {selectedAccountId === 'new' && (
              <input type="text" placeholder='Account name e.g. "Search Campaigns"'
                value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                style={{ ...inp, marginTop: '10px' }} />
            )}
          </div>

          {/* ── MANUAL MODE ── */}
          {mode === 'manual' && (
            <>
              {/* Daily / Range toggle */}
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', alignSelf: 'flex-start' }}>
                {(['daily', 'range'] as const).map(m => (
                  <button key={m} onClick={() => { setManualMode(m); setError(''); setSuccess('') }}
                    style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: manualMode === m ? 'var(--cyan)' : 'transparent', color: manualMode === m ? '#080c0f' : 'var(--text-muted)' }}>
                    {m === 'daily' ? '📅 By Day' : '📆 Range'}
                  </button>
                ))}
              </div>

              {/* Range mode */}
              {manualMode === 'range' && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Monthly / Period Totals</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Distributed evenly across all days</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Start Date *</label>
                      <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>End Date *</label>
                      <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} style={inp} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    {[['rangeSpend', rangeSpend, setRangeSpend, 'Total Spend (€) *', '0.00'],
                      ['rangeConvValue', rangeConvValue, setRangeConvValue, 'Conv. Value (€)', '0.00'],
                      ['rangeConversions', rangeConversions, setRangeConversions, 'Conversions', '0'],
                      ['rangeLeads', rangeLeads, setRangeLeads, 'Leads', '0']
                    ].map(([key, val, setter, label, placeholder]) => (
                      <div key={key as string}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{label as string}</label>
                        <input type="number" placeholder={placeholder as string} step="0.01" value={val as string} onChange={e => (setter as any)(e.target.value)} style={inp} />
                      </div>
                    ))}
                  </div>
                  {rangeDays > 0 && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0,200,224,0.06)', border: '1px solid rgba(0,200,224,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-mid)' }}>
                      ℹ️ {rangeDays} daily records ({rangeStart} → {rangeEnd})
                    </div>
                  )}
                </div>
              )}

              {/* Daily mode — card per row on mobile instead of table */}
              {manualMode === 'daily' && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Daily Metrics</div>
                    <button onClick={addRow} style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.3)', color: 'var(--cyan)' }}>＋ Add row</button>
                  </div>

                  {/* Desktop table view */}
                  <div style={{ display: 'none' }} className="desktop-table">
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 32px', gap: '8px', padding: '8px 16px', background: 'var(--surface3)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Spend (€)', 'Conv. Value (€)', 'Conversions', 'Leads', ''].map(h => (
                        <div key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                      ))}
                    </div>
                    {manualRows.map((row, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 32px', gap: '8px', padding: '8px 16px', borderBottom: i < manualRows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                        <input type="date" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)} style={{ ...inp, padding: '6px 8px' }} />
                        <input type="number" placeholder="0.00" step="0.01" value={row.spend} onChange={e => updateRow(i, 'spend', e.target.value)} style={inp} />
                        <input type="number" placeholder="0.00" step="0.01" value={row.conversion_value} onChange={e => updateRow(i, 'conversion_value', e.target.value)} style={inp} />
                        <input type="number" placeholder="0" value={row.conversions} onChange={e => updateRow(i, 'conversions', e.target.value)} style={inp} />
                        <input type="number" placeholder="0" value={row.leads} onChange={e => updateRow(i, 'leads', e.target.value)} style={inp} />
                        <button onClick={() => removeRow(i)} disabled={manualRows.length === 1}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: manualRows.length === 1 ? 'transparent' : 'rgba(255,77,106,0.1)', color: manualRows.length === 1 ? 'var(--border)' : 'var(--red)', cursor: manualRows.length === 1 ? 'default' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>

                  {/* ✅ Mobile card view — one card per row */}
                  <style>{`
                    @media(min-width:600px){.desktop-table{display:block!important;}.mobile-cards{display:none!important;}}
                    @media(max-width:599px){.desktop-table{display:none!important;}.mobile-cards{display:flex!important;}}
                  `}</style>
                  <div className="mobile-cards" style={{ flexDirection: 'column', gap: '0' }}>
                    {manualRows.map((row, i) => (
                      <div key={i} style={{ padding: '14px 16px', borderBottom: i < manualRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Row {i + 1}</div>
                          <button onClick={() => removeRow(i)} disabled={manualRows.length === 1}
                            style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: manualRows.length === 1 ? 'transparent' : 'rgba(255,77,106,0.1)', color: manualRows.length === 1 ? 'var(--border)' : 'var(--red)', cursor: manualRows.length === 1 ? 'default' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ gridColumn: '1/-1' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>DATE</label>
                            <input type="date" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)} style={inp} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>SPEND (€)</label>
                            <input type="number" placeholder="0.00" step="0.01" value={row.spend} onChange={e => updateRow(i, 'spend', e.target.value)} style={inp} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>CONV. VALUE (€)</label>
                            <input type="number" placeholder="0.00" step="0.01" value={row.conversion_value} onChange={e => updateRow(i, 'conversion_value', e.target.value)} style={inp} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>CONVERSIONS</label>
                            <input type="number" placeholder="0" value={row.conversions} onChange={e => updateRow(i, 'conversions', e.target.value)} style={inp} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>LEADS</label>
                            <input type="number" placeholder="0" value={row.leads} onChange={e => updateRow(i, 'leads', e.target.value)} style={inp} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}
              {success && <div style={{ background: 'rgba(0,224,158,0.1)', border: '1px solid rgba(0,224,158,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)' }}>{success}</div>}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {manualMode === 'daily' && (
                  <button onClick={addRow} style={{ padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>＋ Add row</button>
                )}
                <button onClick={manualMode === 'daily' ? submitManual : submitRange} disabled={loading}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: loading ? 'var(--surface3)' : 'var(--cyan)', color: loading ? 'var(--text-muted)' : '#080c0f', border: 'none', flex: 1, maxWidth: '200px' }}>
                  {loading ? '⏳ Saving...' : '💾 Save Data →'}
                </button>
              </div>
            </>
          )}

          {/* ── CSV MODE: SETUP ── */}
          {mode === 'csv' && csvStep === 'setup' && (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Upload CSV</div>
                <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  style={{ border: '2px dashed ' + (dragging ? 'var(--cyan)' : 'var(--border)'), borderRadius: '10px', padding: '28px 16px', textAlign: 'center', background: dragging ? 'rgba(0,200,224,0.05)' : 'transparent', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Drop your CSV here</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    {platform === 'google' ? 'Google Ads → Campaigns → Download → CSV' : 'Meta Ads Manager → Export → CSV'}
                  </div>
                  <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'var(--surface3)', color: 'var(--text-mid)' }}>Browse file</button>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                </div>
                {file && <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(0,224,158,0.08)', border: '1px solid rgba(0,224,158,0.2)', borderRadius: '8px', fontSize: '13px', color: 'var(--green)' }}>✓ {file.name}</div>}
              </div>
              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}
            </>
          )}

          {/* ── CSV MODE: MAP ── */}
          {mode === 'csv' && csvStep === 'map' && (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Map columns below</div>
                  </div>
                  <button onClick={() => setCsvStep('setup')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', flexShrink: 0 }}>← Back</button>
                </div>
                {[
                  {key:'date',label:'Date',req:true},
                  {key:'spend',label:'Spend',req:true},
                  {key:'conversion_value',label:'Conv. Value',req:false},
                  {key:'conversions',label:'Conversions',req:false},
                  {key:'leads',label:'Leads',req:false},
                  {key:'impressions',label:'Impressions',req:false},
                  {key:'clicks',label:'Clicks',req:false}
                ].map(f => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: f.req ? 'var(--text)' : 'var(--text-muted)' }}>
                      {f.label}{f.req && <span style={{ color: 'var(--cyan)', marginLeft: '4px' }}>*</span>}
                    </div>
                    <select value={mapping[f.key] || ''} onChange={e => setMapping(p => ({ ...p, [f.key]: e.target.value }))} style={inp}>
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {preview.length > 0 && mapping.date && mapping.spend && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>Preview</div>
                  <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '100%' }}>
                    <thead><tr>{['date','spend','conv. value','conversions','leads'].map(h=>(
                      <th key={h} style={{padding:'6px 10px',textAlign:'left',color:'var(--text-muted)',fontWeight:600,borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>{preview.map((row,i)=>(
                      <tr key={i}>
                        <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{row[mapping.date]}</td>
                        <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)',color:'var(--cyan)'}}>€{pNum(row[mapping.spend]||'0').toFixed(2)}</td>
                        <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)'}}>€{pNum(row[mapping.conversion_value]||'0').toFixed(2)}</td>
                        <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)'}}>{pNum(row[mapping.conversions]||'0')}</td>
                        <td style={{padding:'7px 10px',borderBottom:'1px solid var(--border)'}}>{pNum(row[mapping.leads]||'0')}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setCsvStep('setup')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>← Back</button>
                <button onClick={submitCSV} disabled={loading || !mapping.date || !mapping.spend}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: loading ? 'var(--surface3)' : 'var(--cyan)', color: loading ? 'var(--text-muted)' : '#080c0f', border: 'none' }}>
                  {loading ? '⏳ Importing...' : '⬆ Import →'}
                </button>
              </div>
            </>
          )}

          {/* ── CSV DONE ── */}
          {mode === 'csv' && csvStep === 'done' && (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Imported!</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px' }}>Data is live in the dashboard.</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setCsvStep('setup'); setFile(null); setPreview([]); setMapping({}) }}
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                  Import another
                </button>
                <button onClick={() => window.location.href = '/dashboard?client=' + clientId}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
                  View Dashboard →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}