import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadClient from '@/components/UploadClient'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: adAccountRows } = await supabase.from('ad_accounts').select('*').order('account_name')
  const { data: metricAccounts } = await supabase.from('metrics_cache').select('client_id,platform,account_name').not('account_name','is',null)
  const { data: clientRows } = await supabase.from('clients').select('id,name').order('name')

  const existing = new Set((adAccountRows||[]).map((a:any) => `${a.client_id}|${a.platform}|${a.account_name}`))
  const seen = new Set<string>()
  const extra = (metricAccounts||[])
    .filter((m:any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
    .map((m:any, i:number) => ({ id:`metrics-${m.client_id}-${m.platform}-${i}`, client_id:m.client_id, platform:m.platform, account_name:m.account_name, from_metrics:true }))
    .filter((a:any) => { const k=`${a.client_id}|${a.platform}|${a.account_name}`; if(seen.has(k)) return false; seen.add(k); return true })

  const allAccounts = [...(adAccountRows||[]), ...extra]

  return <UploadClient clients={clientRows||[]} adAccounts={allAccounts} />
}
