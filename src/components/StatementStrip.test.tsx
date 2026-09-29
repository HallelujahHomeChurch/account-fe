import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { StatementStrip } from './StatementStrip'

vi.mock('../i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'zh-Hant', messages: { site: { statement: { notice: '教會聲明', readFull: '閱讀全文' } } } }),
}))

afterEach(() => vi.unstubAllGlobals())

it('links an active profile statement to the public website', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { title: '正式聲明', resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/current', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-01T00:00:00Z' },
  } })))
  vi.stubGlobal('fetch', fetcher)

  render(<StatementStrip />)

  expect(await screen.findByRole('link', { name: /正式聲明.*閱讀全文/ })).toHaveAttribute('href', 'https://www.alive.org.tw/zh-Hant/statements/current')
  expect(fetcher).toHaveBeenCalledWith('/api/statements/active?locale=zh-Hant', expect.objectContaining({ cache: 'no-store' }))
})

it.each([
  ['unsafe destination', '//other.example/statement', '2026-10-01T00:00:00Z'],
  ['expired statement', '/zh-Hant/statements/current', '2026-09-29T02:00:00Z'],
])('hides an %s', async (_case, href, popupEndsAt) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { title: '正式聲明', href, popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt },
  } }))))

  render(<StatementStrip />)

  await act(async () => {})
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
