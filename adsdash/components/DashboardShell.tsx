'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  profile: any
  clients: any[]
  children: React.ReactNode
}

export default function DashboardShell({ profile, clients, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const selectedClient = searchParams.get('client') || (clients[0]?.id ?? '')

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '▦' },
    ...(isAdmin ? [
      { href: '/dashboard/accounts', label: 'Ad Accounts', icon: '🔗' },
      { href: '/dashboard/admin', label: 'Admin', icon: '⚙' },
      { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    ] : [
      { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    ]),
  ]

  const W = collapsed ? '64px' : '220px'

  return (
    <>
      <style>{`
        :root {
          --black: #080c0f;
          --surface: #0e1419;
          --surface2: #121a21;
          --surface3: #1a2530;
          --border: #1f2d38;
          --cyan: #00C8E0;
          --green: #00e09e;
          --yellow: #ffc53d;
          --red: #ff4d6a;
          --purple: #a855f7;
          --text: #e8f0f5;
          --text-mid: #8ba0ae;
          --text-muted: #5a7080;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--black); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; }
        input, select, textarea {
          width: 100%;
          background: var(--surface3);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          font-family: inherit;
        }
        input:focus, select:focus { border-color: var(--cyan); }
        input::placeholder { color: var(--text-muted); }
        select option { background: var(--surface); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', background: 'var(--black)', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: W, minWidth: W, height: '100vh', background: 'var(--surface)',
          borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
          transition: 'width 0.2s, min-width 0.2s', overflow: 'hidden', flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: collapsed ? '0 16px' : '0 20px', borderBottom: '1px solid var(--border)', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 5 L9 14 L14 5" stroke="#080c0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {!collapsed && (
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                Ads<span style={{ color: 'var(--cyan)' }}>Dash</span>
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '4px', flexShrink: 0 }}>
              {collapsed ? '→' : '←'}
            </button>
          </div>

          {/* Client selector (admin only) */}
          {isAdmin && !collapsed && clients.length > 0 && (
            <div style={{ padding: '12px 12px 0' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', paddingLeft: '4px' }}>Client</div>
              <select
                value={selectedClient}
                onChange={e => router.push(`/dashboard?client=${e.target.value}`)}
                style={{ fontSize: '12px', padding: '7px 10px' }}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
            {navItems.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <button key={item.href} onClick={() => router.push(item.href)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px',
                  background: active ? 'rgba(0,200,224,0.12)' : 'transparent',
                  color: active ? 'var(--cyan)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          {/* Profile + logout */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: collapsed ? '8px 0' : '8px 12px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: profile?.avatar_color || 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#080c0f', flexShrink: 0 }}>
                {profile?.full_name?.slice(0, 2).toUpperCase() || profile?.email?.slice(0, 2).toUpperCase() || 'AD'}
              </div>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || profile?.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--cyan)', fontWeight: 600 }}>{profile?.role}</div>
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', padding: collapsed ? '8px 0' : '8px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '8px', justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
              <span>⎋</span>
              {!collapsed && 'Sign out'}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {children}
        </div>
      </div>
    </>
  )
}
