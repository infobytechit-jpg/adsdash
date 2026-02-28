import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Support both naming conventions (UI sends camelCase, normalize here)
    const action         = body.action
    const client_id      = body.clientId      || body.client_id
    const account_name   = body.accountName   || body.account_name
    const platform       = body.platform
    const source_client_id = body.sourceClientId || body.source_client_id

    // ✅ Use admin client to bypass RLS
    const supabase = createAdminClient()

    // Support both action name conventions: 'add'|'assign' and 'remove'|'unassign'
    if (action === 'assign' || action === 'add') {
      // Copy metric rows from source client to target client
      const { data: rows, error: fetchErr } = await supabase
        .from('metrics_cache')
        .select('date, spend, impressions, clicks, conversions, conversion_value, leads, raw_data')
        .eq('client_id', source_client_id)
        .eq('platform', platform)
        .eq('account_name', account_name)

      if (fetchErr) throw new Error('Fetch failed: ' + fetchErr.message)

      if (rows && rows.length > 0) {
        const copies = rows.map((r: any) => ({
          client_id, platform, account_name,
          date: r.date,
          spend: r.spend || 0,
          impressions: r.impressions || 0,
          clicks: r.clicks || 0,
          conversions: r.conversions || 0,
          conversion_value: r.conversion_value || 0,
          leads: r.leads || 0,
        }))
        for (let i = 0; i < copies.length; i += 100) {
          const batch = copies.slice(i, i + 100)
          await supabase.from('metrics_cache')
            .upsert(batch, { onConflict: 'client_id,platform,date,account_name', ignoreDuplicates: false })
        }
      }

      // Record assignment
      const { data: assignment } = await supabase
        .from('client_account_assignments')
        .upsert(
          { client_id, account_name, platform, source_client_id },
          { onConflict: 'client_id,account_name,platform' }
        )
        .select()
        .single()

      revalidatePath('/dashboard', 'layout')
      return NextResponse.json({ success: true, assignment })

    } else if (action === 'unassign' || action === 'remove') {
      await supabase.from('metrics_cache')
        .delete()
        .eq('client_id', client_id)
        .eq('platform', platform)
        .eq('account_name', account_name)

      await supabase.from('client_account_assignments')
        .delete()
        .eq('client_id', client_id)
        .eq('account_name', account_name)
        .eq('platform', platform)

      revalidatePath('/dashboard', 'layout')
      return NextResponse.json({ success: true })

    } else {
      return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 })
    }

  } catch (err: any) {
    console.error('assign-account error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
