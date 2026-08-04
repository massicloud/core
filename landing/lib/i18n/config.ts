export const locales = ['en', 'fr', 'ar'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fr'

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
}

export const localeDirections: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  fr: 'ltr',
  ar: 'rtl',
}
