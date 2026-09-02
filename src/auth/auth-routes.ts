import { safeReturnTo as sharedSafeReturnTo } from '@hallelujahhomechurch/account-client'

const authRoutePaths = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/native-auth-complete', '/oauth/callback', '/oauth/link', '/oauth/onboarding', '/policy/acceptance', '/line/bind'])
const postLoginReturnToKey = 'hhc_account_post_login_return_to'

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

export function savePostLoginReturnTo(returnTo: string, storage: Pick<Storage, 'setItem' | 'removeItem'> = sessionStorage) {
  const safe = safeReturnTo(returnTo)
  if (safe === '/profile') storage.removeItem(postLoginReturnToKey)
  else storage.setItem(postLoginReturnToKey, safe)
}

export function hasPostLoginReturnTo(storage: Pick<Storage, 'getItem'> = sessionStorage) {
  return storage.getItem(postLoginReturnToKey) !== null
}

export function clearPostLoginReturnTo(storage: Pick<Storage, 'removeItem'> = sessionStorage) {
  storage.removeItem(postLoginReturnToKey)
}

export function consumePostLoginReturnTo(storage: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage) {
  const returnTo = storage.getItem(postLoginReturnToKey)
  storage.removeItem(postLoginReturnToKey)
  return safeReturnTo(returnTo)
}
