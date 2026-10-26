import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'

function renderEntry(page: 'login' | 'register') {
  document.cookie = 'hhc_locale=en; Path=/'
  const register = vi.fn(async (_body: unknown) => ({}))
  const login = vi.fn(async () => ({}))
  const api: AuthApi = {
    login, register, me: async () => ({ id: 'test', email: 'test@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: true, nicknameWriteEnabled: true,
      policy: { enforced: false, terms_version: '', privacy_notice_version: '' } }),
  }
  render(<MemoryRouter initialEntries={[`/${page}`]}><LocaleProvider><AuthProvider api={api} restoreSession={false}>
    {page === 'login' ? <LoginPage /> : <RegisterPage />}
  </AuthProvider></LocaleProvider></MemoryRouter>)
  return { register, login }
}

async function fillRegistration(confirm = 'Different1') {
  await userEvent.type(await screen.findByLabelText('Nickname'), 'Test')
  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'Password1')
  await userEvent.type(screen.getByLabelText('Confirm password'), confirm)
}

it('shows field-associated mismatch on blur and revalidates either edited password', async () => {
  const { register } = renderEntry('register')
  await fillRegistration()
  const confirmation = screen.getByLabelText('Confirm password')
  expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  await userEvent.tab()
  expect(confirmation).toHaveAttribute('aria-invalid', 'true')
  expect(confirmation).toHaveAccessibleDescription('Passwords do not match.')
  expect(register).not.toHaveBeenCalled()
  await userEvent.clear(confirmation)
  await userEvent.type(confirmation, 'Password1')
  expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Password'), 'x')
  expect(confirmation).toHaveAccessibleDescription('Passwords do not match.')
  await userEvent.type(confirmation, 'x')
  expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(register).toHaveBeenCalledWith(expect.objectContaining({ password: 'Password1x' }))
  expect(register.mock.calls[0][0]).not.toHaveProperty('confirm_password')
})

it('guards mismatch on direct submit without relying on blur', async () => {
  const { register } = renderEntry('register')
  await fillRegistration()
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!)
  expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
  expect(register).not.toHaveBeenCalled()
})

it('keeps login value and submission separate from its visibility button', async () => {
  const { login } = renderEntry('login')
  const password = screen.getByLabelText('Password')
  await userEvent.type(password, 'Password1')
  expect(password).toHaveAttribute('type', 'password')
  await userEvent.click(screen.getByRole('button', { name: 'Show password: Password' }))
  expect(password).toHaveAttribute('type', 'text')
  expect(password).toHaveValue('Password1')
  expect(password).toHaveAttribute('autocomplete', 'current-password')
  expect(login).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Hide password: Password' }))
  expect(password).toHaveAttribute('type', 'password')
})

it('toggles registration fields independently and retains required validation', async () => {
  const { register } = renderEntry('register')
  await screen.findByLabelText('Nickname')
  const password = screen.getByLabelText('Password')
  const confirmation = screen.getByLabelText('Confirm password')
  await userEvent.click(screen.getByRole('button', { name: 'Show password: Confirm password' }))
  expect(confirmation).toHaveAttribute('type', 'text')
  expect(password).toHaveAttribute('type', 'password')
  await userEvent.click(screen.getByRole('button', { name: 'Show password: Password' }))
  expect(password).toHaveAttribute('type', 'text')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(register).not.toHaveBeenCalled()
  expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
})

it('keeps strength feedback ahead of mismatch and prevents invalid registration', async () => {
  const { register } = renderEntry('register')
  await fillRegistration()
  await userEvent.clear(screen.getByLabelText('Password'))
  await userEvent.type(screen.getByLabelText('Password'), 'weak')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters')
  expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument()
  expect(register).not.toHaveBeenCalled()
})

it('shows native required feedback when only confirmation is empty', async () => {
  const { register } = renderEntry('register')
  await fillRegistration()
  const confirmation = screen.getByLabelText('Confirm password')
  await userEvent.clear(confirmation)
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(confirmation).toHaveAttribute('aria-invalid', 'true')
  expect(confirmation).toHaveAccessibleDescription('Constraints not satisfied')
  expect(screen.getByText('Constraints not satisfied')).toBeVisible()
  expect(register).not.toHaveBeenCalled()
})
