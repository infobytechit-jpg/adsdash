import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [{ data: clients }, { data: adAccountRows }, { data: metricAccounts }] = await Promise.all([
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('ad_accounts').select('*').order('account_name'),
      supabase.from('metrics_cache').select('client_id,platform,account_name').not('account_name', 'is', null),
    ])

    const existing = new Set((adAccountRows || []).map((a: any) => `${a.client_id}|${a.platform}|${a.account_name}`))
    const seen = new Set<string>()
    const extra = (metricAccounts || [])
      .filter((m: any) => m.account_name && !existing.has(`${m.client_id}|${m.platform}|${m.account_name}`))
      .map((m: any, i: number) => ({
        id: `metrics-${m.client_id}-${m.platform}-${i}`,
        client_id: m.client_id,
        platform: m.platform,
        account_name: m.account_name,
        from_metrics: true,
      }))
      .filter((a: any) => {
        const k = `${a.client_id}|${a.platform}|${a.account_name}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

    const allAccounts = [...(adAccountRows || []), ...extra]

    return NextResponse.json({ clients: clients || [], adAccounts: allAccounts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
