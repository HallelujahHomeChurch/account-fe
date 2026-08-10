import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { RegisterPage } from './RegisterPage'

it('submits a new account and shows the verification next step', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const register = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
  }
  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<p>Registration complete</p>} />
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('First name'), 'Test')
  await userEvent.type(screen.getByLabelText('Last name'), 'User')
  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'Password1!')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1!')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(register).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password1!', first_name: 'Test', last_name: 'User', newsletter_opt_in: false, turnstile_token: undefined })
  expect(await screen.findByText('Registration complete')).toBeInTheDocument()
  expect(screen.queryByText(/Unable to create/)).not.toBeInTheDocument()
})

it('shows enabled social account options before the email registration form', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    register: async () => ({}),
    getAuthCapabilities: async () => ({ providers: ['google', 'line'], registrationEnabled: true }),
    getSocialLoginUrl: (provider) => `/api/account/v1/oauth2/${provider}/login`,
  }

  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  const google = await screen.findByLabelText('Continue with Google')
  const socialPanel = google.closest('.social-login-panel')
  const form = document.querySelector('.form-stack')

  expect(google).toHaveAttribute('href', '/api/account/v1/oauth2/google/login')
  expect(screen.getByLabelText('Continue with LINE')).toBeInTheDocument()
  expect(screen.queryByLabelText('Continue with Microsoft')).not.toBeInTheDocument()
  expect(socialPanel?.compareDocumentPosition(form as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(screen.getByText('Or create an account with email')).toBeInTheDocument()
})

it('submits newsletter consent only when selected', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const register = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
  }
  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('First name'), 'Test')
  await userEvent.type(screen.getByLabelText('Last name'), 'User')
  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'Password1!')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'Password1!')
  await userEvent.click(screen.getByRole('checkbox', { name: /church news/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(register).toHaveBeenCalledWith(expect.objectContaining({ newsletter_opt_in: true }))
})

it('does not submit a weak password', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const register = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
  }
  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('First name'), 'Test')
  await userEvent.type(screen.getByLabelText('Last name'), 'User')
  await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'password')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(register).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters with uppercase, lowercase, and a number.')
})

it('shows a localized invalid email message', async () => {
  document.cookie = 'hhc_locale=zh-Hant; Path=/'
  const register = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
  }
  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  await userEvent.type(screen.getByLabelText('名字'), 'Test')
  await userEvent.type(screen.getByLabelText('姓氏'), 'User')
  await userEvent.type(screen.getByLabelText('Email'), 'rayselfs')
  await userEvent.type(screen.getByLabelText('密碼'), 'Password1!')
  await userEvent.type(screen.getByLabelText('確認密碼'), 'Password1!')
  await userEvent.click(screen.getByRole('button', { name: '建立帳戶' }))

  expect(register).not.toHaveBeenCalled()
  expect(await screen.findByText('請輸入有效的 Email。')).toBeInTheDocument()
})
