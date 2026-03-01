import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value, valueLength: c.value?.length }))

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user }, error: userError } = await anonClient.auth.getUser()

  let profile = null
  let clientRecord = null

  if (user) {
    const admin = createAdminClient()
    const { data: p } = await admin.from('profiles').select('*').eq('id', user.id).single()
    profile = p
    if (p) {
      const { data: c } = await admin.from('clients').select('*').eq('user_id', user.id).single()
      clientRecord = c
    }
  }

  return NextResponse.json({
    cookies: allCookies,
    user: user ? { id: user.id, email: user.email } : null,
    userError: userError?.message,
    profile,
    clientRecord,
  })
}
