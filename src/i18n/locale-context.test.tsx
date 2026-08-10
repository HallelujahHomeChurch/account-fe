import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider, useLocale } from './locale-context'

describe('LocaleProvider', () => {
  beforeEach(() => {
    document.cookie = 'hhc_locale=; Max-Age=0; Path=/'
  })

  it('persists the browser-detected locale on first load', async () => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['zh-TW'] })

    render(
      <LocaleProvider>
        <CurrentLocale />
      </LocaleProvider>,
    )

    expect(document.body).toHaveTextContent('zh-Hant')
    await waitFor(() => expect(document.cookie).toContain('hhc_locale=zh-Hant'))
    expect(document.title).toBe('帳戶 | 哈利路亞家教會')
  })

  it('prefers a valid OAuth callback locale', async () => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US'] })
    window.history.replaceState(null, '', '/login?locale=zh-Hant&oauth_error=cancelled')

    render(
      <LocaleProvider>
        <CurrentLocale />
      </LocaleProvider>,
    )

    expect(document.body).toHaveTextContent('zh-Hant')
    await waitFor(() => expect(document.cookie).toContain('hhc_locale=zh-Hant'))
  })
})

function CurrentLocale() {
  return <span>{useLocale().locale}</span>
}
