import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { LoginPage } from './LoginPage'
import { ApiError } from '../lib/api'
import { consumePostLoginReturnTo, hasPostLoginReturnTo, savePostLoginReturnTo } from '../auth/auth-routes'

describe('LoginPage', () => {
  it.each([
    ['ja', 'ハレルヤ家の教会', '次へ', 'Google アカウントで続ける', 'パスワード'],
    ['ko', '할렐루야 가정교회', '다음', 'Google 계정으로 계속하기', '비밀번호'],
  ])('renders login and shared social auth naturally in %s', async (locale, heading, next, socialLabel, passwordLabel) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
      getAuthCapabilities: async () => ({ providers: ['google'], registrationEnabled: true }),
      getSocialLoginUrl: (provider) => `/oauth2/${provider}/login`,
    }
    render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><LoginPage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: next })).toBeInTheDocument()
    expect(screen.getByLabelText(socialLabel)).toHaveAttribute('href', '/oauth2/google/login')
    expect(screen.getByLabelText(passwordLabel)).not.toHaveAttribute('placeholder')
  })

  it('shows a localized credential error instead of the backend message', async () => {
    document.cookie = 'hhc_locale=en; Path=/'
    const api: AuthApi = {
      login: async () => { throw new ApiError(401, 'Login failed', 'ACC_AUTH_INVALID_CREDENTIALS') },
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider><AuthProvider api={api} restoreSession={false}><LoginPage /></AuthProvider></LocaleProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.queryByText('Login failed')).not.toBeInTheDocument()
  })

  it('shows a one-time signed-out notice without refreshing the session', async () => {
    document.cookie = 'hhc_locale=en; Path=/'
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login?signed_out=1']}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
            <LocationSearch />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Signed out.')).toHaveClass('form-success')
    expect(refreshAccessToken).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement())
  })

  it('shows the registration next step and prefills the email without a toast', async () => {
    document.cookie = 'hhc_locale=en; Path=/'
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { registrationEmail: 'user@example.com', registrationComplete: true },
      }]}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    const notice = await screen.findByText('Verification email sent. Verify your email to sign in.')
    expect(notice).toHaveClass('form-success')
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com')
    expect(document.querySelector('.hhc-toast')).not.toBeInTheDocument()
  })

  it('shows a neutral localized OAuth cancellation and removes callback details', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login?locale=zh-Hant&oauth_error=cancelled&oauth_provider=google']}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
            <LocationSearch />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('登入尚未完成，你可以重新選擇帳號。')).toHaveClass('form-notice')
    await vi.waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement())
  })

  it('shows a localized consumer-account requirement', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login?oauth_error=workspace_not_allowed&oauth_provider=google']}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '此 Google Workspace 帳戶無法使用，請改用個人 Google 帳戶。',
    )
  })

  it('keeps the login card copy minimal', () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    const card = document.querySelector('.login-card')
    expect(card).toBeInTheDocument()
    expect(card?.querySelector('.login-brand-mark')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '哈利路亞家教會' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText('Email 或使用者名稱')).not.toBeInTheDocument()
    expect(document.querySelector('.login-actions svg')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '登入' })).not.toBeInTheDocument()
    expect(screen.queryByText('使用你的 HHC 帳戶')).not.toBeInTheDocument()
    expect(screen.queryByText('account.alive.org.tw')).not.toBeInTheDocument()
    expect(screen.queryByText(/Access token/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/使用同一個 HHC 帳號/i)).not.toBeInTheDocument()
  })

  it('renders the shared language selector below the login card', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Hallelujah Home Church' })).toBeInTheDocument()

    const selector = screen.getByLabelText('Language')
    expect(selector.closest('.login-card')).toBeNull()

    await userEvent.click(selector)
    await userEvent.click(screen.getByRole('option', { name: '繁體中文' }))
    expect(document.cookie).toContain('hhc_locale=zh-Hant')
  })

  it('navigates to profile after direct login succeeds', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<h1>Profile reached</h1>} path="/profile" />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('heading', { name: /profile reached/i })).toBeInTheDocument()
  })

  it('navigates a policy-required response with the token in the fragment', async () => {
    sessionStorage.clear()
    const api: AuthApi = {
      login: async () => ({ policy_acceptance_required: true, policy_token: 'policy-token', terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' }),
      me: async () => ({ id: 'u1', email: 'admin' }), refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/login?return_to=/data-requests']}><AuthProvider api={api} restoreSession={false}><Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<LocationHash />} path="/policy/acceptance" />
    </Routes></AuthProvider></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('Email'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByTestId('location-hash')).toHaveTextContent('#token=policy-token')
    expect(hasPostLoginReturnTo()).toBe(true)
    expect(consumePostLoginReturnTo()).toBe('/data-requests')
  })

  it('preserves the safe return path when MFA leads to policy acceptance', async () => {
    sessionStorage.clear()
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      verifyMfa: async () => ({ policy_acceptance_required: true, policy_token: 'policy-token' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }), refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/login?return_to=/data-requests']}><AuthProvider api={api} restoreSession={false}><Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<LocationHash />} path="/policy/acceptance" />
    </Routes></AuthProvider></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByTestId('location-hash')).toHaveTextContent('#token=policy-token')
    expect(consumePostLoginReturnTo()).toBe('/data-requests')
  })

  it('clears a social continuation after a cancelled provider login', async () => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    const api: AuthApi = { login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }), refreshAccessToken: async () => null, logout: async () => ({}) }
    render(<MemoryRouter initialEntries={['/login?oauth_error=cancelled']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><LoginPage /></AuthProvider></LocaleProvider></MemoryRouter>)
    await screen.findByText('Sign-in was not completed. You can choose an account and try again.')
    expect(hasPostLoginReturnTo()).toBe(false)
  })

  it('continues an existing account session without showing a refresh error', async () => {
    const refreshAccessToken = vi.fn(async () => 'token')
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true,
        user: { id: 'u1', email: 'admin', display_name: 'Admin', avatar_url: null },
      }),
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login?return_to=/security']}>
        <AuthProvider api={api}>
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<h1>Security reached</h1>} path="/security" />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Security reached' })).toBeInTheDocument()
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('ACC_AUTH_REFRESH_TOKEN_REQUIRED')).not.toBeInTheDocument()
  })

  it('keeps forgot password with the password field instead of the action row', () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const forgotPassword = screen.getByRole('link', { name: /forgot password/i })
    const actions = document.querySelector('.login-actions')

    expect(forgotPassword.closest('.login-actions')).toBeNull()
    expect(actions).toContainElement(screen.getByRole('button', { name: /next/i }))
    expect(forgotPassword.compareDocumentPosition(actions as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('allows the seeded admin username to be submitted', async () => {
    let submittedEmail = ''
    const api: AuthApi = {
      login: async (request) => {
        submittedEmail = request.email
        return { access_token: 'token' }
      },
      me: async () => ({ id: 'u1', email: 'admin' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const accountInput = screen.getByLabelText('Email')
    expect(accountInput).toHaveAttribute('type', 'text')

    await userEvent.type(accountInput, 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(submittedEmail).toBe('admin')
  })

  it('passes auth_request_id from the URL into account-api login', async () => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    let requestAuthId = ''
    const api: AuthApi = {
      login: async (request) => {
        requestAuthId = request.authRequestId ?? ''
        return { mfa_type: 'verification_required', mfa_token: 'mfa-123' }
      },
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getSocialLoginUrl: () => '/api/account/v1/oauth2/google/login?auth_request_id=req-123',
    }

    render(
      <MemoryRouter initialEntries={['/login?auth_request_id=req-123']}>
        <AuthProvider api={api}>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(requestAuthId).toBe('req-123')
    expect(hasPostLoginReturnTo()).toBe(false)
    expect(await screen.findByRole('heading', { name: /multi-factor authentication/i })).toBeInTheDocument()
    expect(screen.queryByText(/MFA setup required/i)).not.toBeInTheDocument()
  })

  it('renders MFA verification with an OTP code field and minimal copy', async () => {
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('heading', { name: /multi-factor authentication/i })).toBeInTheDocument()
    expect(screen.getByText('Enter your verification code.')).toBeInTheDocument()
    expect(screen.queryByText('Open your authenticator app and enter the 6-digit code.')).not.toBeInTheDocument()
    expect(screen.queryByText('Complete the required verification step.')).not.toBeInTheDocument()
    expect(screen.getByText('Verification code')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="input-otp-slot"]')).toHaveLength(6)
    expect(screen.queryByText(/signed in/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/MFA verification required/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(document.querySelector('.login-actions svg')).not.toBeInTheDocument()
  })

  it('submits the MFA code from the OTP field', async () => {
    let submittedToken = ''
    let submittedCode = ''
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      verifyMfa: async (token, code) => {
        submittedToken = token
        submittedCode = code
        return { access_token: 'access-123' }
      },
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(submittedToken).toBe('mfa-123')
    expect(submittedCode).toBe('123456')
  })

  it('navigates to profile after MFA verification succeeds', async () => {
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      verifyMfa: async () => ({ access_token: 'access-123' }),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<h1>Profile reached</h1>} path="/profile" />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('heading', { name: /profile reached/i })).toBeInTheDocument()
  })

  it('clears a stale continuation before a password login returns elsewhere', async () => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    const api: AuthApi = {
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/login?return_to=/security']}><AuthProvider api={api} restoreSession={false}><Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<h1>Security reached</h1>} path="/security" />
    </Routes></AuthProvider></MemoryRouter>)

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('heading', { name: 'Security reached' })).toBeInTheDocument()
    expect(hasPostLoginReturnTo()).toBe(false)
  })

  it('clears a stale continuation before an MFA login returns elsewhere', async () => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      verifyMfa: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/login?return_to=/security']}><AuthProvider api={api} restoreSession={false}><Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<h1>Security reached</h1>} path="/security" />
    </Routes></AuthProvider></MemoryRouter>)

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('heading', { name: 'Security reached' })).toBeInTheDocument()
    expect(hasPostLoginReturnTo()).toBe(false)
  })

  it.each(['password', 'mfa'])('clears a matching DSR continuation after direct %s success', async (flow) => {
    sessionStorage.clear()
    savePostLoginReturnTo('/data-requests')
    const api: AuthApi = {
      login: async () => flow === 'mfa'
        ? { mfa_type: 'verification_required', mfa_token: 'mfa-123' }
        : { access_token: 'access-123' },
      verifyMfa: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
    }
    render(<MemoryRouter initialEntries={['/login?return_to=/data-requests']}><AuthProvider api={api} restoreSession={false}><Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<h1>Data requests reached</h1>} path="/data-requests" />
    </Routes></AuthProvider></MemoryRouter>)

    await userEvent.type(screen.getByLabelText('Email'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    if (flow === 'mfa') {
      await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }

    expect(await screen.findByRole('heading', { name: 'Data requests reached' })).toBeInTheDocument()
    expect(hasPostLoginReturnTo()).toBe(false)
  })

  it('renders OAuth provider links as circular icon buttons below the email login flow', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getOAuthProviders: async () => ['google', 'line', 'microsoft'],
      getSocialLoginUrl: (provider, authRequestId) =>
        `/api/account/v1/oauth2/${provider}/login${authRequestId ? `?auth_request_id=${authRequestId}` : ''}`,
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    await screen.findByLabelText('Continue with Google')
    const form = document.querySelector('.form-stack')
    const socialPanel = document.querySelector('.social-login-panel')
    const socialButtons = Array.from(document.querySelectorAll('.social-icon-button'))

    expect(form).toBeInTheDocument()
    expect(socialPanel).toBeInTheDocument()
    expect(form?.compareDocumentPosition(socialPanel as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(socialButtons).toHaveLength(3)

    expect(screen.getByLabelText('Continue with Google')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/google/login',
    )
    expect(screen.getByLabelText('Continue with LINE')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/line/login',
    )
    expect(screen.getByLabelText('Continue with Microsoft')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/microsoft/login',
    )
  })

  it('stores a safe one-time return path only for direct social sign-in', async () => {
    sessionStorage.clear()
    const api: AuthApi = {
      login: async () => ({}), me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null, logout: async () => ({}),
      getAuthCapabilities: async () => ({ providers: ['google'], registrationEnabled: false }),
      getSocialLoginUrl: () => '#',
    }
    const first = render(<MemoryRouter initialEntries={['/login?return_to=/data-requests']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><LoginPage /></AuthProvider></LocaleProvider></MemoryRouter>)
    await userEvent.click(await screen.findByLabelText('Continue with Google'))
    expect(consumePostLoginReturnTo()).toBe('/data-requests')
    first.unmount()

    render(<MemoryRouter initialEntries={['/login?return_to=/data-requests&auth_request_id=req-1']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><LoginPage /></AuthProvider></LocaleProvider></MemoryRouter>)
    await userEvent.click(await screen.findByLabelText('Continue with Google'))
    expect(consumePostLoginReturnTo()).toBe('/profile')
  })

  it('shows account registration on the regular login flow when enabled', async () => {
    document.cookie = 'hhc_locale=en; Path=/'
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getAuthCapabilities: async () => ({ providers: [], registrationEnabled: true }),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register')
  })

  it('preserves an encoded auth_request_id in the create account link', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getAuthCapabilities: async () => ({ providers: [], registrationEnabled: true }),
    }

    render(
      <MemoryRouter initialEntries={['/login?auth_request_id=req%2F%3F%23%20%2B%26']}>
        <LocaleProvider>
          <AuthProvider api={api} restoreSession={false}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register?auth_request_id=req%2F%3F%23+%2B%26',
    )
  })

  it('only renders OAuth providers enabled by the API', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getOAuthProviders: async () => ['google'],
      getSocialLoginUrl: (provider) => `/api/account/v1/oauth2/${provider}/login`,
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText('Continue with Google')).toBeInTheDocument()
    expect(screen.queryByLabelText('Continue with LINE')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Continue with Microsoft')).not.toBeInTheDocument()
  })
})

function LocationSearch() {
  return <span data-testid="location-search">{useLocation().search}</span>
}

function LocationHash() {
  return <span data-testid="location-hash">{useLocation().hash}</span>
}
