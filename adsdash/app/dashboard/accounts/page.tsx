import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountsClient from '@/components/AccountsClient'

export default async function AccountsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase.from('clients').select('id, name, avatar_color').order('name')
  const { data: adAccounts } = await supabase
    .from('ad_accounts')
    .select(`*, clients(name)`)
    .order('created_at', { ascending: false })

  return <AccountsClient clients={clients || []} adAccounts={adAccounts || []} />
}
