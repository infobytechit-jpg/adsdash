import { createAdminClient } from '@/lib/supabase/server'
import UploadClient from '@/components/UploadClient'

export const dynamic = 'force-dynamic'

export default async function UploadPage() {
  const supabase = createAdminClient()

  let clientRows: any[] = [], allAccounts: any[] = []

  try {
    const { data: adAccountRows } = await supabase.from('ad_accounts').select('*').order('account_name')
    const { data: metricAccounts } = await supabase.from('metrics_cache').select('client_id,platform,account_name').not('account_name', 'is', null)
    const { data: c } = await supabase.from('clients').select('id,name').order('name')
    clientRows = c || []
    const existing = new Set((adAccountRows || []).map((a: any) => `${a.client_id}|${a.platform}|${a.account_name}`))
    const seen = new Set<string>()
    const extra = (metricAccounts || [])
      .filter((m: any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
      .map((m: any, i: number) => ({ id: `metrics-${m.client_id}-${m.platform}-${i}`, client_id: m.client_id, platform: m.platform, account_name: m.account_name, from_metrics: true }))
      .filter((a: any) => { const k = `${a.client_id}|${a.platform}|${a.account_name}`; if (seen.has(k)) return false; seen.add(k); return true })
    allAccounts = [...(adAccountRows || []), ...extra]
  } catch (e) {
    // Will fall back to client-side fetch in UploadClient
  }

  return <UploadClient clients={clientRows} adAccounts={allAccounts} />
}
