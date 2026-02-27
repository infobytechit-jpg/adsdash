'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Give the cookie a moment to be set, then navigate
    await new Promise(r => setTimeout(r, 300))
    router.replace('/dashboard')
    router.refresh()
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#080c0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#00C8E0', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080c0f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: '#0e1419', border: '1px solid #1f2d38',
        borderRadius: '20px', padding: '40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
            <rect width="56" height="56" rx="14" fill="#00C8E0"/>
            <circle cx="11" cy="11" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="19" cy="11" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="28" cy="11" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="37" cy="11" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="45" cy="11" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="11" cy="19" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="45" cy="19" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="11" cy="28" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="45" cy="28" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="11" cy="37" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="45" cy="37" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="19" cy="45" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="28" cy="45" r="2.2" fill="#080c0f" opacity="0.5"/>
            <circle cx="37" cy="45" r="2.2" fill="#080c0f" opacity="0.5"/>
            <path d="M19 17 L28 36 L37 17" stroke="#080c0f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 800, color: '#e8f0f5', margin: 0 }}>
            Ads<span style={{ color: '#00C8E0' }}>Dash</span>
          </h1>
          <p style={{ color: '#3a5060', fontSize: '12px', fontWeight: 500, marginTop: '4px', marginBottom: 0, letterSpacing: '0.3px' }}>
            by 360DigitalU
          </p>
          <p style={{ color: '#5a7080', fontSize: '13px', marginTop: '10px' }}>Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8ba0ae', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required style={{ width: '100%' }}/>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8ba0ae', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: '100%' }}/>
          </div>

          {error && (
            <div style={{ background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#ff4d6a', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? '#00a8be' : '#00C8E0', color: '#080c0f', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700, fontFamily: 'Syne, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#5a7080', marginTop: '20px' }}>
          Contact your administrator to get access.
        </p>
      </div>

      <div style={{ position: 'fixed', bottom: '20px', left: '24px', fontSize: '11px', color: '#2a3a45', fontWeight: 500 }}>
        © {new Date().getFullYear()} 360DigitalU. All rights reserved.
      </div>
    </div>
  )
}
