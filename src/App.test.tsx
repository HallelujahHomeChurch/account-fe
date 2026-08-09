import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { AuthProvider, type AuthApi } from './auth/auth-context'
import { LocaleProvider } from './i18n/locale-context'
import { ApiError } from './lib/api'
import { clearLineLinkAutoContinue, markLineLinkAutoContinue } from './lib/line-link-intent'

const viewNonce = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const lineConfirmationNonce = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const api: AuthApi = {
  login: async () => ({ access_token: 'token' }),
  refreshAccessToken: async () => null,
  me: async () => ({ id: 'u1', email: 'ray@example.com', first_name: 'Ray', last_name: 'Self' }),
  logout: async () => ({}),
}

const signedInApi: AuthApi = {
  ...api,
  refreshAccessToken: async () => 'token',
}

afterEach(clearLineLinkAutoContinue)

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

  it('returns to LINE binding after login and MFA verification', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-07-28T10:10:00Z',
    }))
    const prepareLineLinkIntent = vi.fn(async () => ({
      return_url: `https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    }))
    const bindingApi: AuthApi = {
      login: async () => ({ mfa_type: 'verification_required', mfa_token: 'mfa-token' }),
      verifyMfa: async () => ({ access_token: 'access-token' }),
      refreshAccessToken: async () => null,
      me: async () => ({ id: 'u1', email: 'ray@example.com' }),
      logout: async () => ({}),
      getLineLinkIntent,
      prepareLineLinkIntent,
    }

    render(
      <MemoryRouter initialEntries={['/line/bind']}>
        <LocaleProvider>
          <AuthProvider api={bindingApi}>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to continue' }))
    await userEvent.type(await screen.findByLabelText('Email'), 'ray@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('button', { name: 'Confirm link' })).toBeInTheDocument()
    expect(getLineLinkIntent).toHaveBeenCalledTimes(2)
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
  })

  it('returns a social login callback from profile to the pending LINE intent', async () => {
    markLineLinkAutoContinue()
    const prepareLineLinkIntent = vi.fn(async () => ({
      return_url: `https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    }))
    const bindingApi: AuthApi = {
      ...signedInApi,
      getLineLinkIntent: async () => ({
        line_account_name: 'HHC Official LINE',
        view_nonce: viewNonce,
        expires_at: '2026-08-08T10:10:00Z',
      }),
      prepareLineLinkIntent,
    }

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <LocaleProvider>
          <AuthProvider api={bindingApi}>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Confirm link' })).toBeInTheDocument()
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
  })

  it.each([
    new ApiError(409, 'conflict', 'ACC_LINE_IDENTITY_CONFLICT'),
    new ApiError(410, 'expired', 'ACC_LINE_BINDING_INVALID'),
    new ApiError(503, 'unavailable'),
  ])('does not redirect Back to a failed LINE intent after %s', async (failure) => {
    markLineLinkAutoContinue()
    const getLineLinkIntent = vi.fn().mockRejectedValue(failure)

    render(
      <MemoryRouter initialEntries={['/profile', '/line/bind']} initialIndex={1}>
        <LocaleProvider>
          <AuthProvider api={{ ...signedInApi, getLineLinkIntent }}>
            <NavigationProbe />
            <App />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() => expect(screen.getByTestId('route-path')).toHaveTextContent('/profile'))
    expect(getLineLinkIntent).toHaveBeenCalledTimes(1)
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
    expect(screen.getByLabelText(/account menu/i).closest('.hhc-account-menu')).toBeInTheDocument()
    expect(document.querySelector('.account-header')).toHaveClass('account-header')
    expect(screen.getByRole('link', { name: 'Devices' })).toBeInTheDocument()
    expect(document.title).toBe('HHC Account')
  })

  it('shows a dismissible avatar account dropdown', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByLabelText(/account menu/i))
    expect(await screen.findByText('Hi Ray Self')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Church website' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/en',
    )

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Hi Ray Self')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/account menu/i)).toHaveFocus())

    await user.click(screen.getByLabelText(/account menu/i))
    expect(await screen.findByText('Hi Ray Self')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText('Hi Ray Self')).not.toBeInTheDocument()
  })

  it('opens and dismisses the mobile account navigation drawer', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /open navigation/i }))
    const dialog = await screen.findByRole('dialog', { name: /account navigation/i })
    expect(dialog.closest('.hhc-modal--drawer-left')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Devices' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /account navigation/i })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /open navigation/i })).toHaveFocus(),
    )
  })

  it('closes the mobile navigation after navigating', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /open navigation/i }))
    const dialog = await screen.findByRole('dialog', { name: /account navigation/i })
    await user.click(within(dialog).getByRole('link', { name: /security/i }))

    expect(screen.queryByRole('dialog', { name: /account navigation/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /security/i })).toBeInTheDocument()
  })

  it('localizes the account brand and legal links using canonical public routes', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <LocaleProvider>
          <AuthProvider api={signedInApi}>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText('HHC 帳戶')).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '隱私權' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/privacy-policy',
    )
    expect(screen.getByRole('link', { name: '隱私權' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: '條款' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/terms-of-use',
    )
  })
})

function NavigationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => void navigate(-1)} type="button">Go back</button>
      <span data-testid="route-path">{location.pathname}</span>
    </>
  )
}
