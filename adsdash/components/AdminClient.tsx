'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type AdminClientProps = {
  clients: any[]
  reports: any[]
  adAccounts: any[]
  assignments: any[]
}

export default function AdminClient({ clients, reports, adAccounts, assignments }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<'clients' | 'reports'>('clients')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clientsList, setClientsList] = useState(clients)
  const router = useRouter()
  const supabase = createClient()

  const [newClient, setNewClient] = useState({ name: '', email: '', password: '', color: '#00C8E0' })
  const [metrics, setMetrics] = useState({
    show_spend: true, show_conversions: true, show_roas: true, show_leads: true,
    show_clicks: false, show_impressions: false, show_cpc: false, show_ctr: false,
  })

  // ✅ Attach adAccounts to each client so platforms show correctly
  const clientsWithAccounts = clientsList.map((c: any) => ({
    ...c,
    ad_accounts: (adAccounts || []).filter((a: any) => a.client_id === c.id),
  }))

  function openCustomize(client: any) {
    setSelectedClient(client)
    setMetrics({
      show_spend: client.show_spend ?? true,
      show_conversions: client.show_conversions ?? true,
      show_roas: client.show_roas ?? true,
      show_leads: client.show_leads ?? true,
      show_clicks: client.show_clicks ?? false,
      show_impressions: client.show_impressions ?? false,
      show_cpc: client.show_cpc ?? false,
      show_ctr: client.show_ctr ?? false,
    })
    setShowCustomizeModal(true)
  }

  async function saveCustomize() {
    if (!selectedClient) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/update-client', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient.id, updates: metrics }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClientsList(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...metrics } : c))
      setShowCustomizeModal(false)
    } catch (err: any) { alert('Error saving: ' + err.message) }
    setLoading(false)
  }

  async function createNewClient() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-client', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setClientsList(prev => [...prev, data.client])
      setShowAddModal(false)
      setNewClient({ name: '', email: '', password: '', color: '#00C8E0' })
      router.refresh()
    } catch (err: any) { alert('Error: ' + err.message) }
    setLoading(false)
  }

  async function deleteClient(clientId: string, userId: string) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await fetch('/api/admin/delete-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, userId }),
    })
    setClientsList(prev => prev.filter(c => c.id !== clientId))
  }

  async function sendReport(clientId: string) {
    setLoading(true)
    await fetch('/api/reports/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    alert('Report sent!')
    setLoading(false)
  }

  const COLORS_OPTIONS = ['#00C8E0', '#a855f7', '#f97316', '#00e09e', '#ffc53d', '#ff4d6a', '#4285F4']
  const metricItems = [
    { key: 'show_spend',       label: 'Total Spend',   sub: 'Combined ad spend across all platforms' },
    { key: 'show_conversions', label: 'Conversions',   sub: 'Total conversion actions tracked' },
    { key: 'show_roas',        label: 'ROAS',          sub: 'Return on ad spend' },
    { key: 'show_leads',       label: 'Leads',         sub: 'Form fills and lead generation events' },
    { key: 'show_clicks',      label: 'Clicks',        sub: 'Total link clicks on ads' },
    { key: 'show_impressions', label: 'Impressions',   sub: 'Total ad impressions' },
    { key: 'show_cpc',         label: 'CPC',           sub: 'Cost per click' },
    { key: 'show_ctr',         label: 'CTR',           sub: 'Click-through rate' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Admin Panel</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage clients, dashboards, and reports</div>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', fontFamily: 'Syne, sans-serif' }}>
          ＋ Add Client
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {(['clients', 'reports'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '12px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: 'none', background: 'none',
              color: activeTab === tab ? 'var(--cyan)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── CLIENTS TAB ── */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {clientsWithAccounts.map((c: any) => (
              <div key={c.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: c.avatar_color || '#00C8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '16px', color: '#080c0f', flexShrink: 0 }}>
                    {c.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.email}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {([
                    ['Platforms', c.ad_accounts?.length > 0
                      ? [...new Set(c.ad_accounts.map((a: any) => a.platform === 'google' ? 'Google' : 'Meta'))].join(' + ')
                      : 'None'],
                    ['Status', c.is_active !== false ? 'Active' : 'Paused'],
                  ] as [string, string][]).map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--surface3)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{l}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px' }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openCustomize(c)} style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                    🎛 Customize
                  </button>
                  <button onClick={() => router.push(`/dashboard?client=${c.id}`)} style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                    👁 View
                  </button>
                  <button onClick={() => deleteClient(c.id, c.user_id)} style={{ padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)' }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {clientsList.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                No clients yet. Click "Add Client" to get started.
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: '8px' }}>Send Report to Client</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Manually send a performance report email to any client. For scheduled reports, go to the <strong>Reports</strong> page.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {clientsList.map(c => (
                  <button key={c.id} onClick={() => sendReport(c.id)} disabled={loading} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.3)', color: 'var(--cyan)', opacity: loading ? 0.6 : 1 }}>
                    ✉ Send to {c.name}
                  </button>
                ))}
              </div>
            </div>
            {reports.map((r: any) => (
              <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📊</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.clients?.name} — {r.report_type} report</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.period_start} → {r.period_end} · {r.status}</div>
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: r.status === 'sent' ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: r.status === 'sent' ? 'var(--green)' : 'var(--yellow)' }}>
                  {r.status}
                </span>
              </div>
            ))}
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No reports yet. Go to the <strong>Reports</strong> page to generate one.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ADD CLIENT MODAL ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Add New Client</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Create a login account for your client</div>
            {([
              { label: 'Client / Company Name', key: 'name', type: 'text', placeholder: 'e.g. Acme Corporation' },
              { label: 'Client Email', key: 'email', type: 'email', placeholder: 'client@company.com' },
              { label: 'Temporary Password', key: 'password', type: 'text', placeholder: 'They can change this later' },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={newClient[f.key]}
                  onChange={e => setNewClient(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px' }}>Brand Color</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS_OPTIONS.map(col => (
                  <div key={col} onClick={() => setNewClient(prev => ({ ...prev, color: col }))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: col, cursor: 'pointer', border: newClient.color === col ? '3px solid white' : '3px solid transparent', transition: 'border 0.15s' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={createNewClient} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', fontFamily: 'Syne, sans-serif', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating...' : 'Create Client →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZE MODAL ── */}
      {showCustomizeModal && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCustomizeModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Customize Dashboard</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Choose metrics visible to <strong>{selectedClient.name}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {metricItems.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <button
                    onClick={() => setMetrics(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
                    style={{ width: '40px', height: '22px', background: (metrics as any)[item.key] ? 'var(--cyan)' : 'var(--surface3)', borderRadius: '100px', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: 'white', top: '3px', left: (metrics as any)[item.key] ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowCustomizeModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={saveCustomize} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}