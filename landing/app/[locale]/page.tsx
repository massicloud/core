import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import { createPageMetadata } from '@/lib/seo'
import { APP_URL } from '@/lib/env'
import {
  ArrowRight,
  Database,
  FileStack,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}) {
  return createPageMetadata(locale as Locale, 'home')
}

export default async function HomePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('home')

  const pillars = [
    { key: 'sovereignty', icon: ShieldCheck },
    { key: 'developerExperience', icon: Sparkles },
    { key: 'compliance', icon: Landmark },
  ] as const

  const previews = [
    { key: 'postgres', icon: Database },
    { key: 'storage', icon: FileStack },
    { key: 'controlPlane', icon: Workflow },
  ] as const

  const sovereignty = [
    { key: 'residency', icon: Lock },
    { key: 'jurisdiction', icon: Landmark },
    { key: 'lawReady', icon: ShieldCheck },
    { key: 'founder', icon: Sparkles },
  ] as const

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8">
      <section className="section-reveal py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="motion-safe:animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-sm text-brand-gold">
              <span className="h-2 w-2 rounded-full bg-brand-gold" />
              {t('badge')}
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight text-gradient-cool md:text-6xl lg:text-display-xl">
              {t('hero.title')}
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-8 text-text-muted">{t('hero.subtitle')}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-text-faint">{t('hero.description')}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${APP_URL}/signup`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-6 py-3 text-sm font-semibold text-bg-deep transition-opacity hover:opacity-90"
              >
                {t('hero.primaryCta')}
                <ArrowRight size={16} />
              </Link>
              <Link
                href={`/${locale}/platform`}
                className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-text-white transition-colors hover:border-border-light hover:bg-bg-surface"
              >
                {t('hero.secondaryCta')}
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {['phases', 'services', 'compliance'].map((item) => (
                <div key={item} className="interactive-card glass-card rounded-2xl p-5">
                  <p className="text-sm text-text-muted">{t(`stats.${item}.label`)}</p>
                  <p className="mt-2 text-3xl font-semibold text-text-white">{t(`stats.${item}.value`)}</p>
                  <p className="mt-2 text-sm leading-6 text-text-faint">{t(`stats.${item}.description`)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="interactive-card glass-card rounded-3xl p-6 lg:p-8 motion-safe:animate-scale-in">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium text-brand-gold">{t('previewPanel.label')}</p>
                <h2 className="mt-1 text-2xl font-semibold text-text-white">{t('previewPanel.title')}</h2>
              </div>
              <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green">
                {t('previewPanel.status')}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {['postgres', 'redis', 'storage'].map((service) => (
                <div key={service} className="rounded-2xl border border-border bg-bg-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-text-white">{t(`previewPanel.${service}.title`)}</h3>
                      <p className="mt-1 text-sm text-text-muted">{t(`previewPanel.${service}.description`)}</p>
                    </div>
                    <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue">
                      {t(`previewPanel.${service}.status`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-bg-panel p-4">
              <p className="text-sm text-text-muted">{t('previewPanel.footerLabel')}</p>
              <p className="mt-2 text-sm leading-7 text-text-white">{t('previewPanel.footerValue')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('pillars.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('pillars.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('pillars.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {pillars.map(({ key, icon: Icon }) => (
            <article key={key} className="interactive-card glass-card rounded-3xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-panel text-brand-gold">
                <Icon size={22} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`pillars.items.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t(`pillars.items.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('preview.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('preview.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('preview.subtitle')}</p>

            <div className="mt-8 rounded-3xl border border-border bg-bg-panel p-6">
              <p className="text-sm text-text-muted">{t('preview.callout.label')}</p>
              <p className="mt-3 text-2xl font-semibold text-text-white">{t('preview.callout.title')}</p>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t('preview.callout.description')}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {previews.map(({ key, icon: Icon }) => (
              <article key={key} className="interactive-card rounded-3xl border border-border bg-bg-panel p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-surface text-brand-blue">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`preview.cards.${key}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{t(`preview.cards.${key}.description`)}</p>
                <ul className="mt-5 space-y-3 text-sm text-text-faint">
                  {[1, 2, 3].map((index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-gold" />
                      <span>{t(`preview.cards.${key}.point${index}`)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('sovereignty.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('sovereignty.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('sovereignty.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {sovereignty.map(({ key, icon: Icon }) => (
            <article key={key} className="interactive-card glass-card rounded-3xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-panel text-brand-gold">
                <Icon size={22} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`sovereignty.items.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t(`sovereignty.items.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal pb-20 pt-16 lg:pb-28 lg:pt-20">
        <div className="rounded-4xl border border-border bg-gradient-to-br from-brand-blue-deep/40 via-bg-panel to-brand-gold-deep/40 p-8 lg:p-12">
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
