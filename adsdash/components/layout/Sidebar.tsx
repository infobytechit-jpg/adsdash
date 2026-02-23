'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface Props {
  profile: any
  clients: any[]
}

export default function Sidebar({ profile, clients }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = profile?.role === 'admin'
  const selectedClient = searchParams.get('client')

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItem = (href: string, icon: string, label: string, badge?: number) => {
    const active = pathname === href
    return (
      <Link href={href} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        color: active ? 'var(--cyan)' : 'var(--text-mid)',
        background: active ? 'rgba(0,200,224,0.1)' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.15s',
        position: 'relative',
        borderLeft: active ? '3px solid var(--cyan)' : '3px solid transparent',
        marginLeft: '-3px',
      }}>
        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{icon}</span>
        {label}
        {badge && badge > 0 && (
          <span style={{
            marginLeft: 'auto',
            background: 'var(--red)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 700,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>{badge}</span>
        )}
      </Link>
    )
  }

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          background: 'var(--cyan)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 4 L11 18 L18 4" stroke="#080c0f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Ads<span style={{ color: 'var(--cyan)' }}>Dash</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Performance Hub</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '16px 12px 8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px', marginBottom: '6px' }}>
          Navigation
        </div>
        {navItem('/dashboard', '📊', 'Dashboard')}
        {isAdmin && navItem('/dashboard/admin', '⚙️', 'Admin Panel')}
        {isAdmin && navItem('/dashboard/accounts', '🔗', 'Ad Accounts')}
        {navItem('/dashboard/reports', '📄', 'Reports')}
      </div>

      {/* Client list — admin only */}
      {isAdmin && clients.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '8px 8px 6px' }}>
            Clients
          </div>
          {clients.map((c: any) => (
            <div
              key={c.id}
              onClick={() => router.push(`/dashboard?client=${c.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                color: selectedClient === c.id ? 'var(--text)' : 'var(--text-mid)',
                background: selectedClient === c.id ? 'var(--surface2)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.avatar_color || '#00C8E0', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: c.is_active ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)',
                color: c.is_active ? 'var(--green)' : 'var(--yellow)',
                fontWeight: 600,
              }}>
                {c.is_active ? 'Live' : 'Off'}
              </span>
            </div>
          ))}
          <div
            onClick={() => router.push('/dashboard/admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--cyan)',
              border: '1px dashed rgba(0,200,224,0.3)',
              marginTop: '8px',
              transition: 'all 0.15s',
            }}
          >
            <span>＋</span> Add Client
          </div>
        </div>
      )}

      {/* User footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface2)' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: isAdmin ? 'var(--cyan)' : (profile?.avatar_color || '#a855f7'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: '#080c0f',
            flexShrink: 0,
          }}>
            {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || profile?.email?.split('@')[0]}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {profile?.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
            title="Sign out"
          >
            ↩
          </button>
        </div>
      </div>
    </div>
  )
}
