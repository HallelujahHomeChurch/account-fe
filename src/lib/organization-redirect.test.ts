import {expect, it} from 'vitest'
import {organizationRedirectUrl} from './organization-redirect'
const unit = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
it.each(['zh-Hant','zh-Hans','en','ja','ko'] as const)('redirects recognized legacy management routes with locale %s', locale => {
  for (const path of ['/organizations', `/organizations/${unit}`, `/organizations/${unit}/members/${member}`]) {
    expect(organizationRedirectUrl(path, locale, 'https://www.alive.org.tw')).toBe(`https://www.alive.org.tw/${locale}${path}`)
  }
})
it.each(['/profile','/organizations/../../profile','/organizations/unknown','/organizations//evil.test','/organizations/%2f%2fevil.test','/organizations?token=secret','/organizations/'+unit+'/archive'])('rejects unrecognized path %s', path => {
  expect(organizationRedirectUrl(path, 'en', 'https://www.alive.org.tw')).toBeNull()
})
it.each(['https://evil.test','https://www.alive.org.tw@evil.test','javascript:alert(1)','https://www.alive.org.tw/path'])('rejects unsafe destination origin %s', origin => {
  expect(organizationRedirectUrl('/organizations','en',origin)).toBeNull()
})
it('keeps test-host links on WWW test', () => {
  expect(organizationRedirectUrl('/organizations', 'zh-Hant', 'https://www.alive.org.tw', 'account-test.alive.org.tw')).toBe('https://www-test.alive.org.tw/zh-Hant/organizations')
})
