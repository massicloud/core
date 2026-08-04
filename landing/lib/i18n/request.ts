import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { defaultLocale, locales } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? defaultLocale

  if (!locales.includes(locale as (typeof locales)[number])) notFound()

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
