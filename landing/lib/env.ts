// "||" (not "??") is deliberate — see portal/lib/api.ts for why: a missing
// --build-arg at image-build time leaves this as "" (not undefined), and
// "??" doesn't fall back on that. Don't revert to "??".
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.massicloud.work'

export const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.massicloud.work'
