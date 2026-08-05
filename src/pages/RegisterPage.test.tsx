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

  expect(register).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password1!', first_name: 'Test', last_name: 'User', turnstile_token: undefined })
  expect(await screen.findByText('Registration complete')).toBeInTheDocument()
  expect(screen.queryByText(/Unable to create/)).not.toBeInTheDocument()
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
