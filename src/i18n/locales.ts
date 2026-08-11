import {
  detectProductLocale,
  getInitialProductLocale,
  getProductLocaleCookie,
  getStoredProductLocale,
  isProductLocale,
  localeMetadata,
  localeCookieName,
  productLocales,
  type ProductLocale,
} from '@hallelujahhomechurch/preferences'

export {
  detectProductLocale as detectLocale,
  getInitialProductLocale as getInitialLocale,
  getStoredProductLocale as getStoredLocale,
  isProductLocale as isLocale,
  localeCookieName,
  localeMetadata,
  productLocales as locales,
  type ProductLocale as Locale,
}

export function getLocaleCookie(locale: ProductLocale, domain?: string) {
  return getProductLocaleCookie(locale, {
    hostname: domain ?? (typeof location === 'undefined' ? undefined : location.hostname),
    protocol: typeof location === 'undefined' ? undefined : location.protocol,
  })
}
