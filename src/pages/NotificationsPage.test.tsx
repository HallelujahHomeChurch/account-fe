import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ToastProvider } from '@hallelujahhomechurch/ui'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { NotificationsPage } from './NotificationsPage'

it.each([
  ['ja', '教会ニュースレター', '通知設定を更新しました。'],
  ['ko', '교회 소식지', '알림 설정을 업데이트했어요.'],
])('uses %s copy and cookie for notification preference updates', async (locale, label, updated) => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  const updateNewsletterPreference = vi.fn(async () => {
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
    return { status: 'subscribed' as const }
  })
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }), logout: async () => ({}),
    getNewsletterPreference: async () => ({ status: 'not_subscribed' }), updateNewsletterPreference,
  }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NotificationsPage /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)

  await userEvent.click(await screen.findByRole('switch', { name: label }))
  expect(updateNewsletterPreference).toHaveBeenCalledWith(true)
  expect(await screen.findByText(updated)).toBeInTheDocument()
})

it('loads and updates the newsletter preference', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const updateNewsletterPreference = vi.fn(async () => ({ status: 'subscribed' as const }))
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }),
    refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    logout: async () => ({}),
    getNewsletterPreference: async () => ({ status: 'not_subscribed' }),
    updateNewsletterPreference,
  }
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider dismissLabel="Dismiss">
          <AuthProvider api={api}><NotificationsPage /></AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  const toggle = await screen.findByRole('switch', { name: 'Email newsletter' })
  expect(toggle).not.toBeChecked()
  await userEvent.click(toggle)
  expect(updateNewsletterPreference).toHaveBeenCalledWith(true)
  expect(toggle).toBeChecked()
  expect(await screen.findByText('Notification preference updated.')).toBeInTheDocument()
})

it('shows a retry state instead of a switch when loading preferences fails', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn()
    .mockRejectedValueOnce(new Error('service unavailable'))
    .mockResolvedValueOnce({ status: 'not_subscribed' as const })
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }),
    refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    logout: async () => ({}),
    getNewsletterPreference,
    updateNewsletterPreference: async () => ({ status: 'subscribed' }),
  }
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider dismissLabel="Dismiss">
          <AuthProvider api={api}><NotificationsPage /></AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load notification settings.')
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByRole('switch', { name: 'Email newsletter' })).not.toBeChecked()
  expect(getNewsletterPreference).toHaveBeenCalledTimes(2)
})
