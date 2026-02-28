import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { clientId, updates } = await req.json()
    const supabase = createAdminClient()
    const { error } = await supabase.from('clients').update(updates).eq('id', clientId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
