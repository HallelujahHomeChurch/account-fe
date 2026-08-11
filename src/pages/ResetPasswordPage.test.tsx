import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ResetPasswordPage } from './ResetPasswordPage'

describe('ResetPasswordPage', () => {
  it.each([
    ['ja', 'パスワードを再設定', 'この再設定リンクは無効か、有効期限が切れています。'],
    ['ko', '비밀번호 재설정', '이 재설정 링크가 유효하지 않거나 만료되었어요.'],
  ])('shows localized safe invalid-link state in %s', (locale, title, invalid) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    window.history.replaceState(null, '', '/reset-password')
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter><LocaleProvider><AuthProvider api={api}><ResetPasswordPage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(invalid)
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
  })

  it('prefills email and token from the reset link', async () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password#email=user%40example.com&token=reset-token',
    )
    let request: { email: string; token: string; new_password: string } | null = null
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      resetPassword: async (body) => {
        request = body
        return { message: 'Password reset.' }
      },
    }

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <AuthProvider api={api}>
          <ResetPasswordPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com')
    expect(screen.queryByLabelText('Reset token')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')

    await userEvent.type(screen.getByLabelText('New password'), 'Secret123!')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(request).toEqual({
      email: 'user@example.com',
      token: 'reset-token',
      new_password: 'Secret123!',
    })
    expect(await screen.findByRole('heading', { name: 'Password reset' })).toBeInTheDocument()
    expect(screen.getByText('You can now sign in with your new password.')).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(document.querySelector('.form-notice')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  it('does not submit when the passwords do not match', async () => {
    window.history.replaceState(null, '', '/reset-password#email=user%40example.com&token=reset-token')
    let calls = 0
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
      resetPassword: async () => { calls += 1; return {} },
    }
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <AuthProvider api={api}><ResetPasswordPage /></AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('New password'), 'Secret123!')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different123!')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(calls).toBe(0)
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
  })

  it('shows recovery actions instead of the form for an invalid reset link', () => {
    window.history.replaceState(null, '', '/reset-password')
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <AuthProvider api={api}><ResetPasswordPage /></AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request another link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
  })
})
