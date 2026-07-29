import {
  applyTheme,
  getInitialTheme,
  getStoredTheme,
  getThemeCookie as getSharedThemeCookie,
  isTheme,
  themeCookieName,
  themes,
  type Theme,
} from '@hallelujahhomechurch/preferences'

export { applyTheme, getInitialTheme, getStoredTheme, isTheme, themeCookieName, themes, type Theme }

export function getThemeCookie(theme: Theme, domain?: string) {
  return getSharedThemeCookie(theme, {
    hostname: domain ?? (typeof location === 'undefined' ? undefined : location.hostname),
    protocol: typeof location === 'undefined' ? undefined : location.protocol,
  })
}
