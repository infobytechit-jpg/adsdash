'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  profile: any
  clients: any[]
  children: React.ReactNode
}

const STYLES = `
  :root {
    --black:#080c0f;--surface:#0e1419;--surface2:#121a21;--surface3:#1a2530;
    --border:#1f2d38;--cyan:#00C8E0;--green:#00e09e;--yellow:#ffc53d;
    --red:#ff4d6a;--purple:#a855f7;--text:#e8f0f5;--text-mid:#8ba0ae;--text-muted:#5a7080;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--black);color:var(--text);font-family:'Inter',-apple-system,sans-serif;}
  input,select,textarea{width:100%;background:var(--surface3);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;}
  input:focus,select:focus{border-color:var(--cyan);}
  input::placeholder{color:var(--text-muted);}
  select option{background:var(--surface);}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  @keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.3;}40%{transform:scale(1);opacity:1;}}
  .ld{width:8px;height:8px;border-radius:50%;background:var(--cyan);display:inline-block;animation:dotPulse 1.2s infinite ease-in-out;}
  .ld:nth-child(2){animation-delay:0.2s;}.ld:nth-child(3){animation-delay:0.4s;}

  /* Desktop sidebar visible, mobile nav hidden */
  @media(min-width:769px){
    .sidebar{display:flex!important;}
    .mobile-header{display:none!important;}
    .mobile-nav{display:none!important;}
    .main-content{padding-bottom:0!important;}
  }
  /* Mobile: hide sidebar, show header + bottom nav */
  @media(max-width:768px){
    .sidebar{display:none!important;}
    .mobile-header{display:flex!important;}
    .mobile-nav{display:flex!important;}
    .main-content{padding-bottom:64px!important;}
  }
`

function Sidebar({ profile, clients, navItems, selectedClient, pathname, onNavigate, onLogout, onClientChange }: any) {
  return (
    <>
      <div style={{height:'64px',display:'flex',alignItems:'center',padding:'0 20px',borderBottom:'1px solid var(--border)',gap:'10px',flexShrink:0}}>
        <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'var(--cyan)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 5 L9 14 L14 5" stroke="#080c0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{fontFamily:'Syne,sans-serif',fontSize:'18px',fontWeight:800}}>Ads<span style={{color:'var(--cyan)'}}>Dash</span></span>
      </div>

      {profile?.role === 'admin' && clients.length > 0 && (
        <div style={{padding:'12px 12px 0'}}>
          <div style={{fontSize:'10px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'6px',paddingLeft:'4px'}}>Client</div>
          <select value={selectedClient} onChange={e => onClientChange(e.target.value)} style={{fontSize:'12px',padding:'7px 10px'}}>
            {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <nav style={{flex:1,padding:'12px 8px',overflowY:'auto'}}>
        {navItems.map((item:any) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <button key={item.href} onClick={() => onNavigate(item.href)} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',borderRadius:'8px',border:'none',cursor:'pointer',marginBottom:'2px',background:active?'rgba(0,200,224,0.12)':'transparent',color:active?'var(--cyan)':'var(--text-muted)',fontSize:'13px',fontWeight:active?600:400}}>
              <span style={{fontSize:'16px'}}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div style={{padding:'12px 8px',borderTop:'1px solid var(--border)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',marginBottom:'4px'}}>
          <div style={{width:'30px',height:'30px',borderRadius:'8px',background:profile?.avatar_color||'var(--cyan)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:800,color:'#080c0f',flexShrink:0}}>
            {profile?.email?.slice(0,2).toUpperCase()||'..'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.full_name||profile?.email?.split('@')[0]}</div>
            <div style={{fontSize:'10px',color:'var(--cyan)',fontWeight:600}}>{profile?.role}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{width:'100%',padding:'8px 12px',borderRadius:'8px',border:'none',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
          <span>⎋</span> Sign out
        </button>
      </div>
    </>
  )
}

export default function DashboardShell({ profile, clients, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const selectedClient = searchParams.get('client') || (clients[0]?.id ?? '')

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '▦' },
    ...(isAdmin ? [
      { href: '/dashboard/upload', label: 'Import Data', icon: '⬆' },
      { href: '/dashboard/admin', label: 'Admin', icon: '⚙' },
      { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    ] : [
      { href: '/dashboard/reports', label: 'Reports', icon: '📊' },
    ]),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navigate(href: string) {
    setPageLoading(true)
    router.push(href)
    setMobileOpen(false)
    setTimeout(() => setPageLoading(false), 600)
  }

  const sp = {
    profile, clients, navItems, selectedClient, pathname,
    onNavigate: navigate, onLogout: handleLogout,
    onClientChange: (id: string) => router.push(`/dashboard?client=${id}`)
  }

  return (
    <>
      <style>{STYLES}</style>
      <div style={{display:'flex',height:'100vh',background:'var(--black)',overflow:'hidden'}}>

        {/* ── Desktop Sidebar ── */}
        <div className="sidebar" style={{width:'220px',minWidth:'220px',height:'100vh',background:'var(--surface)',borderRight:'1px solid var(--border)',flexDirection:'column',flexShrink:0}}>
          <Sidebar {...sp}/>
        </div>

        {/* ── Main area ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

          {/* Mobile top header */}
          <div className="mobile-header" style={{height:'56px',background:'var(--surface)',borderBottom:'1px solid var(--border)',alignItems:'center',padding:'0 16px',gap:'12px',flexShrink:0}}>
            <button onClick={() => setMobileOpen(true)} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',fontSize:'22px',lineHeight:1,padding:'4px',flexShrink:0}}>☰</button>
            <span style={{fontFamily:'Syne,sans-serif',fontSize:'16px',fontWeight:800,flex:1}}>Ads<span style={{color:'var(--cyan)'}}>Dash</span></span>
            {/* Client switcher in mobile header for admin */}
            {isAdmin && clients.length > 0 && (
              <select value={selectedClient} onChange={e => router.push(`/dashboard?client=${e.target.value}`)}
                style={{fontSize:'12px',padding:'5px 8px',maxWidth:'130px',width:'auto'}}>
                {clients.map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Page content */}
          <div className="main-content" style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            {children}
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div style={{position:'fixed',inset:0,zIndex:200}}>
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.7)'}} onClick={() => setMobileOpen(false)}/>
          <div style={{position:'absolute',left:0,top:0,bottom:0,width:'260px',background:'var(--surface)',display:'flex',flexDirection:'column',borderRight:'1px solid var(--border)'}}>
            <Sidebar {...sp}/>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <div className="mobile-nav" style={{position:'fixed',bottom:0,left:0,right:0,height:'64px',background:'var(--surface)',borderTop:'1px solid var(--border)',alignItems:'center',justifyContent:'space-around',zIndex:100,padding:'0 4px'}}>
        {navItems.slice(0,4).map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <button key={item.href} onClick={() => navigate(item.href)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',background:'none',border:'none',cursor:'pointer',padding:'8px 4px',color:active?'var(--cyan)':'var(--text-muted)',flex:1,minWidth:0}}>
              <span style={{fontSize:'20px'}}>{item.icon}</span>
              <span style={{fontSize:'10px',fontWeight:active?600:400,whiteSpace:'nowrap'}}>{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      {/* Page transition loader */}
      {pageLoading && (
        <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(8,12,15,0.6)',backdropFilter:'blur(2px)',pointerEvents:'none'}}>
          <div style={{display:'flex',gap:'8px'}}><div className="ld"/><div className="ld"/><div className="ld"/></div>
        </div>
      )}
    </>
  )
}