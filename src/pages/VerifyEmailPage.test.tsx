import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { VerifyEmailPage } from './VerifyEmailPage'

describe('VerifyEmailPage', () => {
  it.each([
    ['ja', 'メールアドレスを確認', 'この確認リンクは無効か、有効期限が切れています。'],
    ['ko', '이메일 인증', '이 인증 링크가 유효하지 않거나 만료되었어요.'],
  ])('shows localized verification state and keeps the %s cookie', (locale, title, invalid) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    window.history.replaceState(null, '', '/verify-email')
    const verifyEmail = vi.fn()
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}), verifyEmail,
    }
    render(<MemoryRouter><LocaleProvider><AuthProvider api={api}><VerifyEmailPage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(invalid)
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
    expect(verifyEmail).not.toHaveBeenCalled()
  })

  it('verifies the email token once when the page opens', async () => {
    window.history.replaceState(null, '', '/verify-email#token=verify-token')
    const verifyEmail = vi.fn(async () => ({ message: 'Email verified successfully' }))
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      verifyEmail,
    }

    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <AuthProvider api={api}>
          <VerifyEmailPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(window.location.hash).toBe('')
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument()
    expect(screen.getByText('You can now return to sign in.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Confirm this email address for your HHC account.')).not.toBeInTheDocument()
    expect(document.querySelector('.form-notice')).not.toBeInTheDocument()
    expect(verifyEmail).toHaveBeenCalledTimes(1)
    expect(verifyEmail).toHaveBeenCalledWith('verify-token')
    expect(screen.queryByRole('button', { name: 'Verify email' })).not.toBeInTheDocument()
    expect(document.querySelector('.login-card')).toBeInTheDocument()
  })
})
