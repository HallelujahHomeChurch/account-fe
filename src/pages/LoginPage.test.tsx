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

    await userEvent.selectOptions(selector, 'zh-Hant')
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

    await userEvent.type(screen.getByLabelText('Email or username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('heading', { name: /profile reached/i })).toBeInTheDocument()
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

    const accountInput = screen.getByLabelText('Email or username')
    expect(accountInput).toHaveAttribute('type', 'text')

    await userEvent.type(accountInput, 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

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

    await userEvent.type(screen.getByLabelText('Email or username'), 'admin@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(requestAuthId).toBe('req-123')
    expect(await screen.findByText(/MFA setup required/i)).toBeInTheDocument()
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
