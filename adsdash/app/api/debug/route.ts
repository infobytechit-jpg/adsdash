import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  const { data: profile } = user 
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message || null,
    profile: profile || null,
    timestamp: new Date().toISOString(),
  })
}
