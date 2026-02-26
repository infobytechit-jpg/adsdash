'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clients: any[]
  adAccounts: any[]
}

export default function UploadClient({ clients, adAccounts }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [platform, setPlatform] = useState<'google' | 'meta'>('google')
  const [selectedAccountId, setSelectedAccountId] = useState('new')
  const [newAccountName, setNewAccountName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload')
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const requiredFields = ['date', 'spend', 'impressions', 'clicks', 'conversions']
  const optionalFields = ['leads', 'conversion_value', 'cpc', 'ctr']

  // Filter accounts by selected client + platform
  const filteredAccounts = adAccounts.filter(a => a.client_id === clientId && a.platform === platform)

  function autoDetect(cols: string[]): Record<string, string> {
    const map: Record<string, string> = {}
    const lower = cols.map(c => c.toLowerCase().trim())
    const matchers: Record<string, string[]> = {
      date: ['day', 'date', 'data', 'week', 'month'],
      spend: ['cost', 'spend', 'amount spent', 'costo', 'importo speso', 'spesa', 'cost (eur)', 'cost (usd)', 'cost (gbp)'],
      impressions: ['impressions', 'impr.', 'impressioni'],
      clicks: ['clicks', 'link clicks', 'clic', 'click'],
      conversions: ['conversions', 'conv.', 'conversioni', 'results', 'purchases'],
      leads: ['leads', 'lead', 'form leads', 'lead form'],
      conversion_value: ['conv. value', 'conversion value', 'valore conv.', 'purchase value', 'revenue', 'conv. value (eur)'],
      cpc: ['avg. cpc', 'cpc', 'cost per click', 'cpc (eur)'],
      ctr: ['ctr', 'click-through rate'],
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
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes }
        else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += line[i] }
      }
      result.push(current.trim())
      return result
    }
    const headers = parseLine(lines[0])
    const rows = lines.slice(1).map(line => {
      const vals = parseLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    }).filter(row => Object.values(row).some(v => v !== ''))
    return { headers, rows }
  }

  function handleFile(f: File) {
    setFile(f); setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (!headers.length) { setError('Could not parse CSV.'); return }
      setHeaders(headers); setPreview(rows.slice(0, 3)); setMapping(autoDetect(headers)); setStep('map')
    }
    reader.readAsText(f)
  }

  function cleanNumber(val: string): number {
    if (!val) return 0
    return parseFloat(val.replace(/[€$£\s%]/g, '').replace(/\./g, '').replace(',', '.')) || 0
  }

  function cleanDate(val: string): string {
    if (!val) return ''
    const t = val.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) {
      const p = t.split('/');
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    }
    const d = new Date(t)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return t
  }

  function readFileAsText(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(f)
    })
  }

  async function uploadData() {
    if (!clientId) { setError('Please select a client.'); return }
    if (!mapping.date) { setError('Please map the Date column.'); return }
    if (!mapping.spend) { setError('Please map the Spend column.'); return }
    if (selectedAccountId === 'new' && !newAccountName.trim()) { setError('Please enter a name for the new account.'); return }

    setLoading(true); setError('')

    try {
      // Create new account if needed
      let accountName = newAccountName.trim()
      if (selectedAccountId !== 'new') {
        const acc = adAccounts.find(a => a.id === selectedAccountId)
        accountName = acc?.account_name || 'Default'
      } else {
        // Create the ad_account record
        const { error: accErr } = await supabase.from('ad_accounts').insert({
          client_id: clientId,
          platform,
          account_name: accountName,
          account_id: accountName,
          is_active: true,
        })
        if (accErr) throw new Error('Could not create account: ' + accErr.message)
      }

      const text = await readFileAsText(file!)
      const { rows } = parseCSV(text)

      const records = rows.map(row => ({
        client_id: clientId,
        platform,
        account_name: accountName,
        date: cleanDate(row[mapping.date] || ''),
        spend: cleanNumber(row[mapping.spend] || '0'),
        impressions: cleanNumber(row[mapping.impressions] || '0'),
        clicks: cleanNumber(row[mapping.clicks] || '0'),
        conversions: cleanNumber(row[mapping.conversions] || '0'),
        leads: cleanNumber(row[mapping.leads] || '0'),
        conversion_value: cleanNumber(row[mapping.conversion_value] || '0'),
      })).filter(r => r.date && r.date.length === 10)

      if (!records.length) { setError('No valid rows found. Check your date column.'); setLoading(false); return }

      const batchSize = 100
      for (let i = 0; i < records.length; i += batchSize) {
        const { error: err } = await supabase
          .from('metrics_cache')
          .upsert(records.slice(i, i + batchSize), { onConflict: 'client_id,platform,date,account_name' })
        if (err) throw new Error(err.message)
      }

      setStep('done')
    } catch (err: any) {
      setError(err.message || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const googleTemplate = `Date,Campaign,Impressions,Clicks,Cost (EUR),Conversions,Conv. value (EUR)
2024-01-15,Summer Sale,1200,45,38.50,3,150.00
2024-01-16,Summer Sale,980,38,31.20,2,100.00`

  const metaTemplate = `Day,Campaign name,Impressions,Link clicks,Amount spent,Results,Purchase value
2024-01-15,Brand Awareness,5400,120,45.00,8,320.00
2024-01-16,Brand Awareness,4800,98,39.50,6,240.00`

  function downloadTemplate() {
    const csv = platform === 'google' ? googleTemplate : metaTemplate
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${platform}-template.csv`; a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Import Data</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload CSV exports from Google Ads or Meta Ads</div>
        </div>
        <button onClick={downloadTemplate} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
          ⬇ Template
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>

          {/* Steps */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center' }}>
            {[['1', 'Setup'], ['2', 'Map Columns'], ['3', 'Done']].map(([num, label], i) => {
              const active = step === ['upload', 'map', 'done'][i]
              const done = (step === 'map' && i === 0) || (step === 'done' && i < 2)
              return (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: done ? 'var(--green)' : active ? 'var(--cyan)' : 'var(--surface3)', color: done || active ? '#080c0f' : 'var(--text-muted)', border: active ? 'none' : '1px solid var(--border)' }}>
                      {done ? '✓' : num}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? 'var(--text)' : 'var(--text-muted)' }}>{label}</span>
                  </div>
                  {i < 2 && <div style={{ width: '32px', height: '1px', background: 'var(--border)' }} />}
                </div>
              )
            })}
          </div>

          {step === 'upload' && (
            <>
              {/* Client + Platform */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client *</label>
                  <select value={clientId} onChange={e => { setClientId(e.target.value); setSelectedAccountId('new') }}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform *</label>
                  <select value={platform} onChange={e => { setPlatform(e.target.value as any); setSelectedAccountId('new') }}>
                    <option value="google">Google Ads</option>
                    <option value="meta">Meta Ads</option>
                  </select>
                </div>
              </div>

              {/* Account selector */}
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Which ad account is this data from?</div>

                {filteredAccounts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {filteredAccounts.map(a => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: selectedAccountId === a.id ? 'rgba(0,200,224,0.08)' : 'var(--surface3)', border: `1px solid ${selectedAccountId === a.id ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer' }}>
                        <input type="radio" name="account" value={a.id} checked={selectedAccountId === a.id} onChange={() => setSelectedAccountId(a.id)} style={{ accentColor: 'var(--cyan)' }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.account_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.platform === 'google' ? 'Google Ads' : 'Meta Ads'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: selectedAccountId === 'new' ? 'rgba(0,200,224,0.08)' : 'var(--surface3)', border: `1px solid ${selectedAccountId === 'new' ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="account" value="new" checked={selectedAccountId === 'new'} onChange={() => setSelectedAccountId('new')} style={{ accentColor: 'var(--cyan)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>＋ Create new account</div>
                    {selectedAccountId === 'new' && (
                      <input type="text" placeholder='Name this account e.g. "Search Campaigns"'
                        value={newAccountName} onChange={e => setNewAccountName(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: '8px', fontSize: '13px' }} />
                    )}
                  </div>
                </label>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(0,200,224,0.05)' : 'var(--surface2)', transition: 'all 0.2s', marginBottom: '16px' }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Drop your CSV here</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Export from {platform === 'google' ? 'Google Ads → Reports → Download' : 'Meta Ads Manager → Export'}
                </div>
                <div style={{ display: 'inline-block', padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-mid)' }}>Browse file</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>

              {/* Instructions */}
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>How to export from {platform === 'google' ? 'Google Ads' : 'Meta Ads'}</div>
                {platform === 'google' ? (
                  <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: 'var(--text-mid)' }}>
                    <li>Go to <strong style={{ color: 'var(--text)' }}>ads.google.com</strong> → your account</li>
                    <li>Click <strong style={{ color: 'var(--text)' }}>Campaigns</strong> in the left menu</li>
                    <li>Set your date range at the top right</li>
                    <li>Click <strong style={{ color: 'var(--text)' }}>⬇ Download → CSV</strong></li>
                  </ol>
                ) : (
                  <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: 'var(--text-mid)' }}>
                    <li>Go to <strong style={{ color: 'var(--text)' }}>business.facebook.com</strong> → Ads Manager</li>
                    <li>Select your date range</li>
                    <li>Click <strong style={{ color: 'var(--text)' }}>Export → Export Table Data → CSV</strong></li>
                  </ol>
                )}
              </div>
            </>
          )}

          {step === 'map' && (
            <>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '20px' }}>📄</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{file?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{preview.length} preview rows · auto-detected columns below</div>
                  </div>
                  <button onClick={() => setStep('upload')} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>← Back</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...requiredFields, ...optionalFields].map(field => (
                    <div key={field} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: requiredFields.includes(field) ? 'var(--text)' : 'var(--text-muted)' }}>
                        {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {requiredFields.includes(field) && <span style={{ color: 'var(--cyan)', marginLeft: '4px' }}>*</span>}
                      </div>
                      <select value={mapping[field] || ''} onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}>
                        <option value="">— skip —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && mapping.date && mapping.spend && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', overflowX: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '13px' }}>Preview</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>{['date', 'spend', 'impressions', 'clicks', 'conversions', 'conv. value'].map(f => (
                        <th key={f} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{f}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{cleanDate(row[mapping.date] || '')}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>€{cleanNumber(row[mapping.spend] || '0').toFixed(2)}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{cleanNumber(row[mapping.impressions] || '0')}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{cleanNumber(row[mapping.clicks] || '0')}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{cleanNumber(row[mapping.conversions] || '0')}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>€{cleanNumber(row[mapping.conversion_value] || '0').toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>⚠ {error}</div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setStep('upload')} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>← Back</button>
                <button onClick={uploadData} disabled={loading || !mapping.date || !mapping.spend} style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: loading ? 'var(--surface3)' : 'var(--cyan)', color: loading ? 'var(--text-muted)' : '#080c0f', border: 'none' }}>
                  {loading ? '⏳ Importing...' : '⬆ Import Data →'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Data imported!</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>Your data is now live in the dashboard.</div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { setStep('upload'); setFile(null); setPreview([]); setMapping({}) }} style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                  ⬆ Import another
                </button>
                <button onClick={() => window.location.href = `/dashboard?client=${clientId}`} style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>
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
