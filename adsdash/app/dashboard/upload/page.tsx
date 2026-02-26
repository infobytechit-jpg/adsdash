import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadClient from '@/components/UploadClient'

export default async function UploadPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients').select('id, name, avatar_color').order('name')

  const { data: adAccounts } = await supabase
    .from('ad_accounts').select('*').order('account_name')

  return <UploadClient clients={clients || []} adAccounts={adAccounts || []} />
}
