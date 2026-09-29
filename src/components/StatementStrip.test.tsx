import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { StatementStrip } from './StatementStrip'

vi.mock('../i18n/locale-context', () => ({
  useLocale: () => ({ locale: 'zh-Hant', messages: { site: { statement: { notice: '教會聲明', readFull: '閱讀全文', close: '關閉', hideToday: '今天不再顯示', openImage: '放大圖片', closeImage: '關閉圖片' } } } }),
}))

beforeEach(() => {
  document.cookie = 'hhc_statement_hidden_day=; Max-Age=0; Path=/'
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => vi.unstubAllGlobals())

it('links an active profile statement to the public website', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { id: 'current', title: '正式聲明', body: '聲明內文', bodyJson: { schemaVersion: 1, blocks: [{ id: 'p', type: 'paragraph', content: [{ type: 'text', text: '聲明內文', marks: ['strong'] }] }, { id: 'photo', type: 'image', url: '/assets/statement/photo', alt: { mode: 'text', text: '聲明圖片' } }] }, resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/current', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-01T00:00:00Z' },
  } })))
  vi.stubGlobal('fetch', fetcher)

  render(<StatementStrip />)

  expect(await screen.findByRole('link', { name: /正式聲明.*閱讀全文/ })).toHaveAttribute('href', 'https://www.alive.org.tw/zh-Hant/statements/current')
  const dialog = await screen.findByRole('dialog', { name: '正式聲明' })
  expect(within(dialog).getByText('聲明內文').tagName).toBe('STRONG')
  fireEvent.click(within(dialog).getByRole('button', { name: '放大圖片: 聲明圖片' }))
  expect(screen.getByRole('dialog', { name: '放大圖片' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '關閉圖片' }))
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '今天不再顯示' }))
  fireEvent.click(within(dialog).getAllByRole('button', { name: '關閉' })[0])
  expect(document.cookie).toContain('hhc_statement_hidden_day=current.2026-09-29')
  expect(fetcher).toHaveBeenCalledWith('/api/statements/active?locale=zh-Hant', expect.objectContaining({ cache: 'no-store' }))
})

it('honors the shared dismissal from the public website', async () => {
  document.cookie = 'hhc_statement_hidden_day=current.2026-09-29; Path=/'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow: '2026-09-29T02:00:00Z', nextChangeAt: null,
    statement: { id: 'current', title: '正式聲明', body: '聲明內文', resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/current', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-01T00:00:00Z' },
  } }))))
  render(<StatementStrip />)
  await screen.findByRole('link')
  await act(async () => {})
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows again after the Taipei day changes', async () => {
  let serverNow = '2026-09-29T02:00:00Z'
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
    serverNow, nextChangeAt: null,
    statement: { id: 'next-day', title: '正式聲明', body: '聲明內文', resolvedLocale: 'zh-Hant', href: '/zh-Hant/statements/next-day', popupStartsAt: '2026-09-28T00:00:00Z', popupEndsAt: '2026-10-02T00:00:00Z' },
  } }))))
  render(<StatementStrip />)
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: '今天不再顯示' }))
  fireEvent.click(within(dialog).getAllByRole('button', { name: '關閉' })[0])
  serverNow = '2026-09-29T16:00:00Z'
  fireEvent.focus(window)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
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
