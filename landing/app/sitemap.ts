import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n/config'
import { siteUrl } from '@/lib/seo'

const pages = ['', '/platform', '/pricing', '/compliance', '/roadmap', '/docs']

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${siteUrl}/${locale}${page}`,
      lastModified: now,
      changeFrequency: page === '' ? 'weekly' : 'monthly',
      priority: page === '' ? 1 : 0.8,
    }))
  )
}

