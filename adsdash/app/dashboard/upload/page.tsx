import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadClient from '@/components/UploadClient'

export default async function UploadPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients').select('id, name, avatar_color').order('name')

  // Load from ad_accounts table
  const { data: adAccountRows } = await supabase
    .from('ad_accounts').select('*').order('account_name')

  // Also load unique account names from metrics_cache (manually created ones)
  const { data: metricAccounts } = await supabase
    .from('metrics_cache')
    .select('client_id, platform, account_name')
    .not('account_name', 'is', null)

  // Merge: start with ad_accounts, add any from metrics_cache not already present
  const existing = new Set(
    (adAccountRows || []).map((a: any) => `${a.client_id}|${a.platform}|${a.account_name}`)
  )

  const extraAccounts = (metricAccounts || [])
    .filter((m: any) =>
      m.account_name &&
      !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`)
    )
    .map((m: any, i: number) => ({
      id: `metrics-${m.client_id}-${m.platform}-${m.account_name}-${i}`,
      client_id: m.client_id,
      platform: m.platform,
      account_name: m.account_name,
      is_active: true,
    }))

  // Deduplicate extras
  const seen = new Set<string>()
  const uniqueExtras = extraAccounts.filter((a: any) => {
    const key = `${a.client_id}|${a.platform}|${a.account_name}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })

  const allAccounts = [...(adAccountRows || []), ...uniqueExtras]

  return (
    <UploadClient
      clients={clients || []}
      adAccounts={allAccounts}
    />
  )
}
