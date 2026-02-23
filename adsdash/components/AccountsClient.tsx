'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountsClient({ clients, adAccounts }: { clients: any[]; adAccounts: any[] }) {
  const [accounts, setAccounts] = useState(adAccounts)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ client_id: '', platform: 'google', account_name: '', account_id: '', access_token: '', refresh_token: '' })
  const supabase = createClient()

  const googleAccounts = accounts.filter(a => a.platform === 'google')
  const metaAccounts = accounts.filter(a => a.platform === 'meta')

  async function addAccount() {
    setLoading(true)
    const { data, error } = await supabase.from('ad_accounts').insert({
      client_id: form.client_id,
      platform: form.platform,
      account_name: form.account_name,
      account_id: form.account_id,
      access_token: form.access_token,
      refresh_token: form.refresh_token,
      is_active: true,
    }).select(`*, clients(name)`).single()

    if (!error && data) {
      setAccounts(prev => [data, ...prev])
      setShowAdd(false)
      setForm({ client_id: '', platform: 'google', account_name: '', account_id: '', access_token: '', refresh_token: '' })
    } else {
      alert(error?.message)
    }
    setLoading(false)
  }

  async function removeAccount(id: string) {
    if (!confirm('Disconnect this account?')) return
    await supabase.from('ad_accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function PlatformSection({ platform, list }: { platform: string; list: any[] }) {
    const isGoogle = platform === 'google'
    const color = isGoogle ? '#4285F4' : '#1877F2'
    const letter = isGoogle ? 'G' : 'f'
    const label = isGoogle ? 'Google Ads' : 'Meta Ads'
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '15px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>{letter}</div>
            {label}
          </div>
          {list.length > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(0,224,158,0.15)', color: 'var(--green)' }}>
              ● {list.length} Connected
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No {label} accounts connected yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface3)', borderRadius: '8px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{a.account_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {a.clients?.name}</span></div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>ID: {a.account_id}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: a.is_active ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: a.is_active ? 'var(--green)' : 'var(--yellow)' }}>
                    {a.is_active ? 'Active' : 'Paused'}
                  </span>
                  <button onClick={() => removeAccount(a.id)} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)' }}>
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Ad Accounts</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Credentials stored securely — connect once, always synced</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
          ＋ Connect Account
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ background: 'rgba(0,200,224,0.05)', border: '1px solid rgba(0,200,224,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-mid)' }}>
          🔒 <strong>Your credentials are encrypted</strong> and stored securely in your private Supabase database. They are never shared or exposed publicly.
        </div>
        <PlatformSection platform="google" list={googleAccounts} />
        <PlatformSection platform="meta" list={metaAccounts} />
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', width: '480px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Connect Ad Account</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Enter once — credentials are saved securely</div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Client</label>
              <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>Platform</label>
              <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>

            {[
              { label: 'Account Name (for your reference)', key: 'account_name', placeholder: 'e.g. Acme Corp — Search' },
              { label: form.platform === 'google' ? 'Google Ads Customer ID (e.g. 123-456-7890)' : 'Meta Ad Account ID (e.g. act_123456789)', key: 'account_id', placeholder: form.platform === 'google' ? '123-456-7890' : 'act_123456789' },
              { label: 'Access Token', key: 'access_token', placeholder: 'OAuth access token' },
              { label: 'Refresh Token', key: 'refresh_token', placeholder: 'OAuth refresh token' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mid)', marginBottom: '6px' }}>{f.label}</label>
                <input type="text" placeholder={f.placeholder} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-mid)' }}>Cancel</button>
              <button onClick={addAccount} disabled={loading || !form.client_id || !form.account_id} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'var(--cyan)', color: 'var(--black)', border: 'none' }}>
                {loading ? 'Saving...' : 'Save & Connect →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
