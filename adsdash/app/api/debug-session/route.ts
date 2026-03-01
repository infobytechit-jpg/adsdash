import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const authCookie = cookieStore.get('sb-fipzxxkvrnelkkkdrwzt-auth-token')

  let parsed: any = null
  let userId: string | null = null

  if (authCookie?.value) {
    try {
      // Try direct parse
      parsed = JSON.parse(authCookie.value)
      userId = parsed?.user?.id || parsed?.[0]?.user?.id || null
    } catch {
      try {
        // Try base64 decode first
        const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8')
        parsed = JSON.parse(decoded)
        userId = parsed?.user?.id || null
      } catch {
        parsed = { raw: authCookie.value.slice(0, 100) + '...' }
      }
    }
  }

  let profile = null
  let clientRecord = null
  let metricsCount = 0

  if (userId) {
    const admin = createAdminClient()
    const { data: p } = await admin.from('profiles').select('*').eq('id', userId).single()
    profile = p
    if (p?.role !== 'admin') {
      const { data: c } = await admin.from('clients').select('*').eq('user_id', userId).single()
      clientRecord = c
      if (c) {
        const { count } = await admin.from('metrics_cache').select('*', { count: 'exact', head: true }).eq('client_id', c.id)
        metricsCount = count || 0
      }
    }
  }

  return NextResponse.json({
    cookieFound: !!authCookie,
    cookieLength: authCookie?.value?.length,
    parsedKeys: parsed ? Object.keys(parsed) : null,
    userId,
    profile: profile ? { id: profile.id, email: profile.email, role: profile.role } : null,
    clientRecord: clientRecord ? { id: clientRecord.id, name: clientRecord.name } : null,
    metricsCount,
  })
}
