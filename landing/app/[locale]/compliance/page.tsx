import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import { createPageMetadata } from '@/lib/seo'
import { AlertTriangle, FileCheck2, Landmark, LockKeyhole, ShieldCheck } from 'lucide-react'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}) {
  return createPageMetadata(locale as Locale, 'compliance')
}

export default async function CompliancePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('compliance')

  const laws = ['law1807', 'law2511'] as const
  const requirements = [
    'residency',
    'anpdp',
    'dpo',
    'audit',
    'consent',
    'breach',
    'transfers',
    'encryption',
  ] as const
  const assurances = [
    { key: 'architecture', icon: ShieldCheck },
    { key: 'jurisdiction', icon: Landmark },
    { key: 'controls', icon: LockKeyhole },
    { key: 'evidence', icon: FileCheck2 },
  ] as const

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8">
      <section className="section-reveal py-20 lg:py-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-sm text-brand-gold">
            <ShieldCheck size={16} />
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
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('laws.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('laws.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('laws.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {laws.map((law) => (
            <article key={law} className="interactive-card glass-card rounded-3xl p-6 lg:p-8">
              <p className="text-sm font-medium text-brand-gold">{t(`laws.cards.${law}.label`)}</p>
              <h3 className="mt-3 text-2xl font-semibold text-text-white">{t(`laws.cards.${law}.title`)}</h3>
              <p className="mt-4 text-sm leading-7 text-text-muted">{t(`laws.cards.${law}.description`)}</p>
              <ul className="mt-6 space-y-3 text-sm text-text-faint">
                {[1, 2, 3].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-gold" />
                    <span>{t(`laws.cards.${law}.point${point}`)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('requirements.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('requirements.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('requirements.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {requirements.map((item, index) => (
            <article key={item} className="interactive-card rounded-3xl border border-border bg-bg-panel p-6">
              <span className="text-sm font-semibold text-brand-gold">0{index + 1}</span>
              <h3 className="mt-4 text-xl font-semibold text-text-white">{t(`requirements.items.${item}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t(`requirements.items.${item}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="rounded-4xl border border-brand-red/30 bg-brand-red/10 p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-red/20 bg-bg-deep/40 px-4 py-2 text-sm text-brand-red">
                <AlertTriangle size={16} />
                {t('penalty.badge')}
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-text-white md:text-4xl">{t('penalty.title')}</h2>
              <p className="mt-4 text-lg leading-8 text-text-muted">{t('penalty.subtitle')}</p>
            </div>

            <div className="rounded-3xl border border-brand-red/20 bg-bg-deep/60 px-8 py-6 text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-brand-red">{t('penalty.maximumLabel')}</p>
              <p className="mt-3 text-4xl font-semibold text-text-white">{t('penalty.amount')}</p>
              <p className="mt-3 max-w-xs text-sm leading-7 text-text-muted">{t('penalty.note')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('assurances.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('assurances.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('assurances.subtitle')}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {assurances.map(({ key, icon: Icon }) => (
              <article key={key} className="interactive-card glass-card rounded-3xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-panel text-brand-gold">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`assurances.items.${key}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{t(`assurances.items.${key}.description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-reveal pb-20 pt-16 lg:pb-28 lg:pt-20">
        <div className="rounded-4xl border border-border bg-gradient-to-br from-brand-blue-deep/40 via-bg-panel to-bg-panel p-8 lg:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('cta.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('cta.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('cta.subtitle')}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-6 py-3 text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
            >
              {t('cta.primary')}
            </Link>
            <Link
              href={`/${locale}/roadmap`}
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
