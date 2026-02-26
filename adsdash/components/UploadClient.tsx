'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clients: any[]
  adAccounts: any[]
}

export default function UploadClient({ clients, adAccounts: initialAccounts }: Props) {
  const [adAccounts, setAdAccounts] = useState(initialAccounts)
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [platform, setPlatform] = useState<'google' | 'meta'>('google')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [newAccountName, setNewAccountName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Manual entry state
  const [manualMode, setManualMode] = useState<'daily' | 'range'>('daily')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [rangeData, setRangeData] = useState({ spend: '', conversion_value: '', conversions: '', leads: '' })
  const [manualRows, setManualRows] = useState([
    { date: '', spend: '', conversion_value: '', conversions: '', leads: '' }
  ])

  // CSV state
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [csvStep, setCsvStep] = useState<'setup' | 'map' | 'done'>('setup')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const filteredAccounts = adAccounts.filter(a => a.client_id === clientId && a.platform === platform)

  // Also track locally created accounts during this session
  const [localAccounts, setLocalAccounts] = useState<{id: string, account_name: string, client_id: string, platform: string}[]>([])
  const allFilteredAccounts = [
    ...filteredAccounts,
    ...localAccounts.filter(a => a.client_id === clientId && a.platform === platform)
  ]

  // When client/platform changes, reset account selection
  function handleClientChange(id: string) {
    setClientId(id)
    setSelectedAccountId('')
    setNewAccountName('')
  }
  function handlePlatformChange(p: string) {
    setPlatform(p as any)
    setSelectedAccountId('')
    setNewAccountName('')
  }

  async function resolveAccountName(): Promise<string | null> {
    if (selectedAccountId && selectedAccountId !== 'new') {
      const acc = adAccounts.find(a => a.id === selectedAccountId)
      return acc?.account_name || null
    }
    if (selectedAccountId === 'new' || !selectedAccountId) {
      const name = newAccountName.trim()
      if (!name) { setError('Please enter a name for the account.'); return null }
      // Create new ad_account record via API route to bypass RLS
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, platform, account_name: name }),
      })
      if (!res.ok) {
        // If API doesn't exist yet, just use the name directly
      }
      // Optimistically add to local state
      setAdAccounts(prev => [...prev, { id: Date.now().toString(), client_id: clientId, platform, account_name: name, is_active: true }])
      setSelectedAccountId('')
      setNewAccountName('')
      return name
    }
    return null
  }

  function getAccountName(): string {
    if (selectedAccountId && selectedAccountId !== 'new') {
      const acc = [...adAccounts, ...localAccounts].find(a => a.id === selectedAccountId)
      return acc?.account_name || 'Default'
    }
    const name = newAccountName.trim() || 'Manual Entry'
    // Add to local accounts so it appears in dropdown for next import
    const newId = `local-${Date.now()}`
    setLocalAccounts(prev => [...prev, { id: newId, account_name: name, client_id: clientId, platform }])
    setSelectedAccountId(newId)
    setNewAccountName('')
    return name
  }

  async function submitRange() {
    if (!rangeStart || !rangeEnd) { setError('Please select a start and end date.'); return }
    if (!rangeData.spend) { setError('Please enter the spend amount.'); return }
    const start = new Date(rangeStart)
    const end = new Date(rangeEnd)
    if (start > end) { setError('Start date must be before end date.'); return }

    setLoading(true); setError(''); setSuccess('')
    try {
      const accountName = getAccountName()
      // Distribute totals evenly across days
      const days: string[] = []
      const cur = new Date(start)
      while (cur <= end) {
        days.push(cur.toISOString().split('T')[0])
        cur.setDate(cur.getDate() + 1)
      }
      const n = days.length
      const records = days.map(date => ({
        client_id: clientId, platform, account_name: accountName, date,
        spend: Math.round((parseFloat(rangeData.spend) / n) * 100) / 100,
        conversion_value: Math.round((parseFloat(rangeData.conversion_value || '0') / n) * 100) / 100,
        conversions: Math.round(parseFloat(rangeData.conversions || '0') / n * 10) / 10,
        leads: Math.round(parseFloat(rangeData.leads || '0') / n * 10) / 10,
        impressions: 0, clicks: 0,
      }))

      const { error: err } = await supabase.from('metrics_cache')
        .upsert(records, { onConflict: 'client_id,platform,date,account_name' })
      if (err) throw new Error(err.message)
      setSuccess(`✅ Data spread across ${n} days (${rangeStart} → ${rangeEnd}) saved!`)
      setRangeData({ spend: '', conversion_value: '', conversions: '', leads: '' })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function addRow() {
    setManualRows(prev => [...prev, { date: '', spend: '', conversion_value: '', conversions: '', leads: '' }])
  }
  function removeRow(i: number) {
    setManualRows(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, field: string, val: string) {
    setManualRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function submitManual() {
    if (!clientId) { setError('Please select a client.'); return }
    const validRows = manualRows.filter(r => r.date && r.spend)
    if (!validRows.length) { setError('Please fill in at least one row with date and spend.'); return }

    setLoading(true); setError(''); setSuccess('')
    try {
      const accountName = getAccountName()
      const records = validRows.map(r => ({
        client_id: clientId,
        platform,
        account_name: accountName,
        date: r.date,
        spend: parseFloat(r.spend) || 0,
        conversion_value: parseFloat(r.conversion_value) || 0,
        conversions: parseFloat(r.conversions) || 0,
        leads: parseFloat(r.leads) || 0,
        impressions: 0,
        clicks: 0,
      }))

      const { error: err } = await supabase
        .from('metrics_cache')
        .upsert(records, { onConflict: 'client_id,platform,date,account_name' })

      if (err) throw new Error(err.message)

      setSuccess(`✅ ${records.length} day${records.length > 1 ? 's' : ''} saved successfully!`)
      setManualRows([{ date: '', spend: '', conversion_value: '', conversions: '', leads: '' }])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── CSV IMPORT ──
  function autoDetect(cols: string[]): Record<string, string> {
    const map: Record<string, string> = {}
    const lower = cols.map(c => c.toLowerCase().trim())
    const matchers: Record<string, string[]> = {
      date: ['day', 'date', 'data'],
      spend: ['cost', 'spend', 'amount spent', 'costo', 'importo speso', 'cost (eur)', 'cost (usd)'],
      impressions: ['impressions', 'impr.', 'impressioni'],
      clicks: ['clicks', 'link clicks', 'clic'],
      conversions: ['conversions', 'conv.', 'conversioni', 'results', 'purchases'],
      leads: ['leads', 'lead', 'form leads'],
      conversion_value: ['conv. value', 'conversion value', 'valore conv.', 'purchase value', 'revenue'],
    }
    for (const [field, patterns] of Object.entries(matchers)) {
      for (const pattern of patterns) {
        const idx = lower.findIndex(c => c.includes(pattern))
        if (idx !== -1) { map[field] = cols[idx]; break }
      }
    }
    return map
  }

  function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    function parseLine(line: string): string[] {
      const result: string[] = []; let current = ''; let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes }
        else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += line[i] }
      }
      result.push(current.trim()); return result
    }
    const headers = parseLine(lines[0])
    const rows = lines.slice(1).map(line => {
      const vals = parseLine(line); const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    }).filter(row => Object.values(row).some(v => v !== ''))
    return { headers, rows }
  }

  function parseNumber(val: string): number {
    if (!val) return 0
    let v = val.replace(/[€$£\s%]/g, '').trim()
    // Detect format: if has comma and dot, figure out which is decimal
    if (v.includes(',') && v.includes('.')) {
      const lastComma = v.lastIndexOf(',')
      const lastDot = v.lastIndexOf('.')
      if (lastComma > lastDot) {
        // Italian: 1.234,56
        v = v.replace(/\./g, '').replace(',', '.')
      } else {
        // English: 1,234.56
        v = v.replace(/,/g, '')
      }
    } else if (v.includes(',')) {
      // Could be decimal comma: 58,46 or thousands: 1,234
      const parts = v.split(',')
      if (parts[parts.length - 1].length <= 2) {
        // Decimal comma: 58,46 → 58.46
        v = v.replace(',', '.')
      } else {
        // Thousands comma: 1,234 → 1234
        v = v.replace(/,/g, '')
      }
    }
    return parseFloat(v) || 0
  }

  function parseDate(val: string): string {
    if (!val) return ''
    const t = val.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
      const p = t.split('/')
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    }
    const d = new Date(t)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return t
  }

  function handleFile(f: File) {
    setFile(f); setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (!headers.length) { setError('Could not parse CSV.'); return }
      setHeaders(headers); setPreview(rows.slice(0, 3)); setMapping(autoDetect(headers)); setCsvStep('map')
    }
    reader.readAsText(f)
  }

  async function submitCSV() {
    if (!mapping.date || !mapping.spend) { setError('Please map Date and Spend columns.'); return }
    setLoading(true); setError('')
    try {
      let accountName = ''
      if (selectedAccountId && selectedAccountId !== 'new') {
        const acc = adAccounts.find(a => a.id === selectedAccountId)
        accountName = acc?.account_name || 'Imported'
      } else {
        accountName = newAccountName.trim() || 'Imported'
      }

      const reader = new FileReader()
      const text = await new Promise<string>((res, rej) => {
        reader.onload = e => res(e.target?.result as string)
        reader.onerror = () => rej(new Error('Failed to read file'))
        reader.readAsText(file!)
      })
      const { rows } = parseCSV(text)
      const records = rows.map(row => ({
        client_id: clientId, platform, account_name: accountName,
        date: parseDate(row[mapping.date] || ''),
        spend: parseNumber(row[mapping.spend] || '0'),
        impressions: parseNumber(row[mapping.impressions] || '0'),
        clicks: parseNumber(row[mapping.clicks] || '0'),
        conversions: parseNumber(row[mapping.conversions] || '0'),
        leads: parseNumber(row[mapping.leads] || '0'),
        conversion_value: parseNumber(row[mapping.conversion_value] || '0'),
      })).filter(r => r.date && r.date.length === 10)

      if (!records.length) { setError('No valid rows found.'); setLoading(false); return }

      for (let i = 0; i < records.length; i += 100) {
        const { error: err } = await supabase.from('metrics_cache')
          .upsert(records.slice(i, i + 100), { onConflict: 'client_id,platform,date,account_name' })
        if (err) throw new Error(err.message)
      }
      setCsvStep('done')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { fontSize: '13px', padding: '8px 10px', background: 'var(--surface3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', outline: 'none', width: '100%', fontFamily: 'inherit' }

  // Shared account picker — dropdown for existing + input for new
  function AccountPicker() {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Ad Account</div>
        <select
          value={selectedAccountId}
          onChange={e => { setSelectedAccountId(e.target.value); if (e.target.value !== 'new') setNewAccountName('') }}
          style={{ marginBottom: selectedAccountId === 'new' ? '10px' : '0' }}
        >
          <option value="">— Select account —</option>
          {allFilteredAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.account_name}</option>
          ))}
          <option value="new">＋ Create new account...</option>
        </select>
        {selectedAccountId === 'new' && (
          <input
            type="text"
            placeholder='Name this account e.g. "Search Campaigns"'
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
          />
        )}
        {allFilteredAccounts.length === 0 && selectedAccountId !== 'new' && selectedAccountId === '' && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            No accounts yet — select "＋ Create new account" to create one.
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Import Data</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add data manually or upload a CSV</div>
        </div>
        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          {[['manual', '✏️ Manual'], ['csv', '📂 CSV Import']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m as any); setError(''); setSuccess('') }}
              style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === m ? 'var(--cyan)' : 'transparent', color: mode === m ? '#080c0f' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Client + Platform — shown in both modes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client *</label>
              <select value={clientId} onChange={e => handleClientChange(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform *</label>
              <select value={platform} onChange={e => handlePlatformChange(e.target.value)}>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>
          </div>

          {/* Account picker */}
          <AccountPicker />

          {/* ── MANUAL MODE ── */}
          {mode === 'manual' && (
            <>
              {/* Daily vs Range toggle */}
              <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', alignSelf: 'flex-start' }}>
                {[['daily', '📅 By Day'], ['range', '📆 Date Range']].map(([m, label]) => (
                  <button key={m} onClick={() => { setManualMode(m as any); setError(''); setSuccess('') }}
                    style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: manualMode === m ? 'var(--cyan)' : 'transparent', color: manualMode === m ? '#080c0f' : 'var(--text-muted)' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* DATE RANGE mode */}
              {manualMode === 'range' && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Enter Monthly / Period Totals</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Totals will be evenly distributed across all days in the range</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Start Date *</label>
                      <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>End Date *</label>
                      <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { key: 'spend', label: 'Total Spend (€) *' },
                      { key: 'conversion_value', label: 'Total Conv. Value (€)' },
                      { key: 'conversions', label: 'Total Conversions' },
                      { key: 'leads', label: 'Total Leads' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{f.label}</label>
                        <input type="number" placeholder="0" step="0.01" value={(rangeData as any)[f.key]}
                          onChange={e => setRangeData(prev => ({ ...prev, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  {rangeStart && rangeEnd && rangeStart <= rangeEnd && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0,200,224,0.06)', border: '1px solid rgba(0,200,224,0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-mid)' }}>
                      ℹ️ Will create {Math.round((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 86400000) + 1} daily records
                    </div>
                  )}
                </div>
              )}

              {/* DAILY mode */}
              {manualMode === 'daily' && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>Enter Daily Metrics</div>
                  <button onClick={addRow} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.3)', color: 'var(--cyan)' }}>
                    ＋ Add row
                  </button>
                </div>

                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 32px', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface3)' }}>
                  {['Date', 'Spend (€)', 'Conv. Value (€)', 'Conversions', 'Leads', ''].map(h => (
                    <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                  ))}
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {manualRows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 32px', gap: '8px', padding: '10px 16px', borderBottom: i < manualRows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                      <input type="date" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)} style={{ ...inputStyle, padding: '7px 8px' }} />
                      <input type="number" placeholder="0.00" step="0.01" value={row.spend} onChange={e => updateRow(i, 'spend', e.target.value)} style={inputStyle} />
                      <input type="number" placeholder="0.00" step="0.01" value={row.conversion_value} onChange={e => updateRow(i, 'conversion_value', e.target.value)} style={inputStyle} />
                      <input type="number" placeholder="0" value={row.conversions} onChange={e => updateRow(i, 'conversions', e.target.value)} style={inputStyle} />
                      <input type="number" placeholder="0" value={row.leads} onChange={e => updateRow(i, 'leads', e.target.value)} style={inputStyle} />
                      <button onClick={() => removeRow(i)} disabled={manualRows.length === 1}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: manualRows.length === 1 ? 'transparent' : 'rgba(255,77,106,0.1)', color: manualRows.length === 1 ? 'var(--border)' : 'var(--red)', cursor: manualRows.length === 1 ? 'default' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}
              {success && <div style={{ background: 'rgba(0,224,158,0.1)', border: '1px solid rgba(0,224,158,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)' }}>{success}</div>}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {manualMode === 'daily' && (
                  <button onClick={addRow} style={{ padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                    ＋ Add row
                  </button>
                )}
                <button onClick={manualMode === 'daily' ? submitManual : submitRange} disabled={loading}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: loading ? 'var(--surface3)' : 'var(--cyan)', color: loading ? 'var(--text-muted)' : '#080c0f', border: 'none' }}>
                  {loading ? '⏳ Saving...' : '💾 Save Data →'}
                </button>
              </div>
            </>
          )}

          {/* ── CSV MODE ── */}
          {mode === 'csv' && csvStep === 'setup' && (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Upload CSV file</div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  style={{ border: `2px dashed ${dragging ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: '10px', padding: '28px 20px', textAlign: 'center', background: dragging ? 'rgba(0,200,224,0.05)' : 'transparent', transition: 'all 0.2s' }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Drop your CSV here</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    {platform === 'google' ? 'Google Ads → Campaigns → Download → CSV' : 'Meta Ads Manager → Export → CSV'}
                  </div>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'var(--surface3)', color: 'var(--text-mid)' }}>
                    Browse file
                  </button>
                  <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                </div>
                {file && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(0,224,158,0.08)', border: '1px solid rgba(0,224,158,0.2)', borderRadius: '8px', fontSize: '13px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✓ {file.name}
                  </div>
                )}
              </div>
              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}
            </>
          )}

          {mode === 'csv' && csvStep === 'map' && (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{file?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Map columns below</div>
                  </div>
                  <button onClick={() => setCsvStep('setup')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>← Back</button>
                </div>
                {[
                  { key: 'date', label: 'Date', required: true },
                  { key: 'spend', label: 'Spend', required: true },
                  { key: 'conversion_value', label: 'Conv. Value', required: false },
                  { key: 'conversions', label: 'Conversions', required: false },
                  { key: 'leads', label: 'Leads', required: false },
                  { key: 'impressions', label: 'Impressions', required: false },
                  { key: 'clicks', label: 'Clicks', required: false },
                ].map(f => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: f.required ? 'var(--text)' : 'var(--text-muted)' }}>
                      {f.label}{f.required && <span style={{ color: 'var(--cyan)', marginLeft: '4px' }}>*</span>}
                    </div>
                    <select value={mapping[f.key] || ''} onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}>
                      <option value="">— skip —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              {preview.length > 0 && mapping.date && mapping.spend && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>Preview (first 3 rows)</div>
                  <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '100%' }}>
                    <thead>
                      <tr>{['date', 'spend', 'conv. value', 'conversions', 'leads'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>{row[mapping.date]}</td>
                          <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)', color: 'var(--cyan)' }}>€{parseNumber(row[mapping.spend] || '0').toFixed(2)}</td>
                          <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>€{parseNumber(row[mapping.conversion_value] || '0').toFixed(2)}</td>
                          <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>{parseNumber(row[mapping.conversions] || '0')}</td>
                          <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--border)' }}>{parseNumber(row[mapping.leads] || '0')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>⚠ {error}</div>}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setCsvStep('setup')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>← Back</button>
                <button onClick={submitCSV} disabled={loading || !mapping.date || !mapping.spend}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: loading ? 'var(--surface3)' : 'var(--cyan)', color: loading ? 'var(--text-muted)' : '#080c0f', border: 'none' }}>
                  {loading ? '⏳ Importing...' : '⬆ Import Data →'}
                </button>
              </div>
            </>
          )}

          {mode === 'csv' && csvStep === 'done' && (
            <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Imported!</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>Data is now live in the dashboard.</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setCsvStep('setup'); setFile(null); setPreview([]); setMapping({}) }}
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                  Import another
                </button>
                <button onClick={() => window.location.href = `/dashboard?client=${clientId}`}
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
