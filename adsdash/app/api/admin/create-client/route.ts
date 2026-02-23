import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { name, email, password, color } = await req.json()
    const supabase = createAdminClient()

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'client' },
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const userId = authData.user.id

    // 2. Update profile role to client
    await supabase.from('profiles').update({ role: 'client', full_name: name, avatar_color: color }).eq('id', userId)

    // 3. Create client record
    const { data: clientData, error: clientError } = await supabase.from('clients').insert({
      user_id: userId,
      name,
      email,
      avatar_color: color,
    }).select().single()

    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 400 })

    return NextResponse.json({ client: clientData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
