import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get clients list (admins see all, clients see none in sidebar)
  let clients: any[] = []
  if (profile?.role === 'admin') {
    const { data } = await supabase.from('clients').select('id, name, avatar_color, is_active').order('name')
    clients = data || []
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#080c0f' }}>
      <Sidebar profile={profile} clients={clients} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
