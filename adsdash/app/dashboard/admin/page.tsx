import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [c, r, a, ma, asgn] = await Promise.all([
    supabase.from('clients').select('*, ad_accounts(id,platform,account_name,is_active)').order('name'),
    supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('ad_accounts').select('*').order('account_name'),
    supabase.from('metrics_cache').select('client_id,platform,account_name').not('account_name','is',null),
    supabase.from('client_account_assignments').select('*'),
  ])

  const adAccountRows = a.data || []
  const metricAccounts = ma.data || []
  const existing = new Set(adAccountRows.map((a: any) => `${a.client_id}|${a.platform}|${a.account_name}`))
  const seen = new Set<string>()
  const extra = metricAccounts
    .filter((m: any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
    .map((m: any, i: number) => ({ id: `metrics-${m.client_id}-${m.platform}-${i}`, client_id: m.client_id, platform: m.platform, account_name: m.account_name, is_active: true, from_metrics: true }))
    .filter((a: any) => { const k = `${a.client_id}|${a.platform}|${a.account_name}`; if (seen.has(k)) return false; seen.add(k); return true })

  return <AdminClient clients={c.data||[]} reports={r.data||[]} adAccounts={[...adAccountRows,...extra]} assignments={asgn.data||[]} />
}
