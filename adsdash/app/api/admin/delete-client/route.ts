import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { client_id, platform, account_name, ad_account_id, from_metrics } = await req.json()
    const supabase = createClient()

    // Build delete query — handle both named accounts and null/Default
    let query = supabase
      .from('metrics_cache')
      .delete()
      .eq('client_id', client_id)

    // Only filter by platform if it's provided and not 'all'
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform)
    }

    // Filter by account_name — handle null case
    if (!account_name || account_name === 'Default') {
      // Delete rows where account_name is null OR 'Default'
      query = query.or('account_name.is.null,account_name.eq.Default')
    } else {
      query = query.eq('account_name', account_name)
    }

    const { error: metricsError } = await query
    if (metricsError) throw new Error('Metrics delete failed: ' + metricsError.message)

    // Delete from ad_accounts table if it exists there
    if (!from_metrics && ad_account_id) {
      await supabase.from('ad_accounts').delete().eq('id', ad_account_id)
    }

    // Revalidate entire dashboard layout cache
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
