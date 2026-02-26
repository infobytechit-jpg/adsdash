import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { client?: string; period?: string; platform?: string; account?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin'
  let clientId: string | null = null
  let clientData: any = null

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

  let metrics: any[] = []
  let campaigns: any[] = []
  let accounts: string[] = []

  if (clientId) {
    const { data: accountData } = await supabase
      .from('metrics_cache')
      .select('account_name')
      .eq('client_id', clientId)
      .not('account_name', 'is', null)

   accounts = Array.from(new Set((accountData || []).map((a: any) => a.account_name).filter(Boolean)))

    let metricsQuery = supabase
      .from('metrics_cache')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    if (platform !== 'all') metricsQuery = metricsQuery.eq('platform', platform)
    if (accountName !== 'all') metricsQuery = metricsQuery.eq('account_name', accountName)

    const { data: metricsData } = await metricsQuery
    metrics = metricsData || []

    const { data: campData } = await supabase
      .from('campaign_metrics')
      .select('*, campaigns(campaign_name, platform, status, platform_campaign_id)')
      .eq('client_id', clientId)
      .gte('date', startStr)
      .lte('date', endStr)
    campaigns = campData || []
  }

  return (
    <DashboardClient
      profile={profile}
      clientData={clientData}
      metrics={metrics}
      campaigns={campaigns}
      period={period}
      platform={platform}
      isAdmin={isAdmin}
      accounts={accounts}
      selectedAccount={accountName}
    />
  )
}
