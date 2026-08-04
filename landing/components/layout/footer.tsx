import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, Cloud } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { APP_URL, DOCS_URL } from '@/lib/env'

export function Footer({ locale }: { locale: Locale }) {
  const t = useTranslations('footer')

  const sections = [
    {
      title: t('product'),
      links: [
        { href: '/', label: t('overview') },
        { href: '/platform', label: t('platform') },
        { href: '/pricing', label: t('pricing') },
        { href: '/compliance', label: t('compliance') },
        { href: '/roadmap', label: t('roadmap') },
      ],
    },
    {
      title: t('resources'),
      links: [
        { href: locale === 'en' ? `${DOCS_URL}/get-started/welcome` : `${DOCS_URL}/${locale}/get-started/welcome`, label: t('docs'), external: true },
        { href: `${APP_URL}/login`, label: t('login'), external: true },
        { href: `${APP_URL}/signup`, label: t('signup'), external: true },
      ],
    },
    {
      title: t('company'),
      links: [
        { href: '/compliance', label: t('lawReadiness') },
        { href: '/roadmap', label: t('projectState') },
      ],
    },
  ]

  return (
    <footer className="border-t border-border bg-bg-deep">
      <div className="mx-auto max-w-8xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-gold to-brand-blue">
                <Cloud size={16} className="text-bg-deep" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-text-white">MassiCloud</span>
            </div>

            <p className="max-w-sm text-sm leading-relaxed text-text-muted">{t('tagline')}</p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold" />
              <span className="text-xs font-medium text-brand-gold">{t('hostedInAlgeria')}</span>
            </div>

            <dl className="mt-6 space-y-3 text-sm text-text-muted">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-panel px-4 py-3">
                <dt>{t('founderLabel')}</dt>
                <dd className="font-medium text-text-white">{t('founderName')}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-panel px-4 py-3">
                <dt>{t('jurisdictionLabel')}</dt>
                <dd className="font-medium text-text-white">{t('jurisdictionValue')}</dd>
              </div>
            </dl>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-white">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={
                        'external' in link && link.external
                          ? link.href
                          : link.href === '/'
                            ? `/${locale}`
                            : `/${locale}${link.href}`
                      }
                      className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-white"
                    >
                      {link.label}
                      {'external' in link && link.external ? <ArrowUpRight size={14} /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-text-faint">© 2026 MassiCloud. {t('allRightsReserved')}</p>
          <p className="text-xs text-text-faint">
            {t('madeIn')} <span className="text-brand-gold">Algeria 🇩🇿</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

