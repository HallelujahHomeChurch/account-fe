import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
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
    await userEvent.click(screen.getByRole('option', { name: '繁中' }))
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
    let requestAuthId = ''
    const api: AuthApi = {
      login: async (request) => {
        requestAuthId = request.authRequestId ?? ''
        return { mfa_type: 'setup_required', mfa_token: 'mfa-123' }
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
    expect(await screen.findByRole('heading', { name: /multi-factor authentication/i })).toBeInTheDocument()
    expect(screen.queryByText(/MFA setup required/i)).not.toBeInTheDocument()
  })

  it('renders MFA verification without redundant notices or button icon', async () => {
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
    expect(screen.getByText('Open your authenticator app and enter the 6-digit code.')).toBeInTheDocument()
    expect(screen.queryByText('Complete the required verification step.')).not.toBeInTheDocument()
    expect(screen.queryByText(/signed in/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/MFA verification required/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(document.querySelector('.login-actions svg')).not.toBeInTheDocument()
  })

  it('renders the MFA setup QR code when setup is required', async () => {
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'setup_required', mfa_token: 'mfa-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      setupMfaWithToken: async () => ({
        otpauth_url: 'otpauth://totp/HHC:admin@example.com?secret=ABC123&issuer=HHC',
        qr_code_url: 'data:image/png;base64,abc123',
        backup_codes: ['11111111'],
      }),
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

    expect(
      await screen.findByText('Scan the QR code with your authenticator app, then enter the 6-digit code.'),
    ).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /MFA setup QR code/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,abc123',
    )
    expect(screen.queryByText(/otpauth:\/\/totp/i)).not.toBeInTheDocument()
  })

  it('renders OAuth provider links as circular icon buttons below the email login flow', () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      getSocialLoginUrl: (provider, authRequestId) =>
        `/api/account/v1/oauth2/${provider}/login?auth_request_id=${authRequestId}`,
    }

    render(
      <MemoryRouter initialEntries={['/login?auth_request_id=req-123']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <LoginPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    const form = document.querySelector('.form-stack')
    const socialPanel = document.querySelector('.social-login-panel')
    const socialButtons = Array.from(document.querySelectorAll('.social-icon-button'))

    expect(form).toBeInTheDocument()
    expect(socialPanel).toBeInTheDocument()
    expect(form?.compareDocumentPosition(socialPanel as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(socialButtons).toHaveLength(3)

    expect(screen.getByLabelText('Continue with Google')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/google/login?auth_request_id=req-123',
    )
    expect(screen.getByLabelText('Continue with LINE')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/line/login?auth_request_id=req-123',
    )
    expect(screen.getByLabelText('Continue with Microsoft')).toHaveAttribute(
      'href',
      '/api/account/v1/oauth2/microsoft/login?auth_request_id=req-123',
    )
  })
})
