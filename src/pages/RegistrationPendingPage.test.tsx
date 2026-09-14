import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { RegistrationPendingPage } from './RegistrationPendingPage'

it('resends verification without placing the email in the URL', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const resendVerificationEmail = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), resendVerificationEmail,
  }
  render(
    <MemoryRouter initialEntries={[{ pathname: '/register/check-email', search: '?auth_request_id=req-1', state: { registrationEmail: 'user@example.com' } }]}>
      <LocaleProvider><AuthProvider api={api} restoreSession={false}><RegistrationPendingPage /></AuthProvider></LocaleProvider>
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Use another email' })).toHaveAttribute('href', '/register?auth_request_id=req-1')
  expect(window.location.href).not.toContain('user@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
  expect(resendVerificationEmail).toHaveBeenCalledWith('user@example.com', undefined)
  expect(await screen.findByRole('status')).toHaveTextContent('Verification email sent')
})
