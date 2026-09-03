import { createOAuthTransaction } from '@hallelujahhomechurch/account-client'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { saveAccountOAuthTransaction } from '../lib/redirects'
import { LocaleProvider } from '../i18n/locale-context'
import { OAuthCallbackPage } from './OAuthCallbackPage'
import { hasPostLoginReturnTo, savePostLoginReturnTo } from '../auth/auth-routes'

describe('OAuthCallbackPage', () => {
  it.each([
    ['ja', 'ログインを完了できませんでした。もう一度お試しください。'],
    ['ko', '로그인을 완료할 수 없어요. 다시 시도해 주세요.'],
  ])('shows a safe localized callback failure in %s', async (locale, failure) => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    document.cookie = `hhc_locale=${locale}; Path=/`
    const exchangeCode = vi.fn()
    const api: AuthApi = {
      exchangeCode, login: async () => ({}), me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/oauth/callback']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><OAuthCallbackPage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent(failure)
    expect(exchangeCode).not.toHaveBeenCalled()
    expect(hasPostLoginReturnTo()).toBe(false)
  })

  it('validates state, exchanges the code, clears state, and restores the route', async () => {
    sessionStorage.clear()
    const transaction = await createOAuthTransaction('/security?tab=mfa', {
      randomBytes: () => new Uint8Array(32).fill(8),
    })
    saveAccountOAuthTransaction(transaction)
    const exchangeCode = vi.fn(async () => ({ access_token: 'account-access' }))
    const api: AuthApi = {
      exchangeCode,
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={[`/oauth/callback?code=code-1&state=${transaction.state}`]}>
        <AuthProvider api={api} restoreSession={false}>
          <Routes>
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            <Route path="/security" element={<p>Security restored</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Security restored')).toBeInTheDocument()
    expect(exchangeCode).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('hhc_account_oauth_transaction')).toBeNull()
  })

  it('rejects invalid state before exchanging the code', async () => {
    sessionStorage.clear()
    const transaction = await createOAuthTransaction('/profile', {
      randomBytes: () => new Uint8Array(32).fill(9),
    })
    saveAccountOAuthTransaction(transaction)
    const exchangeCode = vi.fn(async () => ({ access_token: 'account-access' }))
    const api: AuthApi = {
      exchangeCode,
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/oauth/callback?code=code-1&state=wrong']}>
        <AuthProvider api={api} restoreSession={false}>
          <OAuthCallbackPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(document.querySelector('.login-card')).toBeInTheDocument()
    await waitFor(() => expect(exchangeCode).not.toHaveBeenCalled())
  })
})
