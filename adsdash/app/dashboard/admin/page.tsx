import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from '@/components/AdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      *,
      ad_accounts (id, platform, account_name, is_active)
    `)
    .order('name')

  const { data: reports } = await supabase
    .from('reports')
    .select(`*, clients (name)`)
    .order('created_at', { ascending: false })
    .limit(10)

  return <AdminClient clients={clients || []} reports={reports || []} />
}
