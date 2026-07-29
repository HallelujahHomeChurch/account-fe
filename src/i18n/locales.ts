import {
  detectLocale,
  getInitialLocale,
  getLocaleCookie as getSharedLocaleCookie,
  getStoredLocale,
  isLocale,
  localeCookieName,
  locales,
  type Locale,
} from '@hallelujahhomechurch/preferences'

export { detectLocale, getInitialLocale, getStoredLocale, isLocale, localeCookieName, locales, type Locale }

export const localeLabels: Record<Locale, string> = {
  'zh-Hant': '繁中',
  'zh-Hans': '简中',
  en: 'EN',
}

export function getLocaleCookie(locale: Locale, domain?: string) {
  return getSharedLocaleCookie(locale, {
    hostname: domain ?? (typeof location === 'undefined' ? undefined : location.hostname),
    protocol: typeof location === 'undefined' ? undefined : location.protocol,
  })
}
