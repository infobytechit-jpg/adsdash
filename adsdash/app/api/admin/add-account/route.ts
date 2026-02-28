import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { clientId, platform, accountName, accountId } = await req.json()
    if (!clientId || !platform || !accountName) {
      return NextResponse.json({ error: 'clientId, platform and accountName are required' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const { data: account, error } = await supabase
      .from('ad_accounts')
      .insert({
        client_id: clientId,
        platform,
        account_name: accountName,
        account_id: accountId || null,
        is_active: true,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ account })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
