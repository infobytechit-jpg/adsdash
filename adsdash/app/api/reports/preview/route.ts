import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { clientId, start, end } = await req.json()
    const supabase = createAdminClient()

    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const { data: metrics } = await supabase
      .from('metrics_cache').select('*')
      .eq('client_id', clientId).gte('date', start).lte('date', end)

    const totals = (metrics || []).reduce((acc: any, m: any) => ({
      spend: acc.spend + Number(m.spend || 0),
      conversions: acc.conversions + Number(m.conversions || 0),
      leads: acc.leads + Number(m.leads || 0),
      clicks: acc.clicks + Number(m.clicks || 0),
      impressions: acc.impressions + Number(m.impressions || 0),
      conversion_value: acc.conversion_value + Number(m.conversion_value || 0),
    }), { spend: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0, conversion_value: 0 })

    const gMetrics = (metrics || []).filter((m: any) => m.platform === 'google')
    const mMetrics = (metrics || []).filter((m: any) => m.platform === 'meta')
    const pt = (rows: any[]) => rows.reduce((a: any, m: any) => ({
      spend: a.spend + Number(m.spend || 0),
      conversions: a.conversions + Number(m.conversions || 0),
      leads: a.leads + Number(m.leads || 0),
      conversion_value: a.conversion_value + Number(m.conversion_value || 0),
    }), { spend: 0, conversions: 0, leads: 0, conversion_value: 0 })

    return NextResponse.json({
      reportData: {
        clientName: client.name, clientEmail: client.email,
        period: `${start} → ${end}`, periodStart: start, periodEnd: end,
        totals, roas: totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00',
        google: gMetrics.length > 0 ? pt(gMetrics) : null,
        meta: mMetrics.length > 0 ? pt(mMetrics) : null,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
