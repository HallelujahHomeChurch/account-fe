export const themes = ['light', 'dark'] as const

export type Theme = (typeof themes)[number]

export const themeCookieName = 'hhc_theme'

export function isTheme(value: string): value is Theme {
  return themes.includes(value as Theme)
}

export function getStoredTheme(cookie: string): Theme | undefined {
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${themeCookieName}=`))

  if (!match) return undefined

  const value = decodeURIComponent(match.slice(themeCookieName.length + 1))
  return isTheme(value) ? value : undefined
}

export function getInitialTheme(cookie: string, prefersDark: boolean): Theme {
  return getStoredTheme(cookie) ?? (prefersDark ? 'dark' : 'light')
}

export function getThemeCookie(theme: Theme, domain?: string) {
  const parts = [`${themeCookieName}=${theme}`, 'Max-Age=31536000', 'Path=/', 'SameSite=Lax']

  if (domain) parts.push(`Domain=${domain}`)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') parts.push('Secure')

  return parts.join('; ')
}

export function applyTheme(theme: Theme, root = document.documentElement) {
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
