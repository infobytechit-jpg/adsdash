'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountsClient({ clients, adAccounts }: { clients: any[]; adAccounts: any[] }) {
  const [accounts, setAccounts] = useState(adAccounts)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ client_id: '', platform: 'google', account_name: '', account_id: '' })
  const supabase = createClient()

  // Group by client
  const byClient: Record<string, { client: any; accounts: any[] }> = {}
  clients.forEach(c => { byClient[c.id] = { client: c, accounts: [] } })
  accounts.forEach(a => {
    if (byClient[a.client_id]) byClient[a.client_id].accounts.push(a)
  })

  async function addAccount() {
    if (!form.client_id || !form.account_name) { alert('Please fill in all required fields.'); return }
    setLoading(true)
    const { data, error } = await supabase.from('ad_accounts').insert({
      client_id: form.client_id,
      platform: form.platform,
      account_name: form.account_name,
      account_id: form.account_id || form.account_name,
      is_active: true,
    }).select(`*, clients(name)`).single()

    if (!error && data) {
      setAccounts(prev => [data, ...prev])
      setShowAdd(false)
      setForm({ client_id: '', platform: 'google', account_name: '', account_id: '' })
    } else {
      alert(error?.message)
    }
    setLoading(false)
  }

  async function renameAccount(id: string) {
    if (!editingName.trim()) return
    setLoading(true)
    const { error } = await supabase.from('ad_accounts').update({ account_name: editingName }).eq('id', id)
    if (!error) {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, account_name: editingName } : a))
      setEditingId(null)
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('ad_accounts').update({ is_active: !current }).eq('id', id)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
  }

  async function removeAccount(id: string) {
    if (!confirm('Delete this account? All associated data will remain but the account will be removed.')) return
    await supabase.from('ad_accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  const platformColor = (p: string) => p === 'google' ? '#4285F4' : '#1877F2'
  const platformLetter = (p: string) => p === 'google' ? 'G' : 'f'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Ad Accounts</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage accounts per client — name them, rename them, assign them</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
          ＋ Add Account
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total Accounts', value: accounts.length },
            { label: 'Google Ads', value: accounts.filter(a => a.platform === 'google').length },
            { label: 'Meta Ads', value: accounts.filter(a => a.platform === 'meta').length },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Accounts by client */}
        {Object.values(byClient).map(({ client, accounts: clientAccounts }) => (
          <div key={client.id} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: client.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '13px', color: '#080c0f' }}>
                {client.name?.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px' }}>{client.name}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{clientAccounts.length} account{clientAccounts.length !== 1 ? 's' : ''}</span>
              <button onClick={() => { setForm(f => ({ ...f, client_id: client.id })); setShowAdd(true) }}
                style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                + Add Account
              </button>
            </div>

            {clientAccounts.length === 0 ? (
              <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: '10px', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No accounts yet — click "+ Add Account" to create one
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {clientAccounts.map(a => (
                  <div key={a.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Platform icon */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${platformColor(a.platform)}20`, color: platformColor(a.platform), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, flexShrink: 0 }}>
                      {platformLetter(a.platform)}
                    </div>

                    {/* Name — editable */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingId === a.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input value={editingName} onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renameAccount(a.id); if (e.key === 'Escape') setEditingId(null) }}
                            style={{ fontSize: '13px', padding: '4px 8px', flex: 1 }} autoFocus />
                          <button onClick={() => renameAccount(a.id)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'var(--cyan)', color: '#080c0f', border: 'none' }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {a.account_name}
                            <button onClick={() => { setEditingId(a.id); setEditingName(a.account_name) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '2px 4px' }}>✏️</button>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {a.platform === 'google' ? 'Google Ads' : 'Meta Ads'} {a.account_id && a.account_id !== a.account_name ? `· ID: ${a.account_id}` : ''}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => toggleActive(a.id, a.is_active)} style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: a.is_active ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: a.is_active ? 'var(--green)' : 'var(--yellow)' }}>
                        {a.is_active ? '● Active' : '● Paused'}
                      </button>
                      <button onClick={() => removeAccount(a.id)} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)' }}>
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Add Ad Account</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Create a named account and assign it to a client</div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client *</label>
              <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform *</label>
              <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Account Name * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(how you'll identify it)</span></label>
              <input type="text" placeholder='e.g. "Search Campaigns" or "Retargeting"'
                value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Account ID <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <input type="text" placeholder={form.platform === 'google' ? '123-456-7890' : 'act_123456789'}
                value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={addAccount} disabled={loading || !form.client_id || !form.account_name} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
                {loading ? 'Creating...' : 'Create Account →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
