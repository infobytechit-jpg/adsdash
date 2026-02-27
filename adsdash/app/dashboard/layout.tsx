import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    if (!profile) redirect('/login')

    const { data: clients } = await supabase
      .from('clients').select('id, name, avatar_color').order('name')

    return (
      <DashboardShell profile={profile} clients={clients || []}>
        {children}
      </DashboardShell>
    )
  } catch {
    redirect('/login')
  }
}
