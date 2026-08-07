import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ToastProvider } from '@hallelujahhomechurch/ui'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { NotificationsPage } from './NotificationsPage'

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
