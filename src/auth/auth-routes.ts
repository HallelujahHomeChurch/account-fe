const authRoutePaths = new Set(['/login', '/forgot-password', '/reset-password', '/verify-email', '/oauth/callback', '/oauth/link'])

export function isAuthRoutePath(pathname: string) {
  return authRoutePaths.has(pathname)
}

export function safeReturnTo(value: string | null | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/profile'
}

export function loginPath(returnTo: string) {
  return `/login?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`
}
