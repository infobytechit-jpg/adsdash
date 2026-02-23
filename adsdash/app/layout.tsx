import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AdsDash — Performance Dashboard',
  description: 'Google Ads & Meta Ads performance dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080c0f' }}>{children}</body>
    </html>
  )
}
