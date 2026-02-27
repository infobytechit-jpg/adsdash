import { createClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let reports: any[] = [], clients: any[] = [], isAdmin = false

  if (user) {
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAdmin = p?.role === 'admin'
    if (isAdmin) {
      const { data: c } = await supabase.from('clients').select('id,name,email').order('name')
      clients = c || []
    }
    let clientId: string | null = null
    if (!isAdmin) {
      const { data: cl } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
      clientId = cl?.id || null
    }
    const q = supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false })
    const { data: r } = isAdmin ? await q : await q.eq('client_id', clientId)
    reports = r || []
  }

  return <ReportsClient reports={reports} clients={clients} isAdmin={isAdmin} />
}
