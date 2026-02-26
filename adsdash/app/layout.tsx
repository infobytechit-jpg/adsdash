import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AdsDash — Performance Dashboard',
  description: 'Google Ads & Meta Ads performance dashboard',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body style={{ margin: 0, background: '#080c0f' }}>{children}</body>
    </html>
  )
}
