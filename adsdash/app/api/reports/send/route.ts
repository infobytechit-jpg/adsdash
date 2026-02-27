import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientId, reportId, reportData } = body
    const supabase = createAdminClient()

    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    if (!client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set in environment variables' }, { status: 400 })

    // Use provided reportData or fetch from DB
    let data = reportData
    if (!data && reportId) {
      const { data: r } = await supabase.from('reports').select('report_data').eq('id', reportId).single()
      data = r?.report_data
    }

    // Fallback: fetch fresh metrics
    if (!data) {
      const end = new Date().toISOString().split('T')[0]
      const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { data: metrics } = await supabase.from('metrics_cache').select('*').eq('client_id', clientId).gte('date', start).lte('date', end)
      const totals = (metrics||[]).reduce((a:any,m:any) => ({
        spend: a.spend+Number(m.spend||0), conversions: a.conversions+Number(m.conversions||0),
        leads: a.leads+Number(m.leads||0), clicks: a.clicks+Number(m.clicks||0),
        conversion_value: a.conversion_value+Number(m.conversion_value||0),
      }), { spend:0, conversions:0, leads:0, clicks:0, conversion_value:0 })
      totals.roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0
      data = { client, totals, start, end, selMetrics: ['spend','conversions','roas','leads','clicks'], byPlatform: {} }
    }

    const fmt = (n: number, type = 'num') => {
      const f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: type === 'x' ? 2 : 0 }).format(n)
      if (type === 'eur') return '€' + f
      if (type === 'x') return f + 'x'
      return f
    }

    const METRICS = [
      { key: 'spend', label: 'Total Spend', fmt: 'eur', color: '#00C8E0' },
      { key: 'conversion_value', label: 'Conv. Value', fmt: 'eur', color: '#a855f7' },
      { key: 'roas', label: 'ROAS', fmt: 'x', color: '#ffc53d' },
      { key: 'conversions', label: 'Conversions', fmt: 'num', color: '#00e09e' },
      { key: 'leads', label: 'Leads', fmt: 'num', color: '#f97316' },
      { key: 'clicks', label: 'Clicks', fmt: 'num', color: '#4285F4' },
      { key: 'impressions', label: 'Impressions', fmt: 'num', color: '#8ba0ae' },
    ]

    const selectedMetrics = METRICS.filter(m => (data.selMetrics || []).includes(m.key))

    const kpiGrid = selectedMetrics.map(m => {
      const val = m.key === 'roas' ? data.totals.roas : data.totals[m.key]
      return `<div style="background:#f8f9fa;border-radius:10px;padding:16px;border-left:4px solid ${m.color}">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">${m.label}</div>
        <div style="font-size:24px;font-weight:800;color:#080c0f">${fmt(val||0, m.fmt)}</div>
      </div>`
    }).join('')

    const platformHtml = Object.entries(data.byPlatform || {}).map(([plat, pd]: any) => {
      const color = plat === 'google' ? '#4285F4' : '#1877F2'
      const letter = plat === 'google' ? 'G' : 'f'
      const name = plat === 'google' ? 'Google Ads' : 'Meta Ads'
      const rows = selectedMetrics.map(m => {
        const val = m.key === 'roas' ? (pd.spend > 0 ? pd.conversion_value / pd.spend : 0) : pd[m.key]
        return `<div style="font-size:12px;color:#555;margin-bottom:3px;display:flex;justify-content:space-between"><span>${m.label}</span><strong>${fmt(val||0, m.fmt)}</strong></div>`
      }).join('')
      return `<div style="background:#f8f9fa;border-radius:10px;padding:14px 16px;flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:22px;height:22px;border-radius:5px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:11px">${letter}</div>
          <span style="font-weight:700;font-size:13px;color:#333">${name}</span>
        </div>${rows}
      </div>`
    }).join('')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adsdash.360digitalu.com'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f0f2f5;padding:24px 16px;margin:0">
<div style="max-width:600px;margin:0 auto">
<div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">
  <div style="background:#080c0f;padding:28px 32px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:24px;font-weight:900;color:white;letter-spacing:-0.5px">Ads<span style="color:#00C8E0">Dash</span></div>
      <div style="color:#2a3a45;font-size:11px;margin-top:3px">by 360DigitalU</div>
    </div>
    <div style="background:rgba(0,200,224,0.15);color:#00C8E0;font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px">PERFORMANCE REPORT</div>
  </div>
  <div style="padding:32px">
    <h2 style="font-size:20px;font-weight:800;color:#080c0f;margin:0 0 4px">Hello, ${client.name}! 👋</h2>
    <p style="color:#666;font-size:13px;margin:0 0 28px">Performance report · <strong>${data.start}</strong> → <strong>${data.end}</strong></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px">${kpiGrid}</div>
    ${platformHtml ? `<div style="display:flex;gap:10px;margin-bottom:28px">${platformHtml}</div>` : ''}
    <p style="color:#555;font-size:14px;line-height:1.6;margin-bottom:24px">Log in to your dashboard for the full breakdown by campaign, platform, and date range.</p>
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#00C8E0;color:#080c0f;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:14px">View Full Dashboard →</a>
  </div>
  <div style="background:#f8f9fa;padding:20px 32px;text-align:center;color:#aaa;font-size:11px;border-top:1px solid #eee;line-height:1.6">
    Generated by AdsDash · ${new Date().toLocaleDateString('it-IT')}<br>
    © ${new Date().getFullYear()} 360DigitalU. All rights reserved.
  </div>
</div></div></body></html>`

    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'reports@360digitalu.com',
      to: client.email,
      subject: `📊 ${client.name} — Ad Performance Report (${data.start} → ${data.end})`,
      html,
    })

    if (emailError) throw new Error(JSON.stringify(emailError))

    if (reportId) {
      await supabase.from('reports').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', reportId)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
