import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { client_id, platform, account_name, ad_account_id, from_metrics } = await req.json()

    // Skip if this is just a revalidate ping
    if (client_id === '_revalidate_only_') {
      revalidatePath('/dashboard', 'layout')
      return NextResponse.json({ success: true })
    }

    const supabase = createClient()

    // Delete metric rows — handle null/Default account_name
    const isDefault = !account_name || account_name === 'Default' || account_name === 'null'
    
    let deleteResult
    if (isDefault) {
      deleteResult = await supabase
        .from('metrics_cache')
        .delete()
        .eq('client_id', client_id)
        .eq('platform', platform)
        .or('account_name.is.null,account_name.eq.Default')
    } else {
      deleteResult = await supabase
        .from('metrics_cache')
        .delete()
        .eq('client_id', client_id)
        .eq('platform', platform)
        .eq('account_name', account_name)
    }

    if (deleteResult.error) {
      // If filtering by platform fails, try without platform filter
      const fallback = await supabase
        .from('metrics_cache')
        .delete()
        .eq('client_id', client_id)
        .eq('account_name', account_name)
      
      if (fallback.error) {
        throw new Error('Delete failed: ' + fallback.error.message)
      }
    }

    // Delete from ad_accounts if it has a real DB id
    if (!from_metrics && ad_account_id && !ad_account_id.startsWith('metrics-') && !ad_account_id.startsWith('local-')) {
      await supabase.from('ad_accounts').delete().eq('id', ad_account_id)
    }

    // Also remove any assignments
    await supabase
      .from('client_account_assignments')
      .delete()
      .eq('client_id', client_id)
      .eq('platform', platform)
      .eq('account_name', account_name)

    revalidatePath('/dashboard', 'layout')
    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('delete-account error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
