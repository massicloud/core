'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition, useState, useEffect, useRef } from 'react'
import { Globe, Check } from 'lucide-react'
import { locales, localeNames, type Locale } from '@/lib/i18n/config'

export function LocaleSwitcher({ locale: currentLocale }: { locale: Locale }) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchLocale = (newLocale: Locale) => {
    setOpen(false)
    const segments = pathname.split('/')
    segments[1] = newLocale
    const newPath = segments.join('/') || `/${newLocale}`
    startTransition(() => {
      router.replace(newPath)
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm
                   text-text-muted hover:text-text-white
                   hover:bg-bg-surface rounded-md transition-all"
        aria-label="Change language"
      >
        <Globe size={14} />
        <span className="uppercase">{currentLocale}</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-44 rounded-lg
                        bg-bg-panel border border-border-light
                        shadow-2xl z-50 overflow-hidden">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className="w-full flex items-center justify-between
                         px-3 py-2.5 text-sm text-text-muted
                         hover:text-text-white hover:bg-bg-surface
                         transition-colors"
            >
              <span>{localeNames[loc]}</span>
              {loc === currentLocale && (
                <Check size={14} className="text-brand-gold" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
