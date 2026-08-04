import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import { createPageMetadata } from '@/lib/seo'
import { Check, CircleHelp, WalletCards } from 'lucide-react'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}) {
  return createPageMetadata(locale as Locale, 'pricing')
}

export default async function PricingPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('pricing')

  const tiers = ['starter', 'growth', 'enterprise'] as const
  const faqs = ['currency', 'invoicing', 'contracts', 'migration'] as const

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8">
      <section className="section-reveal py-20 lg:py-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-sm text-brand-gold">
            <WalletCards size={16} />
            {t('hero.badge')}
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-gradient-cool md:text-6xl lg:text-display-xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-8 text-text-muted">{t('hero.subtitle')}</p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-text-faint">{t('hero.description')}</p>
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="grid gap-6 xl:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier}
              className={`rounded-3xl border p-6 lg:p-8 ${
                tier === 'growth'
                  ? 'interactive-card border-brand-gold/40 bg-gradient-to-b from-brand-gold/10 to-bg-panel shadow-lg shadow-brand-gold/10'
                  : 'interactive-card border-border bg-bg-panel'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-brand-gold">{t(`tiers.${tier}.badge`)}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-text-white">{t(`tiers.${tier}.name`)}</h2>
                </div>
                {tier === 'growth' ? (
                  <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold">
                    {t('tiers.growth.highlight')}
                  </span>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-7 text-text-muted">{t(`tiers.${tier}.description`)}</p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-semibold text-text-white">{t(`tiers.${tier}.price`)}</span>
                <span className="pb-1 text-sm text-text-muted">{t(`tiers.${tier}.period`)}</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-text-faint">
                {[1, 2, 3, 4, 5].map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-green" />
                    <span>{t(`tiers.${tier}.feature${feature}`)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier === 'enterprise' ? `/${locale}/compliance` : 'https://app.massicloud.dz/signup'}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                  tier === 'growth'
                    ? 'bg-brand-gold text-bg-deep hover:opacity-90'
                    : 'border border-border text-text-white hover:border-border-light hover:bg-bg-surface'
                }`}
              >
                {t(`tiers.${tier}.cta`)}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-bg-panel p-6">
          <p className="text-sm font-medium text-brand-gold">{t('note.title')}</p>
          <p className="mt-2 text-sm leading-7 text-text-muted">{t('note.description')}</p>
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('faq.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('faq.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('faq.subtitle')}</p>
        </div>

        <div className="mt-10 space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={faq}
              className="group rounded-2xl border border-border bg-bg-panel p-6"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-text-white">
                <span>{t(`faq.items.${faq}.question`)}</span>
                <CircleHelp size={18} className="shrink-0 text-brand-gold transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-4 text-sm leading-7 text-text-muted">{t(`faq.items.${faq}.answer`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section-reveal pb-20 pt-16 lg:pb-28 lg:pt-20">
        <div className="rounded-4xl border border-border bg-gradient-to-br from-bg-panel via-bg-panel to-brand-gold-deep/40 p-8 lg:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('cta.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('cta.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('cta.subtitle')}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="https://app.massicloud.dz/signup"
              className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-6 py-3 text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
            >
              {t('cta.primary')}
            </Link>
            <Link
              href={`/${locale}/platform`}
              className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-text-white transition-colors hover:border-border-light hover:bg-bg-surface"
            >
              {t('cta.secondary')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
