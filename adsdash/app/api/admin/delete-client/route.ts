import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { clientId, userId } = await req.json()
    const supabase = createAdminClient()

    // Delete client record (cascades to ad_accounts, metrics, etc.)
    await supabase.from('clients').delete().eq('id', clientId)

    // Delete auth user
    await supabase.auth.admin.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
