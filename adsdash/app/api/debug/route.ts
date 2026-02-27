import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll().map(c => ({ 
    name: c.name, 
    length: c.value.length,
    preview: c.value.slice(0, 20) + '...'
  }))
  
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message || null,
    profile,
    cookies: allCookies,
  })
}
