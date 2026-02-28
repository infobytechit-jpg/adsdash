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
  const [activeTab, setActiveTab] = useState<'clients' | 'accounts' | 'access' | 'reports'>('clients')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clientsList, setClientsList] = useState(clients)
  const [accountsList, setAccountsList] = useState(adAccounts)
  const [assignmentsList, setAssignmentsList] = useState(assignments)
  const router = useRouter()
  const supabase = createClient()

  // New client form
  const [newClient, setNewClient] = useState({ name: '', email: '', password: '', color: '#00C8E0' })

  // New account form
  const [newAccount, setNewAccount] = useState({ clientId: clients[0]?.id || '', platform: 'google', accountName: '', accountId: '' })

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  // Access tab: selected client for assignment
  const [accessClientId, setAccessClientId] = useState(clients[0]?.id || '')

  // Metrics toggles for customize modal
  const [metrics, setMetrics] = useState({
    show_spend: true, show_conversions: true, show_roas: true, show_leads: true,
    show_clicks: false, show_impressions: false, show_cpc: false, show_ctr: false,
  })

  // Attach adAccounts to each client
  const clientsWithAccounts = clientsList.map((c: any) => ({
    ...c,
    ad_accounts: accountsList.filter((a: any) => a.client_id === c.id),
  }))

  // All unique accounts (for assignment)
  const allUniqueAccounts = accountsList.reduce((acc: any[], a: any) => {
    if (!acc.find(x => x.account_name === a.account_name && x.platform === a.platform)) acc.push(a)
    return acc
  }, [])

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
    } catch (err: any) { alert('Error: ' + err.message) }
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

  async function addAccount() {
    if (!newAccount.accountName.trim()) return alert('Account name is required')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/add-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAccountsList(prev => [...prev, data.account])
      setShowAddAccountModal(false)
      setNewAccount({ clientId: clients[0]?.id || '', platform: 'google', accountName: '', accountId: '' })
    } catch (err: any) { alert('Error: ' + err.message) }
    setLoading(false)
  }

  async function deleteAccount(accountId: string) {
    if (!confirm('Delete this account? All its data will be unlinked.')) return
    await fetch('/api/admin/delete-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    })
    setAccountsList(prev => prev.filter(a => a.id !== accountId))
  }

  async function renameAccount(accountId: string) {
    if (!renameVal.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/rename-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, newName: renameVal }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAccountsList(prev => prev.map(a => a.id === accountId ? { ...a, account_name: renameVal } : a))
      setRenamingId(null)
    } catch (err: any) { alert('Error: ' + err.message) }
    setLoading(false)
  }

  async function toggleAssignment(accountName: string, platform: string, sourceClientId: string) {
    const exists = assignmentsList.find(a =>
      a.client_id === accessClientId && a.account_name === accountName && a.platform === platform
    )
    if (exists) {
      await fetch('/api/admin/assign-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', clientId: accessClientId, accountName, platform }),
      })
      setAssignmentsList(prev => prev.filter(a =>
        !(a.client_id === accessClientId && a.account_name === accountName && a.platform === platform)
      ))
    } else {
      const res = await fetch('/api/admin/assign-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', clientId: accessClientId, accountName, platform, sourceClientId }),
      })
      const data = await res.json()
      if (data.assignment) setAssignmentsList(prev => [...prev, data.assignment])
    }
  }

  async function sendReport(clientId: string) {
    setLoading(true)
    const res = await fetch('/api/reports/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    const data = await res.json()
    if (data.error) alert('Error: ' + data.error)
    else alert('✓ Report sent!')
    setLoading(false)
  }

  const COLORS_OPTIONS = ['#00C8E0', '#a855f7', '#f97316', '#00e09e', '#ffc53d', '#ff4d6a', '#4285F4']
  const metricItems = [
    { key: 'show_spend',       label: 'Total Spend',   sub: 'Combined ad spend' },
    { key: 'show_conversions', label: 'Conversions',   sub: 'Total conversion actions' },
    { key: 'show_roas',        label: 'ROAS',          sub: 'Return on ad spend' },
    { key: 'show_leads',       label: 'Leads',         sub: 'Form fills and lead gen events' },
    { key: 'show_clicks',      label: 'Clicks',        sub: 'Total link clicks' },
    { key: 'show_impressions', label: 'Impressions',   sub: 'Total ad impressions' },
    { key: 'show_cpc',         label: 'CPC',           sub: 'Cost per click' },
    { key: 'show_ctr',         label: 'CTR',           sub: 'Click-through rate' },
  ]

  const TABS = [
    { key: 'clients',  label: '👥 Clients' },
    { key: 'accounts', label: '📡 Accounts' },
    { key: 'access',   label: '🔑 User Access' },
    { key: 'reports',  label: '📊 Reports' },
  ] as const

  // Access tab: accounts that could be assigned (owned by any client)
  const accessClient = clientsList.find(c => c.id === accessClientId)
  const ownedAccounts = accountsList.filter(a => !a.from_metrics)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Admin Panel</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage clients, dashboards, and reports</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'accounts' && (
            <button onClick={() => setShowAddAccountModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
              + Add Account
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', fontFamily: 'Syne, sans-serif' }}>
            + Add Client
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '12px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: 'none', background: 'none',
              color: activeTab === tab.key ? 'var(--cyan)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--cyan)' : '2px solid transparent',
              marginBottom: '-1px', whiteSpace: 'nowrap',
            }}>
              {tab.label}
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
                    ['Accounts', c.ad_accounts?.length > 0 ? `${c.ad_accounts.length} linked` : 'None'],
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
                No clients yet. Click "+ Add Client" to get started.
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNTS TAB ── */}
        {activeTab === 'accounts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {accountsList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                No ad accounts yet. Click "+ Add Account" to link one.
              </div>
            )}
            {accountsList.map((a: any) => {
              const owner = clientsList.find(c => c.id === a.client_id)
              const isRenaming = renamingId === a.id
              return (
                <div key={a.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: a.platform === 'google' ? 'rgba(66,133,244,0.15)' : 'rgba(24,119,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: a.platform === 'google' ? '#4285F4' : '#1877F2', flexShrink: 0 }}>
                    {a.platform === 'google' ? 'G' : 'f'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          style={{ flex: 1, padding: '5px 10px', fontSize: '13px', borderRadius: '6px' }}
                          onKeyDown={e => { if (e.key === 'Enter') renameAccount(a.id); if (e.key === 'Escape') setRenamingId(null) }}
                          autoFocus />
                        <button onClick={() => renameAccount(a.id)} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>Save</button>
                        <button onClick={() => setRenamingId(null)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.account_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {a.platform === 'google' ? 'Google Ads' : 'Meta Ads'} · Owner: {owner?.name || 'Unknown'}
                          {a.account_id && ` · ID: ${a.account_id}`}
                        </div>
                      </>
                    )}
                  </div>
                  {!isRenaming && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => { setRenamingId(a.id); setRenameVal(a.account_name) }}
                        style={{ padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>
                        ✏ Rename
                      </button>
                      <button onClick={() => deleteAccount(a.id)}
                        style={{ padding: '6px 12px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)' }}>
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── USER ACCESS TAB ── */}
        {activeTab === 'access' && (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left: client list */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Select Client</div>
              {clientsList.map(c => (
                <button key={c.id} onClick={() => setAccessClientId(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', border: 'none', background: accessClientId === c.id ? 'rgba(0,200,224,0.1)' : 'transparent', cursor: 'pointer', borderLeft: `3px solid ${accessClientId === c.id ? 'var(--cyan)' : 'transparent'}` }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: c.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#080c0f', flexShrink: 0 }}>
                    {c.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: accessClientId === c.id ? 'var(--cyan)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {assignmentsList.filter(a => a.client_id === c.id).length} accounts
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right: account assignment */}
            <div>
              {accessClient && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{accessClient.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Toggle which ad accounts this client can see in their dashboard.</div>
                  </div>
                  {allUniqueAccounts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      No accounts yet. Add accounts in the Accounts tab first.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {allUniqueAccounts.map((a: any) => {
                        const assigned = !!assignmentsList.find(x =>
                          x.client_id === accessClientId && x.account_name === a.account_name && x.platform === a.platform
                        )
                        const owner = clientsList.find(c => c.id === a.client_id)
                        return (
                          <div key={`${a.platform}-${a.account_name}`} style={{ background: 'var(--surface2)', border: `1px solid ${assigned ? 'var(--cyan)' : 'var(--border)'}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'border-color 0.15s' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: a.platform === 'google' ? 'rgba(66,133,244,0.15)' : 'rgba(24,119,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: a.platform === 'google' ? '#4285F4' : '#1877F2', flexShrink: 0 }}>
                              {a.platform === 'google' ? 'G' : 'f'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>{a.account_name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {a.platform === 'google' ? 'Google Ads' : 'Meta Ads'} · Owner: {owner?.name || 'Unknown'}
                              </div>
                            </div>
                            <button onClick={() => toggleAssignment(a.account_name, a.platform, a.client_id)}
                              style={{ width: '44px', height: '24px', background: assigned ? 'var(--cyan)' : 'var(--surface3)', borderRadius: '100px', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: 'white', top: '3px', left: assigned ? '23px' : '3px', transition: 'left 0.2s' }} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: '8px' }}>Send Report to Client</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Manually send the last 7 days performance report to a client. For scheduled reports, go to the <strong>Reports</strong> page.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {clientsList.map(c => (
                  <button key={c.id} onClick={() => sendReport(c.id)} disabled={loading}
                    style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.3)', color: 'var(--cyan)', opacity: loading ? 0.6 : 1 }}>
                    ✉ Send to {c.name}
                  </button>
                ))}
              </div>
            </div>
            {reports.map((r: any) => (
              <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(0,200,224,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📊</div>
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
              <button onClick={createNewClient} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating...' : 'Create Client →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD ACCOUNT MODAL ── */}
      {showAddAccountModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddAccountModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '440px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Add Ad Account</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Link a Google Ads or Meta Ads account to a client</div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client</label>
              <select value={newAccount.clientId} onChange={e => setNewAccount(p => ({ ...p, clientId: e.target.value }))}>
                {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform</label>
              <select value={newAccount.platform} onChange={e => setNewAccount(p => ({ ...p, platform: e.target.value }))}>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Account Name</label>
              <input placeholder="e.g. Calimala Milano" value={newAccount.accountName}
                onChange={e => setNewAccount(p => ({ ...p, accountName: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Account ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input placeholder="e.g. 123-456-7890 or act_12345" value={newAccount.accountId}
                onChange={e => setNewAccount(p => ({ ...p, accountId: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAddAccountModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={addAccount} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Adding...' : 'Add Account →'}
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
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Choose metrics visible to <strong>{selectedClient.name}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {metricItems.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                  <button onClick={() => setMetrics(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
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