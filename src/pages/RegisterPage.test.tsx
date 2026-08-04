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
