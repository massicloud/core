import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n/config'

export const siteUrl = 'https://massicloud.dz'

type PageKey = 'home' | 'platform' | 'pricing' | 'compliance' | 'roadmap'

const pagePaths: Record<PageKey, string> = {
  home: '',
  platform: '/platform',
  pricing: '/pricing',
  compliance: '/compliance',
  roadmap: '/roadmap',
}

const openGraphLocales: Record<Locale, string> = {
  en: 'en_US',
  fr: 'fr_FR',
  ar: 'ar_DZ',
}

type MessageShape = {
  [key in PageKey]: {
    seo?: {
      title?: string
      description?: string
      keywords?: string[]
    }
    hero?: {
      title?: string
      subtitle?: string
    }
  }
}

export async function createPageMetadata(locale: Locale, page: PageKey): Promise<Metadata> {
  const messages = (await import(`../messages/${locale}.json`)).default as MessageShape
  const pageMessages = messages[page]
  const title = pageMessages.seo?.title ?? pageMessages.hero?.title ?? 'MassiCloud'
  const description =
    pageMessages.seo?.description ??
    pageMessages.hero?.subtitle ??
    'MassiCloud builds sovereign cloud infrastructure for Algeria.'
  const keywords = pageMessages.seo?.keywords ?? []
  const path = pagePaths[page]
  const url = `${siteUrl}/${locale}${path}`

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
      languages: {
        en: `${siteUrl}/en${path}`,
        fr: `${siteUrl}/fr${path}`,
        ar: `${siteUrl}/ar${path}`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'MassiCloud',
      title,
      description,
      locale: openGraphLocales[locale],
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: 'MassiCloud',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl}/twitter-image`],
    },
  }
}


