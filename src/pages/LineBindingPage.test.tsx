import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { LineBindingPage } from './LineBindingPage'

function renderPage(api: AuthApi, entry = '/line/bind?token=binding-token') {
  document.cookie = 'hhc_locale=en; Path=/'
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <AuthProvider api={api}>
          <LineBindingPage />
          <LocationSearch />
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )
}

function signedInApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: async () => ({ access_token: 'access-token' }),
    refreshAccessToken: async () => 'access-token',
    me: async () => ({ id: 'user-1', email: 'ray@example.com' }),
    logout: async () => ({}),
    getLineBinding: async () => ({
      profile_name: 'LINE_Helper',
      expires_at: '2026-07-28T10:10:00Z',
    }),
    confirmLineBinding: async () => ({ message: 'connected' }),
    ...overrides,
  }
}

describe('LineBindingPage', () => {
  it('shows the LINE profile without exposing the LINE user ID', async () => {
    renderPage(signedInApi())

    expect(await screen.findByRole('heading', { name: 'Connect LINE account' })).toBeInTheDocument()
    expect(screen.getByText('LINE_Helper')).toBeInTheDocument()
    expect(screen.getByText('ray@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/U0123456789abcdef/i)).not.toBeInTheDocument()
  })

  it('consumes the token and removes it from the URL after confirmation', async () => {
    const confirmLineBinding = vi.fn(async () => ({ message: 'connected' }))
    renderPage(signedInApi({ confirmLineBinding }))

    await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))

    expect(confirmLineBinding).toHaveBeenCalledWith('binding-token')
    expect(await screen.findByText('LINE account connected.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location-search')).toBeEmptyDOMElement())
  })

  it('allows an expired binding to be retried', async () => {
    const getLineBinding = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(410, 'expired', 'ACC_LINE_BINDING_INVALID'))
      .mockResolvedValueOnce({
        profile_name: 'LINE_Helper',
        expires_at: '2026-07-28T10:10:00Z',
      })
    renderPage(signedInApi({ getLineBinding }))

    expect(await screen.findByText('This link has expired.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('LINE_Helper')).toBeInTheDocument()
    expect(getLineBinding).toHaveBeenCalledTimes(2)
  })
})

function LocationSearch() {
  return <span data-testid="location-search">{useLocation().search}</span>
}
