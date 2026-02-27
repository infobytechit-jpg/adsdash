import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { client?: string; period?: string; platform?: string; account?: string }
}) {
  const supabase = createClient()

  let profile = null
  let clientData = null
  let metrics: any[] = []
  let campaigns: any[] = []
  let accounts: string[] = []

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      profile = p

      const isAdmin = p?.role === 'admin'
      let clientId: string | null = null

      if (isAdmin && searchParams.client) {
        clientId = searchParams.client
        const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
        clientData = data
      } else if (!isAdmin) {
        const { data } = await supabase.from('clients').select('*').eq('user_id', user.id).single()
        clientData = data
        clientId = data?.id
      } else {
        const { data } = await supabase.from('clients').select('*').order('name').limit(1).single()
        clientData = data
        clientId = data?.id
      }

      if (clientId) {
        const period = searchParams.period || 'week'
        const platform = searchParams.platform || 'all'
        const accountName = searchParams.account || 'all'

        const endDate = new Date()
        const startDate = new Date()
        if (period === 'today') startDate.setHours(0, 0, 0, 0)
        else if (period === 'week') startDate.setDate(startDate.getDate() - 7)
        else if (period === 'month') startDate.setDate(1)
        else startDate.setFullYear(startDate.getFullYear() - 1)

        const startStr = startDate.toISOString().split('T')[0]
        const endStr = endDate.toISOString().split('T')[0]

        const { data: accountData } = await supabase
          .from('metrics_cache').select('account_name')
          .eq('client_id', clientId).not('account_name', 'is', null)
        accounts = Array.from(new Set((accountData || []).map((a: any) => a.account_name).filter(Boolean)))

        let q = supabase.from('metrics_cache').select('*')
          .eq('client_id', clientId).gte('date', startStr).lte('date', endStr).order('date')
        if (platform !== 'all') q = q.eq('platform', platform)
        if (accountName !== 'all') q = q.eq('account_name', accountName)
        const { data: m } = await q
        metrics = m || []

        const { data: c } = await supabase.from('campaign_metrics')
          .select('*, campaigns(campaign_name, platform, status, platform_campaign_id)')
          .eq('client_id', clientId).gte('date', startStr).lte('date', endStr)
        campaigns = c || []
      }
    }
  } catch {
    // Client-side auth in DashboardShell will handle redirect if needed
  }

  return (
    <DashboardClient
      profile={profile}
      clientData={clientData}
      metrics={metrics}
      campaigns={campaigns}
      period={searchParams.period || 'week'}
      platform={searchParams.platform || 'all'}
      isAdmin={profile?.role === 'admin'}
      accounts={accounts}
      selectedAccount={searchParams.account || 'all'}
    />
  )
}
