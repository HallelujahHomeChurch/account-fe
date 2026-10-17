import type {Locale} from '../i18n/locales'

const id = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const legacyPath = new RegExp(`^/organizations(?:/${id}(?:/members/${id})?)?/?$`)
export function organizationRedirectUrl(pathname: string, locale: Locale, publicSiteUrl: string, accountHostname = ''): string | null {
  if (!legacyPath.test(pathname)) return null
  try {
    const url = new URL(publicSiteUrl)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    const publicHost = ['www.alive.org.tw', 'www-test.alive.org.tw'].includes(url.hostname) && url.protocol === 'https:' && !url.port
    const localHost = ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)
    if (!publicHost && !localHost) return null
    if (accountHostname === 'account-test.alive.org.tw' && url.hostname === 'www.alive.org.tw') url.hostname = 'www-test.alive.org.tw'
    url.pathname = `/${locale}${pathname.replace(/\/$/, '')}`
    return url.href
  } catch { return null }
}
export function replaceOrganizationLocation(url: string) { window.location.replace(url) }
