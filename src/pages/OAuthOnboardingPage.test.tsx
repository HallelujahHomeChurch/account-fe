import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { OAuthOnboardingPage } from './OAuthOnboardingPage'
import { ApiError } from '../lib/api'

it('lets verified Google onboarding accept current policy without OTP', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', '/oauth/onboarding#token=pending-token')
  const complete = vi.fn(async () => ({ success: true, redirect_type: 'profile' as const }))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), completeOAuthOnboarding: complete,
    getAuthCapabilities: async () => ({ providers: ['google'], registrationEnabled: true, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } }),
    getOAuthOnboardingStatus: async () => ({ provider: 'google', masked_email: 'u***@example.com', email_verification_required: false, link_confirmation_required: false }),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><OAuthOnboardingPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  const checkbox = await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i })
  expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(complete).toHaveBeenCalledWith('pending-token', false, {
    accepted: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1', locale: 'en',
  })
})

it('reloads policy versions after onboarding reports a stale pair', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', '/oauth/onboarding#token=pending-token')
  let capabilityCall = 0
  const complete = vi.fn()
    .mockRejectedValueOnce(new ApiError(409, 'changed', 'ACC_POLICY_VERSION_CHANGED'))
    .mockResolvedValueOnce({ success: true, redirect_type: 'profile' as const })
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), completeOAuthOnboarding: complete,
    getOAuthOnboardingStatus: async () => ({ provider: 'google', masked_email: 'u***@example.com', email_verification_required: false, link_confirmation_required: false }),
    getAuthCapabilities: async () => {
      capabilityCall += 1
      return { providers: ['google'], registrationEnabled: true, policy: { enforced: true, terms_version: `terms-v${capabilityCall}`, privacy_notice_version: `privacy-v${capabilityCall}` } }
    },
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><OAuthOnboardingPage /></AuthProvider></LocaleProvider></MemoryRouter>)
  const checkbox = await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i })
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await vi.waitFor(() => expect(checkbox).not.toBeChecked())
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(complete).toHaveBeenLastCalledWith('pending-token', false, expect.objectContaining({ terms_version: 'terms-v2' }))
})

it.each([
  ['ja', 'アカウント設定を完了', 'コードを送信'],
  ['ko', '계정 설정 마치기', '코드 보내기'],
])('uses %s copy and cookie for first-time OAuth onboarding', async (locale, title, submit) => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  window.history.replaceState(null, '', '/oauth/onboarding#token=pending-token')
  const send = vi.fn(async () => {
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
    return {}
  })
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), sendOAuthOnboardingCode: send,
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><OAuthOnboardingPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox'), 'user@example.com')
  await userEvent.click(screen.getByRole('button', { name: submit }))
  expect(send).toHaveBeenCalledWith('pending-token', 'user@example.com')
})

it('does not expose a provider error during Japanese OAuth onboarding', async () => {
  document.cookie = 'hhc_locale=ja; Path=/'
  window.history.replaceState(null, '', '/oauth/onboarding#token=pending-token')
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
    sendOAuthOnboardingCode: async () => { throw new ApiError(502, 'smtp provider leaked detail') },
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><OAuthOnboardingPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  await userEvent.type(screen.getByRole('textbox'), 'user@example.com')
  await userEvent.click(screen.getByRole('button', { name: 'コードを送信' }))
  expect(await screen.findByText('外部アカウントでのログインを完了できませんでした。しばらくしてからもう一度お試しください。')).toBeInTheDocument()
  expect(screen.queryByText('smtp provider leaked detail')).not.toBeInTheDocument()
})

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
