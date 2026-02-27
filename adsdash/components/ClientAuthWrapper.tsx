'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardShell from '@/components/DashboardShell'

export default function ClientAuthWrapper({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'unauth'>('loading')
  const [profile, setProfile] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setState('unauth')
        window.location.href = '/login'
        return
      }

      const supabase = createClient()
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('clients').select('id, name, avatar_color').order('name'),
      ])

      if (!p) {
        setState('unauth')
        window.location.href = '/login'
        return
      }

      setProfile(p)
      setClients(c || [])
      setState('ready')
    })
  }, [])

  // Always show loading until auth confirmed — never flash children unauthenticated
  if (state !== 'ready') {
    return (
      <div style={{ minHeight: '100vh', background: '#080c0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes dp { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }
          .ld { width:8px;height:8px;border-radius:50%;background:#00C8E0;display:inline-block;animation:dp 1.2s infinite ease-in-out }
          .ld:nth-child(2){animation-delay:.2s} .ld:nth-child(3){animation-delay:.4s}
        `}</style>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="ld"/><div className="ld"/><div className="ld"/>
        </div>
      </div>
    )
  }

  return <DashboardShell profile={profile} clients={clients}>{children}</DashboardShell>
}
