import { describe, expect, it } from 'vitest'

import { consumePostLoginReturnTo, hasPostLoginReturnTo, isAuthRoutePath, savePostLoginReturnTo, safeReturnTo } from './auth-routes'

describe('safeReturnTo', () => {
  it('accepts local account routes and rejects external redirects', () => {
    expect(safeReturnTo('/line/bind')).toBe('/line/bind')
    expect(safeReturnTo('//evil.example/path')).toBe('/profile')
    expect(safeReturnTo('https://evil.example/path')).toBe('/profile')
    expect(safeReturnTo('/profile\\evil')).toBe('/profile')
  })

  it('treats LINE binding as a public auth-shell route', () => {
    expect(isAuthRoutePath('/line/bind')).toBe(true)
  })

  it('treats policy acceptance as a public auth-shell route', () => {
    expect(isAuthRoutePath('/policy/acceptance')).toBe(true)
  })

  it('stores only a safe internal post-login continuation and consumes it once', () => {
    const storage = new Map<string, string>()
    const browserStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
    } as Storage

    savePostLoginReturnTo('/data-requests', browserStorage)
    expect(hasPostLoginReturnTo(browserStorage)).toBe(true)
    expect(consumePostLoginReturnTo(browserStorage)).toBe('/data-requests')
    expect(consumePostLoginReturnTo(browserStorage)).toBe('/profile')

    savePostLoginReturnTo('https://evil.example/path', browserStorage)
    expect(consumePostLoginReturnTo(browserStorage)).toBe('/profile')
    expect(hasPostLoginReturnTo(browserStorage)).toBe(false)
  })
})
