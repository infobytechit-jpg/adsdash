import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'

function buildReportData(client: any, metrics: any[], start: string, end: string) {
  const totals = (metrics || []).reduce((acc: any, m: any) => ({
    spend: acc.spend + Number(m.spend || 0),
    conversions: acc.conversions + Number(m.conversions || 0),
    leads: acc.leads + Number(m.leads || 0),
    clicks: acc.clicks + Number(m.clicks || 0),
    impressions: acc.impressions + Number(m.impressions || 0),
    conversion_value: acc.conversion_value + Number(m.conversion_value || 0),
  }), { spend: 0, conversions: 0, leads: 0, clicks: 0, impressions: 0, conversion_value: 0 })

  const gMetrics = metrics.filter(m => m.platform === 'google')
  const mMetrics = metrics.filter(m => m.platform === 'meta')

  const platformTotals = (rows: any[]) => rows.reduce((a: any, m: any) => ({
    spend: a.spend + Number(m.spend || 0),
    conversions: a.conversions + Number(m.conversions || 0),
    leads: a.leads + Number(m.leads || 0),
    conversion_value: a.conversion_value + Number(m.conversion_value || 0),
  }), { spend: 0, conversions: 0, leads: 0, conversion_value: 0 })

  const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'
  const period = `${start} → ${end}`

  return {
    clientName: client.name,
    clientEmail: client.email,
    period,
    periodStart: start,
    periodEnd: end,
    totals,
    roas,
    google: gMetrics.length > 0 ? platformTotals(gMetrics) : null,
    meta: mMetrics.length > 0 ? platformTotals(mMetrics) : null,
  }
}

export async function POST(req: Request) {
  try {
    const { clientId, period, customStart, customEnd } = await req.json()
    const supabase = createAdminClient()

    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    let start: string, end: string, reportType = 'monthly'

    if (period === 'custom' && customStart && customEnd) {
      start = customStart; end = customEnd; reportType = 'custom'
    } else if (period === 'last_week') {
      const now = new Date()
      const lastMon = new Date(now); lastMon.setDate(now.getDate() - now.getDay() - 6)
      const lastSun = new Date(now); lastSun.setDate(now.getDate() - now.getDay())
      start = format(lastMon, 'yyyy-MM-dd'); end = format(lastSun, 'yyyy-MM-dd'); reportType = 'weekly'
    } else {
      const lastMonth = subMonths(new Date(), 1)
      start = format(startOfMonth(lastMonth), 'yyyy-MM-dd')
      end = format(endOfMonth(lastMonth), 'yyyy-MM-dd')
    }

    const { data: metrics } = await supabase
      .from('metrics_cache').select('*')
      .eq('client_id', clientId).gte('date', start).lte('date', end)

    const reportData = buildReportData(client, metrics || [], start, end)

    const { data: report } = await supabase.from('reports').insert({
      client_id: clientId, report_type: reportType,
      period_start: start, period_end: end, status: 'generated',
    }).select('*, clients(name)').single()

    revalidatePath('/dashboard/reports')
    return NextResponse.json({ success: true, report, reportData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
