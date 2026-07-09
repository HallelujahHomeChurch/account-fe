export const locales = ['zh-Hant', 'zh-Hans', 'en'] as const

export type Locale = (typeof locales)[number]

export const localeLabels: Record<Locale, string> = {
  'zh-Hant': '繁中',
  'zh-Hans': '简中',
  en: 'EN',
}

export const localeCookieName = 'hhc_locale'

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase()

    if (normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg') || normalized.startsWith('zh-hans')) {
      return 'zh-Hans'
    }

    if (normalized.startsWith('zh')) return 'zh-Hant'
    if (normalized.startsWith('en')) return 'en'
  }

  return 'en'
}

export function getStoredLocale(cookie: string): Locale | undefined {
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`))

  if (!match) return undefined

  const value = decodeURIComponent(match.slice(localeCookieName.length + 1))
  return isLocale(value) ? value : undefined
}

export function getLocaleCookie(locale: Locale, domain?: string) {
  const parts = [`${localeCookieName}=${encodeURIComponent(locale)}`, 'Max-Age=31536000', 'Path=/', 'SameSite=Lax']

  if (domain) parts.push(`Domain=${domain}`)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') parts.push('Secure')

  return parts.join('; ')
}

export function getInitialLocale(cookie: string, languages: readonly string[]) {
  return getStoredLocale(cookie) ?? detectLocale(languages)
}
