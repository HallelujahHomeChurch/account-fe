/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { applyTheme, getInitialTheme, getThemeCookie, type Theme } from './theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => undefined,
})

function prefersDarkTheme() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    getInitialTheme(typeof document === 'undefined' ? '' : document.cookie, prefersDarkTheme()),
  )

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme)
    document.cookie = getThemeCookie(nextTheme, import.meta.env.VITE_THEME_COOKIE_DOMAIN)
    setThemeState(nextTheme)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
