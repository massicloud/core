import { getTranslations, unstable_setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import { createPageMetadata } from '@/lib/seo'
import {
  Activity,
  BellRing,
  BookCheck,
  Brain,
  Cable,
  CalendarClock,
  Cylinder,
  Database,
  FileStack,
  FolderOpen,
  Globe,
  HardDrive,
  KeyRound,
  Layers3,
  Network,
  Package,
  Radio,
  ReceiptText,
  Scale,
  Send,
  ServerCog,
  Shield,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}) {
  return createPageMetadata(locale as Locale, 'platform')
}

export default async function PlatformPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  unstable_setRequestLocale(locale)
  const t = await getTranslations('platform')

  const liveServices = [
    { key: 'postgres', icon: Database },
    { key: 'redis', icon: HardDrive },
    { key: 'storage', icon: FileStack },
    { key: 'auth', icon: ShieldCheck },
    { key: 'compliance', icon: BookCheck },
  ] as const

  const soonServices = [
    { key: 'monitoring', icon: Activity },
    { key: 'audit', icon: Shield },
    { key: 'secrets', icon: KeyRound },
    { key: 'cronjobs', icon: CalendarClock },
    { key: 'costdashboard', icon: ReceiptText },
    { key: 'rabbitmq', icon: Send },
    { key: 'kafka', icon: Cable },
    { key: 'mongodb', icon: Cylinder },
    { key: 'llm', icon: Brain },
    { key: 'filesystem', icon: FolderOpen },
    { key: 'kubernetes', icon: Network },
    { key: 'containerregistry', icon: Package },
    { key: 'publicips', icon: Globe },
    { key: 'loadbalancers', icon: Scale },
    { key: 'edge', icon: ServerCog },
    { key: 'realtime', icon: Radio },
    { key: 'webhooks', icon: Waypoints },
  ] as const

  const architecture = [
    { key: 'controlPlane', icon: Layers3 },
    { key: 'tenantRuntime', icon: ServerCog },
    { key: 'storageFabric', icon: FileStack },
    { key: 'operations', icon: BellRing },
  ] as const

  return (
    <div className="mx-auto max-w-8xl px-6 lg:px-8">
      <section className="section-reveal py-20 lg:py-28">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-4 py-2 text-sm text-brand-gold">
            <span className="h-2 w-2 rounded-full bg-brand-gold" />
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('live.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('live.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('live.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {liveServices.map(({ key, icon: Icon }) => (
            <article key={key} className="interactive-card glass-card rounded-3xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-panel text-brand-gold">
                  <Icon size={22} />
                </div>
                <span className="rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-1 text-xs font-medium text-brand-green">
                  {t('status.live')}
                </span>
              </div>

              <h3 className="mt-5 text-2xl font-semibold text-text-white">{t(`live.cards.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t(`live.cards.${key}.description`)}</p>

              <ul className="mt-5 space-y-3 text-sm text-text-faint">
                {[1, 2, 3].map((index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-gold" />
                    <span>{t(`live.cards.${key}.point${index}`)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('soon.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('soon.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-text-muted">{t('soon.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {soonServices.map(({ key, icon: Icon }) => (
            <article key={key} className="interactive-card rounded-3xl border border-border bg-bg-panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-surface text-brand-blue">
                  <Icon size={20} />
                </div>
                <span className="rounded-full border border-border-light bg-bg-surface px-3 py-1 text-xs font-medium text-text-muted">
                  {t(`soon.cards.${key}.quarter`)}
                </span>
              </div>

              <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`soon.cards.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-text-muted">{t(`soon.cards.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-reveal py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">{t('architecture.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-text-white md:text-4xl">{t('architecture.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-text-muted">{t('architecture.subtitle')}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {architecture.map(({ key, icon: Icon }) => (
              <article key={key} className="interactive-card glass-card rounded-3xl p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-panel text-brand-gold">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-text-white">{t(`architecture.cards.${key}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{t(`architecture.cards.${key}.description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-reveal pb-20 pt-16 lg:pb-28 lg:pt-20">
        <div className="rounded-4xl border border-border bg-gradient-to-br from-bg-panel via-bg-panel to-brand-blue-deep/30 p-8 lg:p-12">
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
