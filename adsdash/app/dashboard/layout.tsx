import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If profile doesn't exist yet (race condition after signup), wait briefly
  if (!profile) redirect('/login')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, avatar_color')
    .order('name')

  return (
    <DashboardShell profile={profile} clients={clients || []}>
      {children}
    </DashboardShell>
  )
}
