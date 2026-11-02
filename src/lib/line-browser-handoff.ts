export const isLineBrowser = (userAgent: string) => /\bLINE\/\d/i.test(userAgent)

export function externalBrowserHref(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.searchParams.set('openExternalBrowser', '1')
  return url.href
}

const excludedPaths = new Set([
  '/oauth/callback', '/native-auth-complete', '/oauth/link', '/oauth/onboarding',
  '/policy/acceptance', '/line/bind', '/data-requests/verify-email',
])

export function shouldOfferLineHandoff(url = new URL(window.location.href), userAgent = navigator.userAgent): boolean {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const tokenRoute = path === '/verify-email' || path === '/reset-password'
  const hasToken = url.searchParams.has('token') || new URLSearchParams(url.hash.slice(1)).has('token')
  return isLineBrowser(userAgent) && !excludedPaths.has(path) && !(tokenRoute && hasToken)
}
