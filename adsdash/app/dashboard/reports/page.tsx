import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from '@/components/ReportsClient'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  let clientId: string | null = null
  if (!isAdmin) {
    const { data: c } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
    clientId = c?.id || null
  }

  const { data: clients } = isAdmin
    ? await supabase.from('clients').select('id, name, email').order('name')
    : { data: [] }

  const query = supabase
    .from('reports')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })

  const { data: reports } = isAdmin
    ? await query
    : await query.eq('client_id', clientId)

  return (
    <ReportsClient
      reports={reports || []}
      clients={clients || []}
      isAdmin={isAdmin}
    />
  )
}
