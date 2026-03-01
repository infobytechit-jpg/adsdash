import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: any) {
  const period = searchParams?.period || 'week'
  const platform = searchParams?.platform || 'all'
  const selectedAccount = searchParams?.account || 'all'
  const customStart = searchParams?.start || ''
  const customEnd = searchParams?.end || ''

  const empty = () => (
    <DashboardClient
      profile={null} clientData={null} metrics={[]} campaigns={[]}
      period={period} platform={platform} isAdmin={false}
      accounts={[]} selectedAccount={selectedAccount}
    />
  )

  try {
    const cookieStore = cookies()
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return empty()

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return empty()

    const isAdmin = profile.role === 'admin'
    let clientId: string | null = null
    let clientData: any = null

    if (isAdmin && searchParams?.client) {
      const { data } = await admin.from('clients').select('*').eq('id', searchParams.client).single()
      clientData = data; clientId = data?.id
    } else if (isAdmin) {
      const { data } = await admin.from('clients').select('*').order('name').limit(1).single()
      clientData = data; clientId = data?.id
    } else {
      const { data } = await admin.from('clients').select('*').eq('user_id', user.id).single()
      clientData = data; clientId = data?.id
    }

    if (!clientId) return (
      <DashboardClient
        profile={profile} clientData={clientData} metrics={[]} campaigns={[]}
        period={period} platform={platform} isAdmin={isAdmin}
        accounts={[]} selectedAccount={selectedAccount}
      />
    )

    // Date range
    let startStr: string, endStr: string
    const endDate = new Date()
    const startDate = new Date()

    if (period === 'custom' && customStart && customEnd) {
      startStr = customStart
      endStr = customEnd
    } else {
      if (period === 'today') startDate.setHours(0, 0, 0, 0)
      else if (period === 'week') startDate.setDate(startDate.getDate() - 7)
      else if (period === 'month') startDate.setDate(1)
      else startDate.setFullYear(startDate.getFullYear() - 1)
      startStr = startDate.toISOString().split('T')[0]
      endStr = endDate.toISOString().split('T')[0]
    }

    // Accounts
    const { data: accData } = await admin
      .from('metrics_cache').select('account_name')
      .eq('client_id', clientId).not('account_name', 'is', null)
    const accounts = Array.from(new Set(
      (accData || []).map((a: any) => a.account_name).filter(Boolean)
    )) as string[]

    // Metrics
    let metricsQ = admin.from('metrics_cache').select('*')
      .eq('client_id', clientId).gte('date', startStr).lte('date', endStr).order('date')
    if (platform !== 'all') metricsQ = metricsQ.eq('platform', platform)
    if (selectedAccount !== 'all') metricsQ = metricsQ.eq('account_name', selectedAccount)
    const { data: metrics } = await metricsQ

    // Campaigns
    const { data: campaigns } = await admin
      .from('campaign_metrics').select('*, campaigns(campaign_name, platform, status)')
      .eq('client_id', clientId).gte('date', startStr).lte('date', endStr)

    return (
      <DashboardClient
        profile={profile} clientData={clientData}
        metrics={metrics || []} campaigns={campaigns || []}
        period={period} platform={platform} isAdmin={isAdmin}
        accounts={accounts} selectedAccount={selectedAccount}
      />
    )
  } catch (err) {
    console.error('DashboardPage error:', err)
    return empty()
  }
}
