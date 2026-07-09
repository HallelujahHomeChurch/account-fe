/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { getInitialLocale, getLocaleCookie, type Locale } from './locales'
import { messages, type Messages } from './messages'

type LocaleContextValue = {
  locale: Locale
  messages: Messages
  setLocale: (locale: Locale) => void
}

const fallbackLocale: Locale = 'en'

const LocaleContext = createContext<LocaleContextValue>({
  locale: fallbackLocale,
  messages: messages[fallbackLocale],
  setLocale: () => undefined,
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    getInitialLocale(
      typeof document === 'undefined' ? '' : document.cookie,
      typeof navigator === 'undefined'
        ? [fallbackLocale]
        : navigator.languages.length > 0
          ? navigator.languages
          : [navigator.language],
    ),
  )

  const setLocale = useCallback((nextLocale: Locale) => {
    document.cookie = getLocaleCookie(nextLocale, import.meta.env.VITE_LOCALE_COOKIE_DOMAIN)
    document.documentElement.lang = nextLocale
    setLocaleState(nextLocale)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      messages: messages[locale],
      setLocale,
    }),
    [locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
