import { createAdminClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Record<string, string>
}

export default async function ReportsPage(_props: Props) {
  let reports: any[] = []
  let clients: any[] = []
  let isAdmin = false

  try {
    const cookieStore = cookies()
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: { user } } = await anonClient.auth.getUser()

    if (user) {
      const admin = createAdminClient()
      const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
      isAdmin = profile?.role === 'admin'

      if (isAdmin) {
        const [{ data: c }, { data: r }] = await Promise.all([
          admin.from('clients').select('id,name,email').order('name'),
          admin.from('reports').select('*, clients(name)').order('created_at', { ascending: false }),
        ])
        clients = c || []
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
  } catch {
    // Client-side fallback in ReportsClient useEffect will handle this
  }

  return <ReportsClient reports={reports} clients={clients} isAdmin={isAdmin} />
}