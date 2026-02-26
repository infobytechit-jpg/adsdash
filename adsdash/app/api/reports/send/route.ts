import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function POST(req: Request) {
  try {
    const { clientId, periodStart, periodEnd, reportId } = await req.json()
    const supabase = createAdminClient()

    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Use provided period or default to last month
    const lastMonth = subMonths(new Date(), 1)
    const start = periodStart || format(startOfMonth(lastMonth), 'yyyy-MM-dd')
    const end = periodEnd || format(endOfMonth(lastMonth), 'yyyy-MM-dd')
    const monthLabel = format(new Date(start), 'MMMM yyyy')

    const { data: metrics } = await supabase
      .from('metrics_cache').select('*')
      .eq('client_id', clientId).gte('date', start).lte('date', end)

    const totals = (metrics || []).reduce((acc: any, m: any) => ({
      spend: acc.spend + Number(m.spend || 0),
      conversions: acc.conversions + Number(m.conversions || 0),
      leads: acc.leads + Number(m.leads || 0),
      clicks: acc.clicks + Number(m.clicks || 0),
      conversion_value: acc.conversion_value + Number(m.conversion_value || 0),
    }), { spend: 0, conversions: 0, leads: 0, clicks: 0, conversion_value: 0 })

    const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'
    const fmt = (n: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0 }).format(Math.round(n))
    const fmtEur = (n: number) => '€' + fmt(n)

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey.startsWith('re_xxx')) {
      // Save as generated but don't send — Resend not configured
      if (reportId) {
        await supabase.from('reports').update({ status: 'generated' }).eq('id', reportId)
      } else {
        await supabase.from('reports').insert({
          client_id: clientId, report_type: 'monthly',
          period_start: start, period_end: end, status: 'generated',
        })
      }
      return NextResponse.json({ error: 'Resend API key not configured. Report saved but not emailed. Add RESEND_API_KEY to your Vercel environment variables.' }, { status: 400 })
    }

    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const gMetrics = (metrics || []).filter((m: any) => m.platform === 'google')
    const mMetrics = (metrics || []).filter((m: any) => m.platform === 'meta')
    const gSpend = gMetrics.reduce((a: any, m: any) => a + Number(m.spend || 0), 0)
    const mSpend = mMetrics.reduce((a: any, m: any) => a + Number(m.spend || 0), 0)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adsdash-sandy.vercel.app'

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'reports@360digital.com',
      to: client.email,
      subject: `📊 ${client.name} — Ad Performance Report (${monthLabel})`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f0f2f5; padding: 24px 16px; }
  .wrap { max-width: 600px; margin: 0 auto; }
  .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }
  .hd { background: #080c0f; padding: 28px 32px; display: flex; align-items: center; justify-content: space-between; }
  .logo { font-size: 24px; font-weight: 900; color: white; letter-spacing: -0.5px; }
  .logo span { color: #00C8E0; }
  .by { color: #2a3a45; font-size: 11px; margin-top: 3px; }
  .tag { background: rgba(0,200,224,0.15); color: #00C8E0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px; letter-spacing: 0.5px; }
  .body { padding: 32px; }
  h2 { font-size: 20px; font-weight: 800; color: #080c0f; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 28px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
  .kpi { background: #f8f9fa; border-radius: 10px; padding: 16px; border-left: 4px solid #00C8E0; }
  .kpi-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .kpi-value { font-size: 24px; font-weight: 800; color: #080c0f; }
  .platforms { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 28px; }
  .plat { background: #f8f9fa; border-radius: 10px; padding: 14px 16px; }
  .plat-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .plat-icon { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px; }
  .plat-name { font-weight: 700; font-size: 13px; color: #333; }
  .plat-row { font-size: 12px; color: #555; margin-bottom: 3px; }
  .note { color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
  .btn { display: inline-block; background: #00C8E0; color: #080c0f !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 14px; }
  .ft { background: #f8f9fa; padding: 20px 32px; text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; line-height: 1.6; }
</style></head><body>
<div class="wrap"><div class="card">
  <div class="hd">
    <div><div class="logo">Ads<span>Dash</span></div><div class="by">by 360DigitalU</div></div>
    <div class="tag">MONTHLY REPORT</div>
  </div>
  <div class="body">
    <h2>Hello, ${client.name}! 👋</h2>
    <p class="sub">Ad performance for <strong>${monthLabel}</strong> (${start} → ${end})</p>
    <div class="grid">
      <div class="kpi" style="border-color:#00C8E0"><div class="kpi-label">💰 Total Spend</div><div class="kpi-value">${fmtEur(totals.spend)}</div></div>
      <div class="kpi" style="border-color:#a855f7"><div class="kpi-label">💎 Conv. Value</div><div class="kpi-value">${fmtEur(totals.conversion_value)}</div></div>
      <div class="kpi" style="border-color:#ffc53d"><div class="kpi-label">📈 ROAS</div><div class="kpi-value">${roas}x</div></div>
      <div class="kpi" style="border-color:#00e09e"><div class="kpi-label">✅ Conversions</div><div class="kpi-value">${fmt(totals.conversions)}</div></div>
      <div class="kpi" style="border-color:#f97316"><div class="kpi-label">🎯 Leads</div><div class="kpi-value">${fmt(totals.leads)}</div></div>
      <div class="kpi" style="border-color:#4285F4"><div class="kpi-label">🖱 Clicks</div><div class="kpi-value">${fmt(totals.clicks)}</div></div>
    </div>
    ${(gSpend > 0 || mSpend > 0) ? `<div class="platforms">
      ${gSpend > 0 ? `<div class="plat"><div class="plat-hd"><div class="plat-icon" style="background:#4285F4">G</div><span class="plat-name">Google Ads</span></div><div class="plat-row">Spend: <strong>${fmtEur(gSpend)}</strong></div><div class="plat-row">Conv.: <strong>${fmt(gMetrics.reduce((a: any, m: any) => a + Number(m.conversions || 0), 0))}</strong></div></div>` : ''}
      ${mSpend > 0 ? `<div class="plat"><div class="plat-hd"><div class="plat-icon" style="background:#1877F2">f</div><span class="plat-name">Meta Ads</span></div><div class="plat-row">Spend: <strong>${fmtEur(mSpend)}</strong></div><div class="plat-row">Conv.: <strong>${fmt(mMetrics.reduce((a: any, m: any) => a + Number(m.conversions || 0), 0))}</strong></div></div>` : ''}
    </div>` : ''}
    <p class="note">Log in to your dashboard for the full breakdown by campaign, platform, and date range.</p>
    <a href="${appUrl}/dashboard" class="btn">View Full Dashboard →</a>
  </div>
  <div class="ft">
    This report was generated by AdsDash · ${new Date().toLocaleDateString('it-IT')}<br>
    © ${new Date().getFullYear()} 360DigitalU. All rights reserved.
  </div>
</div></div></body></html>`,
    })

    if (emailError) throw new Error(emailError.message)

    // Update or create report record
    if (reportId) {
      await supabase.from('reports').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', reportId)
    } else {
      await supabase.from('reports').insert({
        client_id: clientId, report_type: 'monthly',
        period_start: start, period_end: end,
        status: 'sent', sent_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
