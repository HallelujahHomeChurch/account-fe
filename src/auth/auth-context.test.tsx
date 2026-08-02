import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, RoutedAuthProvider, useAuth, type AuthApi } from './auth-context'
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

describe('AuthProvider', () => {
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
      allowedRedirectSchemes: ['hhc'],
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
    await new Promise((resolve) => setTimeout(resolve, 0))

    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
      expect(screen.getByTestId('token')).toBeEmptyDOMElement()
      expect(screen.getByTestId('email')).toBeEmptyDOMElement()
    })
  })

  it('debounces focus and pageshow session revalidation', async () => {
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
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(issueAccessToken).toHaveBeenCalledTimes(1)
    expect(refreshAccessToken).not.toHaveBeenCalled()
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
      allowedRedirectSchemes: ['hhc'],
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
