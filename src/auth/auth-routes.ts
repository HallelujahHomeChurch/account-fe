import { safeReturnTo as sharedSafeReturnTo } from '@hallelujahhomechurch/account-client'

const authRoutePaths = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/oauth/callback', '/oauth/link', '/oauth/onboarding'])

export function isAuthRoutePath(pathname: string) {
  return authRoutePaths.has(pathname)
}

export function safeReturnTo(value: string | null | undefined) {
  const safe = sharedSafeReturnTo(value ?? '')
  return safe === '/' && value !== '/' ? '/profile' : safe
}

export function loginPath(returnTo: string) {
  return `/login?return_to=${encodeURIComponent(safeReturnTo(returnTo))}`
}
