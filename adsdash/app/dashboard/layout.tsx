import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  // Try to get user - if this fails, DashboardShell handles redirect client-side
  let profile = null
  let clients: any[] = []

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      profile = p

      const { data: c } = await supabase.from('clients').select('id, name, avatar_color').order('name')
      clients = c || []
    }
  } catch {
    // Server auth failed — shell will redirect client-side
  }

  return (
    <DashboardShell profile={profile} clients={clients}>
      {children}
    </DashboardShell>
  )
}
