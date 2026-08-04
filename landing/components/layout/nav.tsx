'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Cloud, Menu, X } from 'lucide-react'
import { LocaleSwitcher } from './locale-switcher'
import type { Locale } from '@/lib/i18n/config'
import { APP_URL } from '@/lib/env'

export function Nav({ locale }: { locale: Locale }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const links = useMemo(
    () => [
      { href: '/platform', label: t('platform') },
      { href: '/pricing', label: t('pricing') },
      { href: '/compliance', label: t('compliance') },
      { href: '/roadmap', label: t('roadmap') },
    ],
    [t]
  )

  const isActive = (href: string) => pathname === `/${locale}${href}`

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-deep/80 backdrop-blur-md">
      <div className="mx-auto max-w-8xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-gold to-brand-blue flex items-center justify-center">
              <Cloud size={16} className="text-bg-deep" strokeWidth={2.5} />
            </div>
            <span className="text-text-white font-bold text-lg group-hover:text-brand-gold transition-colors">
              MassiCloud
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className={`rounded-md px-3 py-2 text-sm transition-all ${
                  isActive(link.href)
                    ? 'bg-bg-surface text-text-white'
                    : 'text-text-muted hover:bg-bg-surface hover:text-text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-text-muted transition-colors hover:border-border-light hover:text-text-white md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <LocaleSwitcher locale={locale} />

            <Link
              href={`${APP_URL}/login`}
              className="hidden sm:block text-sm text-text-muted hover:text-text-white px-3 py-2 transition-colors"
            >
              {t('login')}
            </Link>

            <Link
              href={`${APP_URL}/signup`}
              className="bg-brand-gold hover:bg-brand-gold/90
                         text-bg-deep font-medium text-sm
                         px-4 py-2 rounded-md transition-all
                         shadow-lg shadow-brand-gold/20"
            >
              {t('signup')}
            </Link>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <div className="flex flex-col gap-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className={`rounded-lg px-4 py-3 text-sm transition-all ${
                    isActive(link.href)
                      ? 'bg-bg-surface text-text-white'
                      : 'text-text-muted hover:bg-bg-surface hover:text-text-white'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-bg-panel p-4">
              <p className="text-sm font-medium text-text-white">{t('mobileTitle')}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{t('mobileDescription')}</p>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href={`${APP_URL}/login`}
                  className="rounded-lg border border-border px-4 py-3 text-center text-sm text-text-white transition-colors hover:border-border-light hover:bg-bg-surface"
                >
                  {t('login')}
                </Link>
                <Link
                  href={`${APP_URL}/signup`}
                  className="rounded-lg bg-brand-gold px-4 py-3 text-center text-sm font-medium text-bg-deep transition-opacity hover:opacity-90"
                >
                  {t('signup')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
