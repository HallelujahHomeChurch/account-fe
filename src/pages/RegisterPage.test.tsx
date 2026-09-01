import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { RegisterPage } from './RegisterPage'

it('requires current policy acceptance without coupling newsletter consent', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const register = vi.fn(async () => ({}))
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
    getAuthCapabilities: async () => ({
      providers: [], registrationEnabled: true,
      policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' },
    }),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  for (const [label, value] of [
    ['First name', 'Test'], ['Last name', 'User'], ['Email', 'user@example.com'],
    ['Password', 'Password1!'], ['Confirm password', 'Password1!'],
  ]) await userEvent.type(screen.getByLabelText(label), value)

  const submit = screen.getByRole('button', { name: 'Create account' })
  await userEvent.click(submit)
  expect(register).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('checkbox', { name: /I want to receive church news/i }))
  await userEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Use/i }))
  await userEvent.click(submit)

  expect(register).toHaveBeenCalledWith(expect.objectContaining({
    newsletter_opt_in: true,
    policy: { accepted: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1', locale: 'en' },
  }))
})

it('clears a stale native continuation on ordinary registration', async () => {
  localStorage.setItem('hhc_native_auth_request_id', 'stale-request')
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    register: async () => ({}),
  }

  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  await waitFor(() => expect(localStorage.getItem('hhc_native_auth_request_id')).toBeNull())
})

it.each([
  ['ja', 'HHCアカウントを作成', 'Google アカウントで続ける', 'またはメールアドレスで作成'],
  ['ko', 'HHC 계정 만들기', 'Google 계정으로 계속하기', '또는 이메일로 계정 만들기'],
])('keeps shared social registration above email fields in %s', async (locale, title, socialLabel, divider) => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register: async () => ({}),
    getAuthCapabilities: async () => ({ providers: ['google'], registrationEnabled: true }),
    getSocialLoginUrl: (provider) => `/oauth2/${provider}/login`,
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  const social = await screen.findByLabelText(socialLabel)
  const form = document.querySelector('.form-stack') as Element
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  expect(screen.getByText(divider)).toBeInTheDocument()
  expect(social.closest('.social-login-panel')?.compareDocumentPosition(form)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

it.each(['ja', 'ko'])('keeps the %s product cookie on registration API calls', async (locale) => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  const register = vi.fn(async () => {
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
    return {}
  })
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), register,
  }
  const labels = locale === 'ja'
    ? ['名', '姓', 'メールアドレス', 'パスワード', 'パスワード（確認）', 'アカウントを作成']
    : ['이름', '성', '이메일', '비밀번호', '비밀번호 확인', '계정 만들기']
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider></LocaleProvider></MemoryRouter>)

  for (const [label, value] of labels.slice(0, 5).map((label, index) => [label, ['Test', 'User', 'user@example.com', 'Password1!', 'Password1!'][index]])) {
    await userEvent.type(screen.getByLabelText(label), value)
  }
  await userEvent.click(screen.getByRole('button', { name: labels[5] }))
  expect(register).toHaveBeenCalledTimes(1)
})

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
            <Route path="/login" element={<><p>Registration complete</p><LocationSearch /></>} />
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
  expect(screen.getByTestId('location-search')).toHaveTextContent('')
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
  expect(screen.getByLabelText('Continue with LINE')).toHaveAttribute('href', '/api/account/v1/oauth2/line/login')
  expect(screen.queryByLabelText('Continue with Microsoft')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  expect(socialPanel?.compareDocumentPosition(form as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(screen.getByText('Or create an account with email')).toBeInTheDocument()
})

it('preserves an encoded auth_request_id in back navigation and every social provider', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    register: async () => ({}),
    getAuthCapabilities: async () => ({ providers: ['google', 'line', 'microsoft'], registrationEnabled: true }),
    getSocialLoginUrl: (provider, authRequestId) =>
      `/api/account/v1/oauth2/${provider}/login?${new URLSearchParams({ auth_request_id: authRequestId ?? '' }).toString()}`,
  }

  render(
    <MemoryRouter initialEntries={['/register?auth_request_id=req%2F%3F%23%20%2B%26']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <Routes>
            <Route path="/login" element={<LocationSearch />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  const query = 'auth_request_id=req%2F%3F%23+%2B%26'
  expect(await screen.findByLabelText('Continue with Google')).toHaveAttribute(
    'href',
    `/api/account/v1/oauth2/google/login?${query}`,
  )
  expect(screen.getByLabelText('Continue with LINE')).toHaveAttribute(
    'href',
    `/api/account/v1/oauth2/line/login?${query}`,
  )
  expect(screen.getByLabelText('Continue with Microsoft')).toHaveAttribute(
    'href',
    `/api/account/v1/oauth2/microsoft/login?${query}`,
  )

  await userEvent.click(screen.getByRole('link', { name: 'Back to sign in' }))

  expect(screen.getByTestId('location-search')).toHaveTextContent('?auth_request_id=req%2F%3F%23+%2B%26')
})

it('preserves auth_request_id after registration succeeds', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    register: async () => ({}),
  }

  render(
    <MemoryRouter initialEntries={['/register?auth_request_id=req%2F%3F%23%20%2B%26']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <Routes>
            <Route path="/login" element={<LocationSearch />} />
            <Route path="/register" element={<RegisterPage />} />
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

  expect(await screen.findByTestId('location-search')).toHaveTextContent('?auth_request_id=req%2F%3F%23+%2B%26')
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

function LocationSearch() {
  return <span data-testid="location-search">{useLocation().search}</span>
}
