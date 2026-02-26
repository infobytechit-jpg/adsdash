import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { client_id, platform, old_name, new_name, ad_account_id, from_metrics } = await req.json()
    const supabase = createClient()

    // Always update metrics_cache
    await supabase
      .from('metrics_cache')
      .update({ account_name: new_name })
      .eq('client_id', client_id)
      .eq('platform', platform)
      .eq('account_name', old_name)

    // Also update ad_accounts if it exists there
    if (!from_metrics && ad_account_id) {
      await supabase
        .from('ad_accounts')
        .update({ account_name: new_name })
        .eq('id', ad_account_id)
    }

    // Revalidate ALL dashboard paths
    revalidatePath('/dashboard', 'layout')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
