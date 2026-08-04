import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DOCS_URL } from '@/lib/env'

export default async function DocsPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('docs')

  const docsHref =
    locale === 'en'
      ? `${DOCS_URL}/get-started/welcome`
      : `${DOCS_URL}/${locale}/get-started/welcome`

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8 py-20">
      <h1 className="text-display-xl font-bold text-gradient-cool mb-4">
        {t('hero.title')}
      </h1>
      <p className="text-xl text-text-muted max-w-2xl mb-8">{t('hero.subtitle')}</p>
      <Link
        href={docsHref}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
      >
        Read the docs
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}
