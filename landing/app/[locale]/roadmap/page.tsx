import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import { createPageMetadata } from '@/lib/seo'
import { ArrowRight, Flag, Milestone, TimerReset } from 'lucide-react'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}) {
  return createPageMetadata(locale as Locale, 'roadmap')
}

export default async function RoadmapPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('roadmap')

  const progressCards = ['phases', 'services', 'compliance'] as const
  const quarters = ['q32026', 'q42026', 'q12027', 'q22027', 'q32027', 'q42027', 'y2028'] as const

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8">
      <section className="section-reveal py-20 lg:py-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-sm text-brand-gold">
            <Milestone size={16} />
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('now.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('now.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('now.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {progressCards.map((card) => (
            <article key={card} className="interactive-card glass-card rounded-3xl p-6">
              <p className="text-sm text-text-muted">{t(`now.cards.${card}.label`)}</p>
              <p className="mt-3 text-4xl font-semibold text-text-white">{t(`now.cards.${card}.value`)}</p>
              <p className="mt-3 text-sm leading-7 text-text-faint">{t(`now.cards.${card}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('timeline.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('timeline.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('timeline.subtitle')}</p>
        </div>

        <div className="mt-10 space-y-6">
          {quarters.map((quarter, index) => (
            <article key={quarter} className="interactive-card rounded-3xl border border-border bg-bg-panel p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-surface px-4 py-2 text-sm text-text-muted">
                    <TimerReset size={15} />
                    {t(`timeline.items.${quarter}.period`)}
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">0{index + 1}</p>
                  <h3 className="text-2xl font-semibold text-text-white">{t(`timeline.items.${quarter}.title`)}</h3>
                  <p className="text-sm leading-7 text-text-muted">{t(`timeline.items.${quarter}.summary`)}</p>
                </div>

                <div className="rounded-3xl border border-border bg-bg-deep/50 p-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-brand-blue">
                    <Flag size={16} />
                    {t(`timeline.items.${quarter}.theme`)}
                  </div>
                  <ul className="mt-5 space-y-3 text-sm text-text-faint">
                    {[1, 2, 3].map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-gold" />
                        <span>{t(`timeline.items.${quarter}.point${point}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal pb-20 pt-16 lg:pb-28 lg:pt-20">
        <div className="rounded-4xl border border-border bg-gradient-to-br from-brand-gold-deep/40 via-bg-panel to-bg-panel p-8 lg:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('cta.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('cta.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('cta.subtitle')}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/platform`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
            >
              {t('cta.primary')}
              <ArrowRight size={16} />
            </Link>
            <Link
              href={`/${locale}/pricing`}
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
