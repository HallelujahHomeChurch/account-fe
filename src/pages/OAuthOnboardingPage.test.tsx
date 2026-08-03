import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { OAuthOnboardingPage } from './OAuthOnboardingPage'

it('verifies email before confirming an existing account link', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', '/oauth/onboarding#token=pending-token')
  const send = vi.fn(async () => ({}))
  const verify = vi.fn(async () => ({ provider: 'line', masked_email: 'u***@example.com', existing_account: true, requires_link_confirmation: true }))
  const complete = vi.fn(async () => ({ success: true, redirect_type: 'profile' as const }))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => 'access-token', logout: async () => ({}),
    getSession: async () => ({ authenticated: true, user: { id: 'u1', email: 'user@example.com', display_name: 'Test', avatar_url: '' } }),
    issueAccessToken: async () => 'access-token', sendOAuthOnboardingCode: send,
    verifyOAuthOnboardingCode: verify, completeOAuthOnboarding: complete,
  }
  render(
    <MemoryRouter initialEntries={['/oauth/onboarding']}>
      <LocaleProvider><AuthProvider api={api} restoreSession={false}><Routes>
        <Route path="/oauth/onboarding" element={<OAuthOnboardingPage />} />
        <Route path="/profile" element={<h1>Profile</h1>} />
      </Routes></AuthProvider></LocaleProvider>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'Send code' }))
  await userEvent.type(screen.getByLabelText('Verification code'), '123456')
  await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
  expect(await screen.findByText('u***@example.com')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Link account' }))

  expect(complete).toHaveBeenCalledWith('pending-token', true)
  expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
})
