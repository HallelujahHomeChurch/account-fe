import type { SafeAnalyticsRoute } from '@hallelujahhomechurch/preferences'

export function accountAnalyticsRoute(
  pathname: string,
  search: string,
  hash: string,
): SafeAnalyticsRoute | null {
  if (search || hash) return null
  if (pathname === '/login') return 'login'
  if (pathname === '/profile') return 'profile'
  return null
}
