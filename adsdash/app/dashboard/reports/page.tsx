import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const { data: clients } = isAdmin
    ? await supabase.from('clients').select('id,name,email').order('name')
    : { data: [] }

  let clientId: string | null = null
  if (!isAdmin) {
    const { data: cl } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
    clientId = cl?.id || null
  }

  const q = supabase.from('reports').select('*, clients(name)').order('created_at', { ascending: false })
  const { data: reports } = isAdmin ? await q : await q.eq('client_id', clientId)

  return <ReportsClient reports={reports||[]} clients={clients||[]} isAdmin={isAdmin} />
}
