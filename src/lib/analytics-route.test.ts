import { expect, it } from 'vitest'
import { accountAnalyticsRoute } from './analytics-route'
it('excludes every sensitive route and any URL carrying query or fragment data', () => {
  expect(accountAnalyticsRoute('/profile', '', '')).toBe('profile')
  expect(accountAnalyticsRoute('/login', '', '')).toBe('login')
  for (const path of [
    '/legal',
    '/resources',
    '/security',
    '/devices',
    '/data-requests',
    '/oauth/callback',
    '/organizations',
  ])
    expect(accountAnalyticsRoute(path, '', '')).toBeNull()
  expect(
    accountAnalyticsRoute('/login', '?return_to=/resources', ''),
  ).toBeNull()
  expect(accountAnalyticsRoute('/profile', '', '#token=private')).toBeNull()
})
