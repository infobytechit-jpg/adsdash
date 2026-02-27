'use client'

import { useState } from 'react'
import { loginAction } from '@/app/login/actions'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#0e1419', border: '1px solid #1f2d38', borderRadius: '20px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
            <rect width="56" height="56" rx="14" fill="#00C8E0"/>
            <path d="M19 17 L28 36 L37 17" stroke="#080c0f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 800, color: '#e8f0f5', margin: 0 }}>
            Ads<span style={{ color: '#00C8E0' }}>Dash</span>
          </h1>
          <p style={{ color: '#3a5060', fontSize: '12px', fontWeight: 500, marginTop: '4px', marginBottom: 0 }}>by 360DigitalU</p>
          <p style={{ color: '#5a7080', fontSize: '13px', marginTop: '10px' }}>Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8ba0ae', marginBottom: '6px' }}>Email</label>
            <input name="email" type="email" placeholder="you@company.com" required
              style={{ width: '100%', background: '#1a2530', border: '1px solid #1f2d38', color: '#e8f0f5', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}/>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8ba0ae', marginBottom: '6px' }}>Password</label>
            <input name="password" type="password" placeholder="••••••••" required
              style={{ width: '100%', background: '#1a2530', border: '1px solid #1f2d38', color: '#e8f0f5', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}/>
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

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#5a7080', marginTop: '20px' }}>Contact your administrator to get access.</p>
      </div>
      <div style={{ position: 'fixed', bottom: '20px', left: '24px', fontSize: '11px', color: '#2a3a45', fontWeight: 500 }}>
        © {new Date().getFullYear()} 360DigitalU. All rights reserved.
      </div>
    </div>
  )
}
