import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { action, client_id, account_name, platform, source_client_id } = await req.json()
    const supabase = createClient()

    if (action === 'assign') {
      // Copy metric rows from source client to target client
      const { data: rows, error: fetchErr } = await supabase
        .from('metrics_cache')
        .select('date, spend, impressions, clicks, conversions, conversion_value, leads')
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
          const { error } = await supabase.from('metrics_cache')
            .upsert(batch, { onConflict: 'client_id,platform,date,account_name', ignoreDuplicates: false })
          if (error) {
            // Fallback: delete then insert
            for (const row of batch) {
              await supabase.from('metrics_cache')
                .delete()
                .eq('client_id', row.client_id)
                .eq('platform', row.platform)
                .eq('date', row.date)
                .eq('account_name', row.account_name)
            }
            await supabase.from('metrics_cache').insert(batch)
          }
        }
      }

      // Record assignment (ignore if table doesn't exist)
      await supabase.from('client_account_assignments')
        .upsert({ client_id, account_name, platform, source_client_id }, { onConflict: 'client_id,account_name,platform' })
        .select()

    } else if (action === 'unassign') {
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
    }

    revalidatePath('/dashboard', 'layout')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('assign-account error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
