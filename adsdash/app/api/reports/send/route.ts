import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clientId, reportId, reportData } = body

    if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

    const supabase = createAdminClient()

    const { data: client, error: clientErr } = await supabase
      .from('clients').select('*').eq('id', clientId).single()
    if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    if (!client.email) return NextResponse.json({ error: `Client "${client.name}" has no email address set` }, { status: 400 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set in Vercel environment variables' }, { status: 400 })

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'reports@360digitalu.com'

    // Format helper
    const fmt = (n: number, type: string) => {
      const num = Number(n) || 0
      const f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: type === 'x' ? 2 : 0 }).format(num)
      return type === 'eur' ? '€' + f : type === 'x' ? f + 'x' : f
    }

    // Build report data if not provided
    let data = reportData
    if (!data && reportId) {
      const { data: r } = await supabase.from('reports').select('report_data,period_start,period_end').eq('id', reportId).single()
      data = r?.report_data
    }
    if (!data) {
      // Fallback: fetch last 7 days
      const end = new Date().toISOString().split('T')[0]
      const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { data: m } = await supabase.from('metrics_cache').select('*').eq('client_id', clientId).gte('date', start).lte('date', end)
      const totals = (m || []).reduce((a: any, row: any) => ({
        spend: a.spend + Number(row.spend || 0),
        conversion_value: a.conversion_value + Number(row.conversion_value || 0),
        conversions: a.conversions + Number(row.conversions || 0),
        leads: a.leads + Number(row.leads || 0),
        clicks: a.clicks + Number(row.clicks || 0),
      }), { spend: 0, conversion_value: 0, conversions: 0, leads: 0, clicks: 0 })
      totals.roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0
      data = { client, totals, start, end, selMetrics: ['spend', 'conversions', 'roas', 'leads'], byPlatform: {} }
    }

    const METRIC_DEFS: any[] = [
      { key: 'spend',            label: 'Total Spend',   fmtType: 'eur', color: '#00C8E0' },
      { key: 'conversion_value', label: 'Conv. Value',   fmtType: 'eur', color: '#a855f7' },
      { key: 'roas',             label: 'ROAS',          fmtType: 'x',   color: '#ffc53d' },
      { key: 'conversions',      label: 'Conversions',   fmtType: 'num', color: '#00e09e' },
      { key: 'leads',            label: 'Leads',         fmtType: 'num', color: '#f97316' },
      { key: 'clicks',           label: 'Clicks',        fmtType: 'num', color: '#4285F4' },
    ]

    const selMetrics: string[] = data.selMetrics || ['spend', 'conversions', 'roas', 'leads']
    const selected = METRIC_DEFS.filter(m => selMetrics.includes(m.key))

    const kpiRows = selected.map(m => {
      const val = m.key === 'roas' ? (data.totals.roas || 0) : (data.totals[m.key] || 0)
      return `<td width="50%" style="padding:6px"><div style="background:#f8f9fa;border-radius:10px;padding:16px;border-left:4px solid ${m.color}"><div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-family:Arial,sans-serif">${m.label}</div><div style="font-size:22px;font-weight:800;color:#080c0f;font-family:Arial,sans-serif">${fmt(val, m.fmtType)}</div></div></td>`
    })

    // Build 2-column rows
    const kpiHtml = kpiRows.reduce((html: string, cell: string, i: number) => {
      if (i % 2 === 0) return html + '<tr>' + cell
      return html + cell + '</tr>'
    }, '')
    const kpiGrid = `<table width="100%" cellpadding="0" cellspacing="0">${kpiHtml}${kpiRows.length % 2 !== 0 ? '<td width="50%"></td></tr>' : ''}</table>`

    const platformEntries = Object.entries(data.byPlatform || {})
    const platformHtml = platformEntries.length > 0 ? `
      <div style="margin-bottom:24px"><table width="100%" cellpadding="0" cellspacing="6"><tr>
      ${platformEntries.map(([plat, pd]: any) => {
        const color = plat === 'google' ? '#4285F4' : '#1877F2'
        const name = plat === 'google' ? 'Google Ads' : 'Meta Ads'
        const rows = selected.map(m => {
          const val = m.key === 'roas' ? (pd.spend > 0 ? pd.conversion_value / pd.spend : 0) : (pd[m.key] || 0)
          return `<tr><td style="font-size:12px;color:#666;padding:3px 0;font-family:Arial,sans-serif">${m.label}</td><td style="font-size:12px;font-weight:700;color:#080c0f;text-align:right;font-family:Arial,sans-serif">${fmt(val, m.fmtType)}</td></tr>`
        }).join('')
        return `<td style="padding:6px"><div style="background:#f8f9fa;border-radius:10px;padding:14px 16px"><div style="display:flex;align-items:center;margin-bottom:10px"><div style="width:22px;height:22px;border-radius:5px;background:${color};color:white;font-weight:800;font-size:11px;text-align:center;line-height:22px;font-family:Arial,sans-serif">${plat === 'google' ? 'G' : 'f'}</div><span style="font-weight:700;font-size:13px;color:#333;margin-left:8px;font-family:Arial,sans-serif">${name}</span></div><table width="100%">${rows}</table></div></td>`
      }).join('')}
      </tr></table></div>` : ''

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adsdash.360digitalu.com'

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:24px 16px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
  <tr><td style="background:#080c0f;padding:28px 32px">
    <table width="100%"><tr>
      <td><div style="font-size:24px;font-weight:900;color:white;font-family:Arial,sans-serif">Ads<span style="color:#00C8E0">Dash</span></div><div style="color:#2a3a45;font-size:11px;margin-top:3px;font-family:Arial,sans-serif">by 360DigitalU</div></td>
      <td align="right"><div style="background:rgba(0,200,224,0.15);color:#00C8E0;font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px;display:inline-block;font-family:Arial,sans-serif">PERFORMANCE REPORT</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px">
    <h2 style="font-size:20px;font-weight:800;color:#080c0f;margin:0 0 4px;font-family:Arial,sans-serif">Hello, ${client.name}! 👋</h2>
    <p style="color:#666;font-size:13px;margin:0 0 24px;font-family:Arial,sans-serif">Performance report for <strong>${data.start}</strong> → <strong>${data.end}</strong></p>
    ${kpiGrid}
    ${platformHtml}
    <p style="color:#555;font-size:14px;line-height:1.6;margin:24px 0;font-family:Arial,sans-serif">Log in to your dashboard for the full breakdown by campaign, platform, and date range.</p>
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#00C8E0;color:#080c0f;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:14px;font-family:Arial,sans-serif">View Full Dashboard →</a>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:20px 32px;text-align:center;border-top:1px solid #eee">
    <p style="color:#aaa;font-size:11px;margin:0;font-family:Arial,sans-serif">Generated by AdsDash · ${new Date().toLocaleDateString('it-IT')}<br>© ${new Date().getFullYear()} 360DigitalU. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

    // Send with Resend
    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const { data: sent, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: client.email,
      subject: `📊 ${client.name} — Performance Report (${data.start} → ${data.end})`,
      html,
    })

    if (emailError) {
      console.error('Resend error:', JSON.stringify(emailError))
      throw new Error(typeof emailError === 'object' ? JSON.stringify(emailError) : String(emailError))
    }

    // Mark report as sent
    if (reportId) {
      await supabase.from('reports').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', reportId)
    }

    return NextResponse.json({ success: true, emailId: sent?.id, sentTo: client.email })
  } catch (err: any) {
    console.error('Send route error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
