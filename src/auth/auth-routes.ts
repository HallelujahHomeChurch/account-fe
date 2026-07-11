const authRoutePaths = new Set(['/login', '/forgot-password', '/reset-password', '/verify-email', '/oauth/callback'])

export function isAuthRoutePath(pathname: string) {
  return authRoutePaths.has(pathname)
}
