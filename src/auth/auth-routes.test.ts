import { describe, expect, it } from 'vitest'

import { isAuthRoutePath, safeReturnTo } from './auth-routes'

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
})
