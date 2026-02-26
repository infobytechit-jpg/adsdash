import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/AdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients')
    .select(`*, ad_accounts (id, platform, account_name, is_active)`)
    .order('name')

  const { data: reports } = await supabase
    .from('reports')
    .select(`*, clients (name)`)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: adAccountRows } = await supabase
    .from('ad_accounts').select('*').order('account_name')

  // Load unique account names from metrics_cache (manually created)
  const { data: metricAccounts } = await supabase
    .from('metrics_cache')
    .select('client_id, platform, account_name')
    .not('account_name', 'is', null)

  const existing = new Set(
    (adAccountRows || []).map((a: any) => `${a.client_id}|${a.platform}|${a.account_name}`)
  )

  const seen = new Set<string>()
  const extraAccounts = (metricAccounts || [])
    .filter((m: any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
    .map((m: any, i: number) => ({
      id: `metrics-${m.client_id}-${m.platform}-${i}`,
      client_id: m.client_id, platform: m.platform,
      account_name: m.account_name, is_active: true, from_metrics: true,
    }))
    .filter((a: any) => {
      const key = `${a.client_id}|${a.platform}|${a.account_name}`
      if (seen.has(key)) return false
      seen.add(key); return true
    })

  const allAccounts = [...(adAccountRows || []), ...extraAccounts]

  // Load assignments
  const { data: assignments } = await supabase
    .from('client_account_assignments')
    .select('*')

  return (
    <AdminClient
      clients={clients || []}
      reports={reports || []}
      adAccounts={allAccounts}
      assignments={assignments || []}
    />
  )
}
