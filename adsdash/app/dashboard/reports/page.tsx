import { createAdminClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  let reports: any[] = [], clients: any[] = [], isAdmin = false

  try {
    // Try to get user from cookie (may fail on Vercel)
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
      isAdmin = p?.role === 'admin'

      if (isAdmin) {
        const { data: c } = await admin.from('clients').select('id,name,email').order('name')
        clients = c || []
        const { data: r } = await admin.from('reports').select('*, clients(name)').order('created_at', { ascending: false })
        reports = r || []
      } else {
        const { data: cl } = await admin.from('clients').select('id,name,email').eq('user_id', user.id).single()
        if (cl) {
          clients = [cl]
          const { data: r } = await admin.from('reports').select('*, clients(name)').eq('client_id', cl.id).order('created_at', { ascending: false })
          reports = r || []
        }
      }
    }
    // If user is null, ReportsClient will load data client-side via its useEffect
  } catch {
    // ReportsClient will load data client-side via its useEffect
  }

  return <ReportsClient reports={reports} clients={clients} isAdmin={isAdmin} />
}