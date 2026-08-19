import { MemoryRouter } from 'react-router-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, RoutedAuthProvider, useAuth, type AuthApi } from './auth-context'
import { LocaleProvider, useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import type { RuntimeConfig } from '../lib/redirects'

function LoginProbe() {
  const auth = useAuth()

  return (
    <div>
      <button
        type="button"
        onClick={() => auth.login({ email: 'admin@example.com', password: 'secret123' })}
      >
        Login
      </button>
      <button type="button" onClick={() => void auth.retrySession()}>
        Retry session
      </button>
      <div data-testid="token">{auth.accessToken}</div>
      <div data-testid="email">{auth.profile?.email}</div>
      <div data-testid="mfa">{auth.mfaChallenge?.type}</div>
      <div data-testid="status">{auth.status}</div>
    </div>
  )
}

function MockLoginProbe() {
  const auth = useAuth()

  return (
    <div>
      <button type="button" onClick={() => auth.login({ email: 'admin', password: 'admin123' })}>
        Login mock admin
      </button>
      <div data-testid="token">{auth.accessToken}</div>
      <div data-testid="email">{auth.profile?.email}</div>
    </div>
  )
}

function BootstrapProbe() {
  const auth = useAuth()

  return (
    <div>
      <span>{auth.isBootstrapping ? 'bootstrapping' : 'ready'}</span>
      <span role="alert">{auth.bootstrapError}</span>
      <span data-testid="status">{auth.status}</span>
    </div>
  )
}

function LogoutProbe() {
  const auth = useAuth()
  return (
    <div>
      <button type="button" onClick={() => void auth.logout()}>
        Logout
      </button>
      <div data-testid="email">{auth.profile?.email}</div>
      <div role="alert">{auth.logoutError}</div>
    </div>
  )
}

function LocaleRefreshProbe() {
  const auth = useAuth()
  const { locale, setLocale } = useLocale()
  return (
    <div>
      <button type="button" onClick={() => void auth.refreshProfile()}>Refresh profile</button>
      <button type="button" onClick={() => setLocale('ko')}>Switch to Korean</button>
      <span data-testid="profile-name">{auth.profile?.first_name}</span>
      <span data-testid="current-locale">{locale}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  it('does not restore a cached bootstrap profile when the locale changes', async () => {
    document.cookie = 'hhc_locale=en; Path=/'
    const me = vi.fn()
      .mockResolvedValueOnce({ id: 'u1', email: 'admin@example.com', first_name: 'Initial' })
      .mockResolvedValueOnce({ id: 'u1', email: 'admin@example.com', first_name: 'Updated' })
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true as const,
        user: { id: 'u1', email: 'admin@example.com', display_name: 'Initial', avatar_url: null },
      }),
      issueAccessToken: async () => 'access-123',
      login: async () => ({}),
      me,
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
    }

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <RoutedAuthProvider api={api}>
            <LocaleRefreshProbe />
          </RoutedAuthProvider>
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Initial')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh profile' }))
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Updated')

    await userEvent.click(screen.getByRole('button', { name: 'Switch to Korean' }))
    await waitFor(() => expect(screen.getByTestId('current-locale')).toHaveTextContent('ko'))
    await Promise.resolve()

    expect(screen.getByTestId('profile-name')).toHaveTextContent('Updated')
    expect(me).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['ja', 'ログイン状態を確認できませんでした。もう一度お試しください。'],
    ['ko', '로그인 상태를 확인할 수 없어요. 다시 시도해 주세요.'],
  ])('localizes the %s session bootstrap error', async (locale, expected) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    const api: AuthApi = {
      getSession: async () => { throw new ApiError(503, 'session backend topology leaked') },
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/login']}>
          <RoutedAuthProvider api={api}>
            <BootstrapProbe />
          </RoutedAuthProvider>
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(screen.queryByText('session backend topology leaked')).not.toBeInTheDocument()
  })

  it.each([
    ['ja', 'ログアウトできませんでした。もう一度お試しください。'],
    ['ko', '로그아웃할 수 없어요. 다시 시도해 주세요.'],
  ])('localizes the %s sign-out error', async (locale, expected) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true as const,
        user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
      }),
      issueAccessToken: async () => 'access-123',
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
      logoutAll: async () => { throw new ApiError(503, 'logout provider detail leaked') },
    }

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <RoutedAuthProvider api={api}>
            <LogoutProbe />
          </RoutedAuthProvider>
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(await screen.findByTestId('email')).toHaveTextContent('admin@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(screen.queryByText('logout provider detail leaked')).not.toBeInTheDocument()
  })

  it('retains authenticated state when global logout fails', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
      logoutAll: async () => {
        throw new Error('unavailable')
      },
    }

    render(
      <AuthProvider api={api}>
        <LogoutProbe />
      </AuthProvider>,
    )
    expect(await screen.findByTestId('email')).toHaveTextContent('admin@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out. Try again.')
    expect(screen.getByTestId('email')).toHaveTextContent('admin@example.com')
  })

  it('clears state and replaces history after global logout succeeds', async () => {
    const navigateAfterLogout = vi.fn()
    const api: AuthApi = {
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
      logoutAll: async () => {},
    }

    render(
      <AuthProvider api={api} navigateAfterLogout={navigateAfterLogout}>
        <LogoutProbe />
      </AuthProvider>,
    )
    expect(await screen.findByTestId('email')).toHaveTextContent('admin@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => expect(navigateAfterLogout).toHaveBeenCalledWith('/login?signed_out=1'))
    expect(screen.getByTestId('email')).toBeEmptyDOMElement()
  })

  it('uses the built-in mock account API when mock mode is enabled', async () => {
    const config: RuntimeConfig = {
      accountApiBaseUrl: '/api/account/v1',
      accountAuthorizeBaseUrl: '/api/account/v1',
      accountClientId: 'account-console',
      redirectUri: 'http://localhost/oauth/callback',
      oauthScope: 'openid profile email',
      mockApi: true,
      allowedRedirectOrigins: ['http://localhost:5173'],
      allowedRedirectSchemes: ['librepresenter'],
      publicSiteUrl: 'https://www.alive.org.tw',
    }

    render(
      <AuthProvider config={config}>
        <MockLoginProbe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Login mock admin' }))

    expect(await screen.findByTestId('token')).toHaveTextContent('mock-access-token')
    expect(screen.getByTestId('email')).toHaveTextContent('admin')
  })

  it('stores direct-login access token in memory and loads profile', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <LoginProbe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByTestId('token')).toHaveTextContent('access-123')
    expect(screen.getByTestId('email')).toHaveTextContent('admin@example.com')
  })

  it('keeps MFA verification challenge from login response', async () => {
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <LoginProbe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByTestId('mfa')).toHaveTextContent('verification_required')
    expect(screen.getByTestId('token')).toBeEmptyDOMElement()
  })

  it('checks the session without refreshing on anonymous auth routes', async () => {
    const getSession = vi.fn(async () => ({ authenticated: false as const }))
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      getSession,
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <RoutedAuthProvider api={api}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('issues a non-rotating access token and loads the profile when a session exists', async () => {
    const getSession = vi.fn(async () => ({
      authenticated: true as const,
      user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
    }))
    const refreshAccessToken = vi.fn(async () => 'access-123')
    const issueAccessToken = vi.fn(async () => 'access-123')
    const me = vi.fn(async () => ({ id: 'u1', email: 'admin@example.com' }))
    const api: AuthApi = {
      getSession,
      login: async () => ({ access_token: 'access-123' }),
      me,
      issueAccessToken,
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <RoutedAuthProvider api={api}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(issueAccessToken).toHaveBeenCalledTimes(1))
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(me).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('ready')).toBeInTheDocument()
  })

  it('does not bootstrap the session on the OAuth callback route', async () => {
    const getSession = vi.fn(async () => ({ authenticated: false as const }))
    const issueAccessToken = vi.fn(async () => 'unused')
    const api: AuthApi = {
      getSession,
      issueAccessToken,
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/oauth/callback?code=code&state=state']}>
        <RoutedAuthProvider api={api}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(getSession).not.toHaveBeenCalled()
    expect(issueAccessToken).not.toHaveBeenCalled()
  })

  it('shares one session bootstrap across StrictMode effect replay', async () => {
    const getSession = vi.fn(async () => ({ authenticated: false as const }))
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      getSession,
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <StrictMode>
        <AuthProvider api={api}>
          <BootstrapProbe />
        </AuthProvider>
      </StrictMode>,
    )

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('shows a recoverable error without attempting refresh when session lookup fails', async () => {
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      getSession: async () => {
        throw new Error('unavailable')
      },
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <BootstrapProbe />
      </AuthProvider>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to check your sign-in status. Try again.')
    expect(screen.getByTestId('status')).toHaveTextContent('unavailable')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('does not let a stale bootstrap overwrite a newer login', async () => {
    let finishSession!: (session: { authenticated: false }) => void
    const session = new Promise<{ authenticated: false }>((resolve) => {
      finishSession = resolve
    })
    const api: AuthApi = {
      getSession: () => session,
      login: async () => ({ access_token: 'new-access-token' }),
      me: async () => ({ id: 'u1', email: 'new@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <LoginProbe />
      </AuthProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByTestId('email')).toHaveTextContent('new@example.com')
    finishSession({ authenticated: false })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('token')).toHaveTextContent('new-access-token')
    expect(screen.getByTestId('email')).toHaveTextContent('new@example.com')
  })

  it('clears token and profile together after terminal refresh failure', async () => {
    const issueAccessToken = vi.fn(async () => 'access-123')
    const refreshAccessToken = vi.fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new ApiError(401, 'invalid refresh'))
    const me = vi
      .fn()
      .mockResolvedValueOnce({ id: 'u1', email: 'admin@example.com' })
      .mockRejectedValue(new ApiError(401, 'expired access token'))
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true as const,
        user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
      }),
      login: async () => ({}),
      me,
      issueAccessToken,
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <LoginProbe />
      </AuthProvider>,
    )
    expect(await screen.findByTestId('email')).toHaveTextContent('admin@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Retry session' }))

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
      expect(screen.getByTestId('token')).toBeEmptyDOMElement()
      expect(screen.getByTestId('email')).toBeEmptyDOMElement()
    })
  })

  it('joins lifecycle revalidation to the unresolved cold bootstrap', async () => {
    vi.useFakeTimers()
    let finishSession!: (session: {
      authenticated: true
      user: { id: string; email: string; display_name: string; avatar_url: null }
    }) => void
    const getSession = vi.fn(() => new Promise<{
      authenticated: true
      user: { id: string; email: string; display_name: string; avatar_url: null }
    }>((resolve) => {
      finishSession = resolve
    }))
    const issueAccessToken = vi.fn(async () => 'access-123')
    const me = vi.fn(async () => ({ id: 'u1', email: 'admin@example.com' }))
    const api: AuthApi = {
      getSession,
      login: async () => ({}),
      me,
      issueAccessToken,
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
    }

    try {
      render(
        <AuthProvider api={api}>
          <BootstrapProbe />
        </AuthProvider>,
      )

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(151)

      expect(getSession).toHaveBeenCalledTimes(1)

      await act(async () => {
        finishSession({
          authenticated: true,
          user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
        })
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('ready')).toBeInTheDocument()
      expect(issueAccessToken).toHaveBeenCalledTimes(1)
      expect(me).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores non-persisted pageshow session revalidation', async () => {
    const getSession = vi.fn(async () => ({
      authenticated: true as const,
      user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
    }))
    const refreshAccessToken = vi.fn(async () => 'access-123')
    const issueAccessToken = vi.fn(async () => 'access-123')
    const me = vi.fn(async () => ({ id: 'u1', email: 'admin@example.com' }))
    const api: AuthApi = {
      getSession,
      login: async () => ({}),
      me,
      issueAccessToken,
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <BootstrapProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeInTheDocument()

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(me).toHaveBeenCalledTimes(1)
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(issueAccessToken).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('debounces focus and visibility session revalidation after bootstrap', async () => {
    const getSession = vi.fn(async () => ({
      authenticated: true as const,
      user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
    }))
    const refreshAccessToken = vi.fn(async () => 'access-123')
    const issueAccessToken = vi.fn(async () => 'access-123')
    const me = vi.fn(async () => ({ id: 'u1', email: 'admin@example.com' }))
    const api: AuthApi = {
      getSession,
      login: async () => ({}),
      me,
      issueAccessToken,
      refreshAccessToken,
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <BootstrapProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeInTheDocument()

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(issueAccessToken).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('revalidates once after a persisted pageshow', async () => {
    const me = vi.fn(async () => ({ id: 'u1', email: 'admin@example.com' }))
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true as const,
        user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
      }),
      login: async () => ({}),
      me,
      issueAccessToken: async () => 'access-123',
      refreshAccessToken: async () => 'access-123',
      logout: async () => ({}),
    }

    render(
      <AuthProvider api={api}>
        <BootstrapProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeInTheDocument()

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))

    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
  })

  it('starts one authorization transaction for a protected route without a local session', async () => {
    sessionStorage.clear()
    const navigateExternal = vi.fn()
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      getSession: async () => ({ authenticated: false as const }),
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken,
      logout: async () => ({}),
    }
    const config: RuntimeConfig = {
      accountApiBaseUrl: '/api/account/v1',
      accountAuthorizeBaseUrl: '/api/account/v1',
      accountClientId: 'account-console',
      redirectUri: 'http://localhost/oauth/callback',
      oauthScope: 'openid profile email',
      mockApi: false,
      allowedRedirectOrigins: ['http://localhost'],
      allowedRedirectSchemes: ['librepresenter'],
      publicSiteUrl: 'https://www.alive.org.tw',
    }

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/security?tab=mfa#codes']}>
          <RoutedAuthProvider api={api} config={config} navigateExternal={navigateExternal}>
            <BootstrapProbe />
          </RoutedAuthProvider>
        </MemoryRouter>
      </StrictMode>,
    )

    await waitFor(() => expect(navigateExternal).toHaveBeenCalledTimes(1))
    const authorizeUrl = new URL(navigateExternal.mock.calls[0]?.[0], 'http://localhost')
    expect(authorizeUrl.pathname).toBe('/api/account/v1/oauth/authorize')
    expect(authorizeUrl.searchParams.get('client_id')).toBe('account-console')
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('hhc_account_oauth_transaction')).toContain('/security?tab=mfa#codes')
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    expect(screen.queryByText('ready')).not.toBeInTheDocument()
  })

  it('does not start authorization from the login route', async () => {
    const navigateExternal = vi.fn()
    const api: AuthApi = {
      getSession: async () => ({ authenticated: false as const }),
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/login']}>
        <RoutedAuthProvider api={api} navigateExternal={navigateExternal}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(navigateExternal).not.toHaveBeenCalled()
  })

  it('does not start authorization before the public LINE consent page renders', async () => {
    const navigateExternal = vi.fn()
    const api: AuthApi = {
      getSession: async () => ({ authenticated: false as const }),
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/line/bind']}>
        <RoutedAuthProvider api={api} navigateExternal={navigateExternal}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('ready')).toBeInTheDocument()
    expect(navigateExternal).not.toHaveBeenCalled()
  })

  it('falls back to authorization when a local session disappears before refresh', async () => {
    const navigateExternal = vi.fn()
    const api: AuthApi = {
      getSession: async () => ({
        authenticated: true as const,
        user: { id: 'u1', email: 'admin@example.com', display_name: 'Admin', avatar_url: null },
      }),
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
    }

    render(
      <MemoryRouter initialEntries={['/devices']}>
        <RoutedAuthProvider api={api} navigateExternal={navigateExternal}>
          <BootstrapProbe />
        </RoutedAuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(navigateExternal).toHaveBeenCalledTimes(1))
  })
})
