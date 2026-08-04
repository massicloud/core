import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, unstable_setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales, localeDirections, type Locale } from '@/lib/i18n/config'
import { Nav } from '@/components/layout/nav'
import { Footer } from '@/components/layout/footer'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  metadataBase: new URL('https://massicloud.dz'),
  applicationName: 'MassiCloud',
  title: {
    default: 'MassiCloud — Sovereign cloud for Algeria',
    template: '%s · MassiCloud',
  },
  description:
    'The first sovereign developer platform for Algeria. Postgres, storage, and compliance built to Law 18-07.',
  category: 'technology',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'MassiCloud',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/twitter-image'],
  },
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!locales.includes(locale as Locale)) notFound()

  unstable_setRequestLocale(locale)
  const messages = await getMessages()
  const dir = localeDirections[locale as Locale]

  return (
    <html lang={locale} dir={dir} className="dark">
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <Nav locale={locale as Locale} />
          <main className="min-h-screen">{children}</main>
          <Footer locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
