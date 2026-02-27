import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createClient()
  
  // Sign out server-side
  await supabase.auth.signOut()
  
  // Clear all supabase cookies manually
  const allCookies = cookieStore.getAll()
  allCookies.forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      cookieStore.set(cookie.name, '', { maxAge: 0 })
    }
  })

  const response = NextResponse.redirect(new URL('/login', 'https://adsdash-sandy.vercel.app'))
  
  // Also clear via response headers
  allCookies.forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0 })
    }
  })

  return response
}
