import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { clientId, dayOfMonth, sendEmail } = await req.json()
    const supabase = createAdminClient()

    await supabase.from('clients').update({
      send_monthly_report: true,
      report_day_of_month: dayOfMonth,
    }).eq('id', clientId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
