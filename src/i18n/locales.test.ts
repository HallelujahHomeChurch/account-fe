import { describe, expect, it } from 'vitest'

import { detectLocale, getLocaleCookie, getStoredLocale, locales } from './locales'
import { messages } from './messages'

function topology(value: object): unknown {
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    nested && typeof nested === 'object' ? topology(nested) : typeof nested,
  ]))
}

describe('account locales', () => {
  it('matches hhc-web supported locale values', () => {
    expect(locales).toEqual(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'])
  })

  it('keeps complete message topology across all locales', () => {
    const expected = topology(messages.en)
    for (const locale of locales) expect(topology(messages[locale])).toEqual(expected)
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

  it('detects Japanese and Korean browser locales', () => {
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja')
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko')
  })

  it('reads and writes Japanese and Korean product cookies', () => {
    expect(getStoredLocale('hhc_locale=ja')).toBe('ja')
    expect(getStoredLocale('hhc_locale=ko')).toBe('ko')
    expect(getLocaleCookie('ja', '.alive.org.tw')).toBe(
      'hhc_locale=ja; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw',
    )
  })
})
