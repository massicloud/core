import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://massicloud.dz'),
  title: 'MassiCloud',
  description: 'Sovereign cloud platform for Algeria',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
