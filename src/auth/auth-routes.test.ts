import { describe, expect, it } from 'vitest'

import { safeReturnTo } from './auth-routes'

describe('safeReturnTo', () => {
  it('accepts local account routes and rejects external redirects', () => {
    expect(safeReturnTo('/line/bind?token=opaque')).toBe('/line/bind?token=opaque')
    expect(safeReturnTo('//evil.example/path')).toBe('/profile')
    expect(safeReturnTo('https://evil.example/path')).toBe('/profile')
    expect(safeReturnTo('/profile\\evil')).toBe('/profile')
  })
})
