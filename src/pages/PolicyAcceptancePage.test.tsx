import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { PolicyAcceptancePage } from './PolicyAcceptancePage'
import { hasPostLoginReturnTo, savePostLoginReturnTo } from '../auth/auth-routes'

it('keeps the resume token in memory and rotates stale versions', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', '/policy/acceptance#token=old-token')
  const confirm = vi.fn()
    .mockRejectedValueOnce(new ApiError(409, 'changed', 'ACC_POLICY_VERSION_CHANGED', {
      policy_token: 'new-token', terms_version: 'terms-v2', privacy_notice_version: 'privacy-v2',
    }))
    .mockResolvedValueOnce({ access_token: 'access-token', redirect_type: 'profile' })
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), confirmPolicyAcceptance: confirm,
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: false, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } }),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><PolicyAcceptancePage /></AuthProvider></LocaleProvider></MemoryRouter>)

  expect(window.location.hash).toBe('')
  const checkbox = await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i })
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(checkbox).not.toBeChecked()
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(confirm).toHaveBeenNthCalledWith(1, 'old-token', expect.objectContaining({ terms_version: 'terms-v1' }))
  expect(confirm).toHaveBeenNthCalledWith(2, 'new-token', expect.objectContaining({ terms_version: 'terms-v2' }))
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

it('offers restart when the fragment token is missing', async () => {
  sessionStorage.clear()
  savePostLoginReturnTo('/data-requests')
  window.history.replaceState(null, '', '/policy/acceptance')
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><PolicyAcceptancePage /></AuthProvider></LocaleProvider></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Start sign-in again' })).toHaveAttribute('href', '/login')
  expect(hasPostLoginReturnTo()).toBe(false)
})

it('consumes a social callback continuation after policy acceptance', async () => {
  sessionStorage.clear()
  savePostLoginReturnTo('/data-requests')
  window.history.replaceState(null, '', '/policy/acceptance#token=policy-token')
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
    confirmPolicyAcceptance: async () => ({ access_token: 'access-token', redirect_type: 'profile' }),
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: false, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } }),
  }
  render(<MemoryRouter initialEntries={['/policy/acceptance']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><Routes>
    <Route path="/policy/acceptance" element={<PolicyAcceptancePage />} />
    <Route path="/data-requests" element={<h1>Data requests restored</h1>} />
  </Routes></AuthProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByRole('heading', { name: 'Data requests restored' })).toBeInTheDocument()
  expect(sessionStorage.getItem('hhc_account_post_login_return_to')).toBeNull()
})
