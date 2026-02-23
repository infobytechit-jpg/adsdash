import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  let clientId = null
  if (!isAdmin) {
    const { data: c } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
    clientId = c?.id
  }

  const query = supabase.from('reports').select(`*, clients(name)`).order('created_at', { ascending: false })
  const { data: reports } = isAdmin ? await query : await query.eq('client_id', clientId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700 }}>Reports</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Download or view your performance reports</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {(!reports || reports.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>No reports yet</div>
            <div>Reports are generated automatically each month and can be sent manually from the Admin panel.</div>
          </div>
        ) : (
          reports.map((r: any) => (
            <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(0,200,224,0.1)', border: '1px solid rgba(0,200,224,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📊</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.clients?.name} — {r.report_type} report</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.period_start} → {r.period_end}</div>
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: r.status === 'sent' ? 'rgba(0,224,158,0.15)' : 'rgba(255,197,61,0.15)', color: r.status === 'sent' ? 'var(--green)' : 'var(--yellow)' }}>
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
