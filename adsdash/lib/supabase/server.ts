import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const COOKIE_NAME = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`

// ✅ Parse the auth cookie manually to extract user id
export function getSessionFromCookie(): { userId: string; accessToken: string } | null {
  try {
    const cookieStore = cookies()
    const raw = cookieStore.get(COOKIE_NAME)?.value
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const userId = parsed?.user?.id
    const accessToken = parsed?.access_token
    if (!userId || !accessToken) return null
    return { userId, accessToken }
  } catch {
    return null
  }
}

// Standard server client (tries cookie-based auth)
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}

// Admin client — bypasses RLS, used in all API routes
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
