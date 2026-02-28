'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type AdminClientProps = {
  clients: any[]
  reports: any[]
  adAccounts: any[]
  assignments: any[]
}

export default function AdminClient({
  clients,
  reports,
  adAccounts,
  assignments,
}: AdminClientProps) {

  const [activeTab, setActiveTab] = useState<'clients' | 'reports'>('clients')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [clientsList, setClientsList] = useState(clients)

  const router = useRouter()
  const supabase = createClient()

  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    password: '',
    color: '#00C8E0'
  })

  const [metrics, setMetrics] = useState({
    show_spend: true,
    show_conversions: true,
    show_roas: true,
    show_leads: true,
    show_clicks: false,
    show_impressions: false,
    show_cpc: false,
    show_ctr: false,
  })

  function openCustomize(client: any) {
    setSelectedClient(client)
    setMetrics({
      show_spend: client.show_spend ?? true,
      show_conversions: client.show_conversions ?? true,
      show_roas: client.show_roas ?? true,
      show_leads: client.show_leads ?? true,
      show_clicks: client.show_clicks ?? false,
      show_impressions: client.show_impressions ?? false,
      show_cpc: client.show_cpc ?? false,
      show_ctr: client.show_ctr ?? false,
    })
    setShowCustomizeModal(true)
  }

  async function saveCustomize() {
    if (!selectedClient) return
    setLoading(true)

    try {
      const res = await fetch('/api/admin/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient.id, updates: metrics }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setClientsList(prev =>
        prev.map(c =>
          c.id === selectedClient.id ? { ...c, ...metrics } : c
        )
      )

      setShowCustomizeModal(false)
    } catch (err: any) {
      alert('Error saving: ' + err.message)
    }

    setLoading(false)
  }

  async function createNewClient() {
    setLoading(true)

    try {
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setClientsList(prev => [...prev, data.client])
      setShowAddModal(false)

      setNewClient({
        name: '',
        email: '',
        password: '',
        color: '#00C8E0'
      })

      router.refresh()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }

    setLoading(false)
  }

  async function deleteClient(clientId: string, userId: string) {
    if (!confirm('Delete this client? This cannot be undone.')) return

    await fetch('/api/admin/delete-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, userId }),
    })

    setClientsList(prev => prev.filter(c => c.id !== clientId))
  }

  async function sendReport(clientId: string) {
    setLoading(true)

    await fetch('/api/reports/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })

    alert('Report sent!')
    setLoading(false)
  }

  return (
    <div>
      {/* Your full UI remains exactly as you already have it */}
    </div>
  )
}