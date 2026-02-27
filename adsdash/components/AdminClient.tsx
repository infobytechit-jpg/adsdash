'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminClient({ clients, reports, adAccounts: initialAccounts, assignments: initialAssignments }: {
  clients: any[]; reports: any[]; adAccounts: any[]; assignments: any[]
}) {
  const [activeTab, setActiveTab] = useState<'clients' | 'accounts' | 'users' | 'reports'>('clients')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clientsList, setClientsList] = useState(clients)
  const [accounts, setAccounts] = useState(initialAccounts)
  const [assignments, setAssignments] = useState<any[]>(initialAssignments)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [selectedUserForAssign, setSelectedUserForAssign] = useState<string>(clients[0]?.id || '')
  const [dataLoading, setDataLoading] = useState(clients.length === 0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (clients.length > 0) return
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const [c, r, a, ma, asgn] = await Promise.all([
          supabase.from('clients').select('*, ad_accounts(id,platform,account_name,is_active)').order('name'),
          supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false }).limit(10),
          supabase.from('ad_accounts').select('*').order('account_name'),
          supabase.from('metrics_cache').select('client_id,platform,account_name').not('account_name','is',null),
          supabase.from('client_account_assignments').select('*'),
        ])
        const adRows = a.data || []
        const metricAcc = ma.data || []
        const existing = new Set(adRows.map((x:any) => `${x.client_id}|${x.platform}|${x.account_name}`))
        const seen = new Set<string>()
        const extra = metricAcc
          .filter((m:any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
          .map((m:any, i:number) => ({ id:`metrics-${m.client_id}-${m.platform}-${i}`, client_id:m.client_id, platform:m.platform, account_name:m.account_name, is_active:true, from_metrics:true }))
          .filter((x:any) => { const k=`${x.client_id}|${x.platform}|${x.account_name}`; if(seen.has(k)) return false; seen.add(k); return true })
        const loaded = c.data || []
        setClientsList(loaded)
        setAccounts([...adRows, ...extra])
        setAssignments(asgn.data || [])
        if (loaded[0]) setSelectedUserForAssign(loaded[0].id)
      } finally {
        setDataLoading(false)
      }
    }
    fetchData()
  }, [])

  const [newClient, setNewClient] = useState({ name: '', email: '', password: '', color: '#00C8E0' })
  const [accountForm, setAccountForm] = useState({ client_id: '', platform: 'google', account_name: '', account_id: '' })
  const [metrics, setMetrics] = useState({
    show_spend: true, show_conversion_value: true, show_conversions: true, show_roas: true, show_leads: true,
    show_clicks: false, show_impressions: false, show_cpc: false, show_ctr: false,
  })

  // ── Customize modal ──────────────────────────────────────────
  function openCustomize(client: any) {
    setSelectedClient(client)
    setMetrics({
      show_spend: client.show_spend ?? true, show_conversion_value: client.show_conversion_value ?? true,
      show_conversions: client.show_conversions ?? true, show_roas: client.show_roas ?? true,
      show_leads: client.show_leads ?? true, show_clicks: client.show_clicks ?? false,
      show_impressions: client.show_impressions ?? false, show_cpc: client.show_cpc ?? false,
      show_ctr: client.show_ctr ?? false,
    })
    setShowCustomizeModal(true)
  }

  async function saveCustomize() {
    if (!selectedClient) return
    setLoading(true)
    await supabase.from('clients').update(metrics).eq('id', selectedClient.id)
    setClientsList(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...metrics } : c))
    setShowCustomizeModal(false)
    setLoading(false)
    router.refresh()
  }

  // ── Create client ─────────────────────────────────────────────
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

  // ── Account management ────────────────────────────────────────
  async function addAccount() {
    if (!accountForm.client_id || !accountForm.account_name) { alert('Please fill client and account name.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('ad_accounts').insert({
      client_id: accountForm.client_id, platform: accountForm.platform,
      account_name: accountForm.account_name,
      account_id: accountForm.account_id || accountForm.account_name,
      is_active: true,
    }).select().single()
    if (!error && data) {
      setAccounts(prev => [data, ...prev])
      setShowAddAccount(false)
      setAccountForm({ client_id: '', platform: 'google', account_name: '', account_id: '' })
    } else { alert(error?.message) }
    setLoading(false)
  }

  async function renameAccount(id: string) {
    if (!editingName.trim()) return
    const account = accounts.find(a => a.id === id)
    if (!account) return
    const res = await fetch('/api/admin/rename-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: account.client_id, platform: account.platform,
        old_name: account.account_name, new_name: editingName.trim(),
        ad_account_id: account.from_metrics ? null : id,
        from_metrics: account.from_metrics ?? false,
      }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, account_name: editingName.trim() } : a))
    setEditingId(null)
  }

  async function toggleActive(id: string, current: boolean) {
    const account = accounts.find(a => a.id === id)
    if (!account || account.from_metrics) return
    await supabase.from('ad_accounts').update({ is_active: !current }).eq('id', id)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
  }

  async function removeAccount(id: string) {
    const account = accounts.find(a => a.id === id)
    if (!account) return
    if (!confirm(`Delete "${account.account_name}"? This permanently removes all its metric data.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delete-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: account.client_id,
          platform: account.platform,
          account_name: account.account_name,
          ad_account_id: account.from_metrics ? null : id,
          from_metrics: account.from_metrics ?? false,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAccounts(prev => prev.filter(a => a.id !== id))
      // Also remove any assignments for this account
      setAssignments(prev => prev.filter(a => !(a.account_name === account.account_name && a.platform === account.platform && a.source_client_id === account.client_id)))
    } catch (e: any) { alert('Delete failed: ' + e.message) }
    setLoading(false)
  }

  // ── User account assignments ──────────────────────────────────
  // Only show accounts where this IS the source client (not copies assigned from elsewhere)
  // An account is a "source" if it's not in the assignments table as a non-owner
  const sourceAccounts = accounts.filter(a => {
    // Check if this account exists as an assignment (meaning it's a copy, not source)
    const isAssignedCopy = assignments.some(
      x => x.client_id === a.client_id && x.account_name === a.account_name && x.platform === a.platform
    )
    return !isAssignedCopy
  })

  function isAssigned(clientId: string, accountName: string, platform: string, sourceClientId: string) {
    // Always assigned to original client
    if (clientId === sourceClientId) return true
    return assignments.some(a =>
      a.client_id === clientId &&
      a.account_name === accountName &&
      a.platform === platform
    )
  }

  async function toggleAssignment(clientId: string, accountName: string, platform: string, sourceClientId: string) {
    if (clientId === sourceClientId) return
    const isCurrentlyAssigned = assignments.some(
      a => a.client_id === clientId && a.account_name === accountName && a.platform === platform
    )
    setLoading(true)
    try {
      const res = await fetch('/api/admin/assign-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isCurrentlyAssigned ? 'unassign' : 'assign',
          client_id: clientId,
          account_name: accountName,
          platform,
          source_client_id: sourceClientId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (isCurrentlyAssigned) {
        setAssignments(prev => prev.filter(
          a => !(a.client_id === clientId && a.account_name === accountName && a.platform === platform)
        ))
      } else {
        setAssignments(prev => [...prev, { client_id: clientId, account_name: accountName, platform, source_client_id: sourceClientId }])
      }
      router.refresh()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setLoading(false)
  }

  const COLORS_OPTIONS = ['#00C8E0', '#a855f7', '#f97316', '#00e09e', '#ffc53d', '#ff4d6a', '#4285F4']
  const metricItems = [
    { key: 'show_spend', label: 'Total Spend', sub: 'Combined ad spend' },
    { key: 'show_conversion_value', label: 'Conv. Value', sub: 'Total revenue from conversions' },
    { key: 'show_conversions', label: 'Conversions', sub: 'Total conversions tracked' },
    { key: 'show_roas', label: 'ROAS', sub: 'Return on ad spend' },
    { key: 'show_leads', label: 'Leads', sub: 'Form fills and lead events' },
    { key: 'show_clicks', label: 'Clicks', sub: 'Total link clicks' },
    { key: 'show_impressions', label: 'Impressions', sub: 'Total impressions' },
    { key: 'show_cpc', label: 'CPC', sub: 'Cost per click' },
    { key: 'show_ctr', label: 'CTR', sub: 'Click-through rate' },
  ]

  const byClient: Record<string, any[]> = {}
  clientsList.forEach(c => { byClient[c.id] = [] })
  accounts.forEach(a => { if (byClient[a.client_id]) byClient[a.client_id].push(a) })

  const selectedUserData = clientsList.find(c => c.id === selectedUserForAssign)

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <style>{\`@keyframes dp{0%,80%,100%{transform:scale(0.6);opacity:0.3}40%{transform:scale(1);opacity:1}}.ld{width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out}.ld:nth-child(2){animation-delay:.2s}.ld:nth-child(3){animation-delay:.4s}\`}</style>
        <div style={{ display: 'flex', gap: '8px' }}><div className="ld"/><div className="ld"/><div className="ld"/></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Admin Panel</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage clients, accounts, and reports</div>
        </div>
        {activeTab === 'clients' && (
          <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
            ＋ Add Client
          </button>
        )}
        {activeTab === 'accounts' && (
          <button onClick={() => setShowAddAccount(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
            ＋ Add Account
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {(['clients', 'accounts', 'users', 'reports'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '12px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none',
              color: activeTab === tab ? 'var(--cyan)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
              {tab === 'accounts' ? 'Ad Accounts' : tab === 'users' ? 'User Access' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── CLIENTS TAB ─────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {clientsList.map(c => (
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openCustomize(c)} style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>🎛 Customize</button>
                  <button onClick={() => router.push('/dashboard?client=' + c.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>👁 View</button>
                  <button onClick={() => deleteClient(c.id, c.user_id)} style={{ padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)' }}>🗑</button>
                </div>
              </div>
            ))}
            {clientsList.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No clients yet.</div>}
          </div>
        )}

        {/* ── AD ACCOUNTS TAB ─────────────────────────────────── */}
        {activeTab === 'accounts' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[['Total', accounts.length], ['Google Ads', accounts.filter(a => a.platform === 'google').length], ['Meta Ads', accounts.filter(a => a.platform === 'meta').length]].map(([l, v]) => (
                <div key={String(l)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>

            {clientsList.map(client => {
              const ca = byClient[client.id] || []
              return (
                <div key={client.id} style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: client.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '11px', color: '#080c0f' }}>
                      {client.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px' }}>{client.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ca.length} account{ca.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => { setAccountForm(f => ({ ...f, client_id: client.id })); setShowAddAccount(true) }}
                      style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      + Add
                    </button>
                  </div>
                  {ca.length === 0 ? (
                    <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: '10px', padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No accounts yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ca.map(a => (
                        <div key={a.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: a.platform === 'google' ? 'rgba(66,133,244,0.2)' : 'rgba(24,119,242,0.2)', color: a.platform === 'google' ? '#4285F4' : '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>
                            {a.platform === 'google' ? 'G' : 'f'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {editingId === a.id ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input value={editingName} onChange={e => setEditingName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') renameAccount(a.id); if (e.key === 'Escape') setEditingId(null) }}
                                  style={{ fontSize: '13px', padding: '5px 8px', flex: 1 }} autoFocus />
                                <button onClick={() => renameAccount(a.id)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>Save</button>
                                <button onClick={() => setEditingId(null)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>{a.account_name}</span>
                                <button onClick={() => { setEditingId(a.id); setEditingName(a.account_name) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 4px' }}>✏️</button>
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {a.platform === 'google' ? 'Google Ads' : 'Meta Ads'}
                              {a.from_metrics && <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,197,61,0.15)', color: 'var(--yellow)', fontSize: '10px', fontWeight: 600 }}>manual</span>}
                            </div>
                          </div>
                          <button onClick={() => toggleActive(a.id, a.is_active)}
                            style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: a.is_active ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: a.is_active ? 'var(--green)' : 'var(--yellow)', flexShrink: 0 }}>
                            {a.is_active !== false ? '● Active' : '● Paused'}
                          </button>
                          <button onClick={() => removeAccount(a.id)} disabled={loading}
                            style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid rgba(255,77,106,0.2)', background: 'rgba(255,77,106,0.08)', color: 'var(--red)', cursor: loading ? 'wait' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── USER ACCESS TAB ─────────────────────────────────── */}
        {activeTab === 'users' && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* User list */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Users
              </div>
              {clientsList.map(c => (
                <button key={c.id} onClick={() => setSelectedUserForAssign(c.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', background: selectedUserForAssign === c.id ? 'rgba(0,200,224,0.08)' : 'transparent', borderLeft: selectedUserForAssign === c.id ? '3px solid var(--cyan)' : '3px solid transparent', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: c.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '12px', color: '#080c0f', flexShrink: 0 }}>
                    {c.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: selectedUserForAssign === c.id ? 700 : 500, color: selectedUserForAssign === c.id ? 'var(--cyan)' : 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {accounts.filter(a => a.client_id === c.id && !assignments.some(x => x.client_id === c.id && x.account_name === a.account_name && x.platform === a.platform)).length + assignments.filter(a => a.client_id === c.id).length} account{(accounts.filter(a => a.client_id === c.id && !assignments.some(x => x.client_id === c.id && x.account_name === a.account_name && x.platform === a.platform)).length + assignments.filter(a => a.client_id === c.id).length) !== 1 ? 's' : ''} visible
                    </div>
                  </div>
                </button>
              ))}
              {clientsList.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No users yet</div>
              )}
            </div>

            {/* Account assignment panel */}
            <div>
              {selectedUserData ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: selectedUserData.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '15px', color: '#080c0f' }}>
                      {selectedUserData.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px' }}>{selectedUserData.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Toggle which accounts this user can see in their dashboard</div>
                    </div>
                  </div>

                  {sourceAccounts.length === 0 ? (
                    <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No accounts exist yet. Add accounts first in the Ad Accounts tab.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sourceAccounts.map(a => {
                        const isSource = a.client_id === selectedUserForAssign
                        const assigned = isAssigned(selectedUserForAssign, a.account_name, a.platform, a.client_id)
                        const sourceName = clientsList.find(c => c.id === a.client_id)?.name || 'Unknown'
                        return (
                          <div key={a.id} style={{ background: 'var(--surface2)', border: `1px solid ${assigned ? 'rgba(0,200,224,0.25)' : 'var(--border)'}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.2s' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: a.platform === 'google' ? 'rgba(66,133,244,0.2)' : 'rgba(24,119,242,0.2)', color: a.platform === 'google' ? '#4285F4' : '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, flexShrink: 0 }}>
                              {a.platform === 'google' ? 'G' : 'f'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>{a.account_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {a.platform === 'google' ? 'Google Ads' : 'Meta Ads'}
                                {!isSource && <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>· owner: {sourceName}</span>}
                              </div>
                            </div>
                            {isSource ? (
                              <span style={{ padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(0,200,224,0.12)', color: 'var(--cyan)', border: '1px solid rgba(0,200,224,0.3)' }}>
                                Owner
                              </span>
                            ) : (
                              <button onClick={() => toggleAssignment(selectedUserForAssign, a.account_name, a.platform, a.client_id)} disabled={loading}
                                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', border: assigned ? '1px solid rgba(255,77,106,0.3)' : '1px solid rgba(0,200,224,0.3)', background: assigned ? 'rgba(255,77,106,0.08)' : 'rgba(0,200,224,0.08)', color: assigned ? 'var(--red)' : 'var(--cyan)', transition: 'all 0.15s', flexShrink: 0 }}>
                                {assigned ? '✕ Remove' : '＋ Assign'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Select a user on the left
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ─────────────────────────────────────── */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: '8px' }}>Send Reports</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Manually send a report to a client.</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {clientsList.map(c => (
                  <button key={c.id} onClick={() => sendReport(c.id)} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.3)', color: 'var(--cyan)' }}>
                    ✉ {c.name}
                  </button>
                ))}
              </div>
            </div>
            {reports.map(r => (
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
            {reports.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reports yet.</div>}
          </div>
        )}
      </div>

      {/* ── ADD CLIENT MODAL ──────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Add New Client</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Create a login account for your client</div>
            {[{ label: 'Client / Company Name', key: 'name', type: 'text', placeholder: 'e.g. Acme Corporation' },
              { label: 'Client Email', key: 'email', type: 'email', placeholder: 'client@company.com' },
              { label: 'Temporary Password', key: 'password', type: 'text', placeholder: 'They can change this later' }].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={(newClient as any)[f.key]}
                  onChange={e => setNewClient(prev => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '8px' }}>Brand Color</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS_OPTIONS.map(col => (
                  <div key={col} onClick={() => setNewClient(prev => ({ ...prev, color: col }))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', background: col, cursor: 'pointer', border: newClient.color === col ? '3px solid white' : '3px solid transparent' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={createNewClient} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
                {loading ? 'Creating...' : 'Create Client →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD ACCOUNT MODAL ─────────────────────────────────── */}
      {showAddAccount && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddAccount(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>Add Ad Account</div>
            {[{ label: 'Client *', key: 'client_id', type: 'select' }, { label: 'Platform *', key: 'platform', type: 'select' },
              { label: 'Account Name *', key: 'account_name', type: 'text', placeholder: 'e.g. "Search Campaigns"' },
              { label: 'Account ID (optional)', key: 'account_id', type: 'text', placeholder: accountForm.platform === 'google' ? '123-456-7890' : 'act_123456789' }].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{f.label}</label>
                {f.type === 'select' && f.key === 'client_id' && (
                  <select value={accountForm.client_id} onChange={e => setAccountForm(p => ({ ...p, client_id: e.target.value }))}>
                    <option value="">Select client...</option>
                    {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {f.type === 'select' && f.key === 'platform' && (
                  <select value={accountForm.platform} onChange={e => setAccountForm(p => ({ ...p, platform: e.target.value }))}>
                    <option value="google">Google Ads</option>
                    <option value="meta">Meta Ads</option>
                  </select>
                )}
                {f.type === 'text' && (
                  <input type="text" placeholder={f.placeholder} value={(accountForm as any)[f.key]}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAddAccount(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={addAccount} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
                {loading ? 'Creating...' : 'Create →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZE MODAL ───────────────────────────────────── */}
      {showCustomizeModal && selectedClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCustomizeModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Customize Dashboard</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Metrics visible to <strong>{selectedClient.name}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {metricItems.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <button onClick={() => setMetrics(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
                    style={{ width: '40px', height: '22px', background: (metrics as any)[item.key] ? 'var(--cyan)' : 'var(--surface3)', borderRadius: '100px', position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: 'white', top: '3px', left: (metrics as any)[item.key] ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowCustomizeModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={saveCustomize} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
