import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'
import { AuthProvider, type AuthApi } from './auth/auth-context'

const api: AuthApi = {
  login: async () => ({ access_token: 'token' }),
  refreshAccessToken: async () => null,
  me: async () => ({ id: 'u1', email: 'ray@example.com' }),
  logout: async () => ({}),
}

const signedInApi: AuthApi = {
  ...api,
  refreshAccessToken: async () => 'token',
}

describe('App layout', () => {
  it('does not show account navigation on the login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /hallelujah home church/i })).toBeInTheDocument()
  })

  it('does not show account navigation on email recovery routes', async () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('redirects protected account routes before rendering account navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /hallelujah home church/i })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /account sections/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
  })

  it('shows account navigation and account menu for signed-in account routes', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('complementary', { name: /account sections/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /account navigation/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/account menu/i)).toBeInTheDocument()
  })
})
