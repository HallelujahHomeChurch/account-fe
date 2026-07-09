import { describe, expect, it } from 'vitest'

import { detectLocale, getLocaleCookie, getStoredLocale, locales } from './locales'

describe('account locales', () => {
  it('matches hhc-web supported locale values', () => {
    expect(locales).toEqual(['zh-Hant', 'zh-Hans', 'en'])
  })

  it('reads the shared hhc_locale cookie', () => {
    expect(getStoredLocale('theme=dark; hhc_locale=zh-Hant')).toBe('zh-Hant')
    expect(getStoredLocale('hhc_locale=fr')).toBeUndefined()
  })

  it('writes a shareable locale cookie', () => {
    expect(getLocaleCookie('en', '.alive.org.tw')).toBe(
      'hhc_locale=en; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw',
    )
  })

  it('detects Chinese variants before falling back to English', () => {
    expect(detectLocale(['zh-TW', 'en-US'])).toBe('zh-Hant')
    expect(detectLocale(['zh-CN', 'en-US'])).toBe('zh-Hans')
    expect(detectLocale(['fr-FR'])).toBe('en')
  })
})
