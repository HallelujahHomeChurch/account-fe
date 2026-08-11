import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it.each([
    ['ja', 'アカウント | ハレルヤ家の教会'],
    ['ko', '계정 | 할렐루야 가정교회'],
  ] as const)('uses OAuth callback locale %s as the product locale', async (locale, title) => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US'] })
    window.history.replaceState(null, '', `/login?locale=${locale}&oauth_error=cancelled`)

    render(<LocaleProvider><CurrentLocale /></LocaleProvider>)

    expect(document.body).toHaveTextContent(locale)
    await waitFor(() => expect(document.cookie).toContain(`hhc_locale=${locale}`))
    expect(document.documentElement).toHaveAttribute('lang', locale)
    expect(document.title).toBe(title)
  })

  it('updates cookie, document language, title, and state together', async () => {
    document.cookie = 'hhc_locale=ja; Path=/'
    render(<LocaleProvider><LocaleControls /></LocaleProvider>)

    await userEvent.click(screen.getByRole('button', { name: 'ko' }))

    expect(screen.getByTestId('current-locale')).toHaveTextContent('ko')
    expect(document.cookie).toContain('hhc_locale=ko')
    expect(document.documentElement).toHaveAttribute('lang', 'ko')
    expect(document.title).toBe('계정 | 할렐루야 가정교회')
  })
})

function CurrentLocale() {
  return <span>{useLocale().locale}</span>
}

function LocaleControls() {
  const { locale, setLocale } = useLocale()
  return <><span data-testid="current-locale">{locale}</span><button onClick={() => setLocale('ko')}>ko</button></>
}
