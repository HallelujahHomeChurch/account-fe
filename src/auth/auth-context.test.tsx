import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, RoutedAuthProvider, useAuth, type AuthApi } from './auth-context'
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

  return <div>{auth.isBootstrapping ? 'bootstrapping' : 'ready'}</div>
}

describe('AuthProvider', () => {
  it('uses the built-in mock account API when mock mode is enabled', async () => {
    const config: RuntimeConfig = {
      accountApiBaseUrl: '/api/account/v1',
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

  it('keeps MFA setup-required challenge from login response', async () => {
    const api: AuthApi = {
      login: async () => ({ mfa_type: 'setup_required', mfa_token: 'mfa-123' }),
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

    expect(await screen.findByTestId('mfa')).toHaveTextContent('setup_required')
    expect(screen.getByTestId('token')).toBeEmptyDOMElement()
  })

  it('does not refresh the session on public auth routes', async () => {
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
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
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('refreshes the session on protected account routes', async () => {
    const refreshAccessToken = vi.fn(async () => null)
    const api: AuthApi = {
      login: async () => ({ access_token: 'access-123' }),
      me: async () => ({ id: 'u1', email: 'admin@example.com' }),
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

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('ready')).toBeInTheDocument()
  })
})
