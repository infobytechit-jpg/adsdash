import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; platform?: string; account?: string; client?: string; start?: string; end?: string }
}) {
  const period = searchParams.period || 'week'
  const platform = searchParams.platform || 'all'
  const selectedAccount = searchParams.account || 'all'
  const customStart = searchParams.start || ''
  const customEnd = searchParams.end || ''

  const empty = (profile: any = null, clientData: any = null, isAdmin = false) => (
    <DashboardClient
      profile={profile} clientData={clientData} metrics={[]} campaigns={[]}
      period={period} platform={platform} isAdmin={isAdmin}
      accounts={[]} selectedAccount={selectedAccount}
    />
  )

  try {
    const cookieStore = cookies()

    // ✅ Try to get user from cookie session
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await anonClient.auth.getUser()

    // ✅ If no user from cookie, try getting from admin client via all cookies
    // This handles edge cases where cookie format differs
    let userId: string | null = user?.id || null

    if (!userId) {
      // Last resort: check all cookies for supabase session
      const allCookies = cookieStore.getAll()
      const sessionCookie = allCookies.find(c =>
        c.name.includes('auth-token') || c.name.includes('session')
      )
      if (sessionCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sessionCookie.value))
          userId = parsed?.user?.id || parsed?.id || null
        } catch {}
      }
    }

    if (!userId) {
      // No session found server-side — return empty, DashboardClient will load client-side
      return empty()
    }

    const admin = createAdminClient()

    // Get profile using admin client (bypasses RLS)
    const { data: profile } = await admin
      .from('profiles').select('*').eq('id', userId).single()

    if (!profile) return empty()

    const isAdmin = profile.role === 'admin'

    // Determine client
    let clientId: string | null = null
    let clientData: any = null

    if (isAdmin && searchParams.client) {
      const { data } = await admin.from('clients').select('*').eq('id', searchParams.client).single()
      clientData = data; clientId = data?.id
    } else if (isAdmin) {
      const { data } = await admin.from('clients').select('*').order('name').limit(1).single()
      clientData = data; clientId = data?.id
    } else {
      // ✅ For client users: look up by user_id
      const { data } = await admin.from('clients').select('*').eq('user_id', userId).single()
      clientData = data; clientId = data?.id
    }

    if (!clientId) return empty(profile, clientData, isAdmin)

    // Date range
    const endDate = new Date()
    const startDate = new Date()

    let startStr: string, endStr: string
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

    // Available accounts
    const { data: accData } = await admin
      .from('metrics_cache')
      .select('account_name')
      .eq('client_id', clientId)
      .not('account_name', 'is', null)

    const accounts = Array.from(new Set(
      (accData || []).map((a: any) => a.account_name).filter(Boolean)
    )) as string[]

    // Metrics
    let metricsQ = admin.from('metrics_cache').select('*')
      .eq('client_id', clientId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date')
    if (platform !== 'all') metricsQ = metricsQ.eq('platform', platform)
    if (selectedAccount !== 'all') metricsQ = metricsQ.eq('account_name', selectedAccount)
    const { data: metrics } = await metricsQ

    // Campaigns
    const { data: campaigns } = await admin
      .from('campaign_metrics')
      .select('*, campaigns(campaign_name, platform, status)')
      .eq('client_id', clientId)
      .gte('date', startStr)
      .lte('date', endStr)

    return (
      <DashboardClient
        profile={profile}
        clientData={clientData}
        metrics={metrics || []}
        campaigns={campaigns || []}
        period={period}
        platform={platform}
        isAdmin={isAdmin}
        accounts={accounts}
        selectedAccount={selectedAccount}
      />
    )
  } catch (err) {
    console.error('DashboardPage error:', err)
    return empty()
  }
}
