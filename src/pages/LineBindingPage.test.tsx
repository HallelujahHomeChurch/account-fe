import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import * as lineLinkIntent from '../lib/line-link-intent'
import { MockAccountApi } from '../lib/mock-account-api'
import {
  captureLineLinkFragment,
  clearLineLinkAutoContinue,
  discardCapturedLineLinkToken,
  getCapturedLineLinkToken,
  markLineLinkAutoContinue,
  navigateToLineAccountLink,
} from '../lib/line-link-intent'
import { LineBindingPage } from './LineBindingPage'

const viewNonce = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const lineConfirmationNonce = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const lineReturnUrl = `https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`

function renderPage(api: AuthApi, navigateAfterLogout?: (url: string) => void, strict = false) {
  document.cookie = 'hhc_locale=en; Path=/'
  const page = (
    <MemoryRouter initialEntries={['/line/bind']}>
      <LocaleProvider>
        <AuthProvider api={api} navigateAfterLogout={navigateAfterLogout}>
          <Routes>
            <Route element={<LineBindingPage />} path="/line/bind" />
            <Route element={<LocationPath />} path="/login" />
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{page}</StrictMode> : page)
}

function anonymousApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: async () => ({}),
    refreshAccessToken: async () => null,
    me: async () => ({ id: 'user-1', email: 'ray@example.com' }),
    logout: async () => ({}),
    getLineLinkIntent: async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-08-08T10:10:00Z',
    }),
    ...overrides,
  }
}

function signedInApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return anonymousApi({
    refreshAccessToken: async () => 'access-token',
    ...overrides,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/line/bind')
  sessionStorage.clear()
  discardCapturedLineLinkToken()
})

afterEach(() => {
  vi.restoreAllMocks()
  clearLineLinkAutoContinue()
  discardCapturedLineLinkToken()
})

describe('LineBindingPage', () => {
  it('removes the fragment before exchanging it and never stores the bearer', async () => {
    const exchangeLineLinkIntent = vi.fn(async () => {
      expect(window.location.hash).toBe('')
      return {
        line_account_name: 'HHC Official LINE',
        view_nonce: viewNonce,
        expires_at: '2026-08-08T10:10:00Z',
      }
    })
    window.history.replaceState({}, '', '/line/bind#token=fragment-bearer')
    captureLineLinkFragment()

    renderPage(anonymousApi({ exchangeLineLinkIntent }))

    expect(await screen.findByText('HHC Official LINE')).toBeInTheDocument()
    expect(exchangeLineLinkIntent).toHaveBeenCalledWith('fragment-bearer')
    expect(window.location.href).not.toContain('fragment-bearer')
    expect(JSON.stringify(sessionStorage)).not.toContain('fragment-bearer')
    expect(JSON.stringify(sessionStorage)).not.toContain(viewNonce)
    expect(window.location.href).not.toContain(viewNonce)
  })

  it('exchanges the fragment once under the production StrictMode lifecycle', async () => {
    const exchangeLineLinkIntent = vi.fn(async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-08-08T10:10:00Z',
    }))
    window.history.replaceState({}, '', '/line/bind#token=strict-bearer')
    captureLineLinkFragment()

    renderPage(anonymousApi({ exchangeLineLinkIntent }), undefined, true)

    expect(await screen.findByText('HHC Official LINE')).toBeInTheDocument()
    expect(exchangeLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('retries a transient exchange in the same page without storage leakage', async () => {
    const exchangeLineLinkIntent = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({
        line_account_name: 'HHC Official LINE',
        view_nonce: viewNonce,
        expires_at: '2026-08-08T10:10:00Z',
      })
    window.history.replaceState({}, '', '/line/bind#token=retry-bearer')
    captureLineLinkFragment()
    renderPage(anonymousApi({ exchangeLineLinkIntent }))

    expect(await screen.findByText('Unable to connect this account right now. Try again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('HHC Official LINE')).toBeInTheDocument()
    expect(exchangeLineLinkIntent).toHaveBeenCalledTimes(2)
    expect(window.location.href).not.toContain('retry-bearer')
    expect(JSON.stringify(sessionStorage)).not.toContain('retry-bearer')
  })

  it('discards a transient fragment bearer when the user cancels', async () => {
    const exchangeLineLinkIntent = vi.fn().mockRejectedValue(new ApiError(503, 'unavailable'))
    window.history.replaceState({}, '', '/line/bind#token=cancelled-bearer')
    captureLineLinkFragment()
    renderPage(anonymousApi({ exchangeLineLinkIntent }))

    expect(await screen.findByText('Unable to connect this account right now. Try again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(getCapturedLineLinkToken()).toBeNull()
  })

  it.each([
    new ApiError(410, 'expired', 'ACC_LINE_BINDING_INVALID'),
    new ApiError(409, 'conflict', 'ACC_LINE_IDENTITY_CONFLICT'),
  ])('discards a fragment bearer after a terminal exchange error', async (terminalError) => {
    window.history.replaceState({}, '', '/line/bind#token=terminal-bearer')
    captureLineLinkFragment()
    renderPage(anonymousApi({ exchangeLineLinkIntent: vi.fn().mockRejectedValue(terminalError) }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(getCapturedLineLinkToken()).toBeNull()
  })

  it('inspects the cookie-only intent after reload and asks an anonymous user to sign in', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-08-08T10:10:00Z',
    }))
    renderPage(anonymousApi({ getLineLinkIntent }))

    expect(await screen.findByText('HHC Official LINE')).toBeInTheDocument()
    expect(getLineLinkIntent).toHaveBeenCalledWith()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to continue' }))
    expect(await screen.findByTestId('location-path')).toHaveTextContent(
      '/login?return_to=%2Fline%2Fbind',
    )
    expect(sessionStorage).toHaveLength(1)
  })

  it('restores confirmation after an intentional sign-in return without preparing', async () => {
    markLineLinkAutoContinue()
    const prepareLineLinkIntent = vi.fn(async () => ({ return_url: lineReturnUrl }))
    renderPage(signedInApi({ prepareLineLinkIntent }), undefined, true)

    expect(await screen.findByText('ray@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm link' })).toBeInTheDocument()
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
    expect(sessionStorage).toHaveLength(0)
  })

  it('does not auto-prepare a new intent after an abandoned intent fails to load', async () => {
    markLineLinkAutoContinue()
    const failedView = renderPage(signedInApi({
      getLineLinkIntent: vi.fn().mockRejectedValue(new ApiError(503, 'unavailable')),
    }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect this account right now. Try again.',
    )
    failedView.unmount()

    const prepareLineLinkIntent = vi.fn(async () => ({ return_url: lineReturnUrl }))
    renderPage(signedInApi({ prepareLineLinkIntent }))

    expect(await screen.findByText('ray@example.com')).toBeInTheDocument()
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm link' })).toBeInTheDocument()
  })

  it('retries an explicit prepare failure without reloading the intent', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-08-08T10:10:00Z',
    }))
    const prepareLineLinkIntent = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({ return_url: 'https://evil.example/link' })
    renderPage(signedInApi({ getLineLinkIntent, prepareLineLinkIntent }))

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect this account right now. Try again.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The LINE connection response was invalid. Try again.',
    )
    expect(prepareLineLinkIntent).toHaveBeenCalledTimes(2)
    expect(getLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('does not navigate when prepare completes after Cancel unmounts the page', async () => {
    const pending = deferred<{ redirect_url: string }>()
    const navigateToLine = vi.spyOn(lineLinkIntent, 'navigateToLineAccountLink')
    renderPage(signedInApi({ prepareLineLinkIntent: () => pending.promise }))

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm link' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    pending.resolve({
      redirect_url: 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    })
    await Promise.resolve()

    expect(navigateToLine).not.toHaveBeenCalled()
  })

  it('does not navigate when prepare completes after a plain unmount', async () => {
    const pending = deferred<{ redirect_url: string }>()
    const navigateToLine = vi.spyOn(lineLinkIntent, 'navigateToLineAccountLink')
    const view = renderPage(signedInApi({ prepareLineLinkIntent: () => pending.promise }))

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm link' }))
    view.unmount()
    pending.resolve({
      redirect_url: 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    })
    await Promise.resolve()

    expect(navigateToLine).not.toHaveBeenCalled()
  })

  it('does not navigate when prepare completes after Switch account starts', async () => {
    const pending = deferred<{ redirect_url: string }>()
    const navigateToLine = vi.spyOn(lineLinkIntent, 'navigateToLineAccountLink')
    const navigateAfterLogout = vi.fn()
    renderPage(
      signedInApi({
        logout: async () => ({}),
        prepareLineLinkIntent: () => pending.promise,
      }),
      navigateAfterLogout,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm link' }))
    await userEvent.click(screen.getByRole('button', { name: 'Switch account' }))
    pending.resolve({
      redirect_url: 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    })
    await Promise.resolve()

    expect(navigateAfterLogout).toHaveBeenCalledTimes(1)
    expect(navigateToLine).not.toHaveBeenCalled()
  })

  it('does not clear local auth when a switch completes after unmount', async () => {
    const pending = deferred<{ message?: string }>()
    const navigateAfterLogout = vi.fn()
    const view = renderPage(
      signedInApi({ logout: () => pending.promise }),
      navigateAfterLogout,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))
    view.unmount()
    pending.resolve({})
    await Promise.resolve()

    expect(navigateAfterLogout).not.toHaveBeenCalled()
  })

  it('requires an already-authenticated user to explicitly continue', async () => {
    const prepareLineLinkIntent = vi.fn(async () => ({ return_url: lineReturnUrl }))
    const navigateToLine = vi.spyOn(lineLinkIntent, 'navigateToLineAccountLink').mockReturnValue(true)
    renderPage(signedInApi({ prepareLineLinkIntent }))

    expect(await screen.findByText('ray@example.com')).toBeInTheDocument()
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm link' }))
    expect(prepareLineLinkIntent).toHaveBeenCalledWith(viewNonce)
    expect(navigateToLine).toHaveBeenCalledWith(lineReturnUrl)
    expect(navigateToLine.mock.calls[0]?.[0]).toContain(lineConfirmationNonce)
    expect(navigateToLine.mock.calls[0]?.[0]).not.toContain(viewNonce)
    expect(await screen.findByText(
      'Your HHC account is confirmed. Return to LINE and send the prefilled message to finish connecting.',
    )).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to LINE to finish' })).toBeInTheDocument()
  })

  it('keeps the mock LINE confirmation challenge separate from the browser view challenge', async () => {
    const api = new MockAccountApi()
    const summary = await api.getLineLinkIntent()

    expect(summary.view_nonce).toBe(viewNonce)
    await expect(api.prepareLineLinkIntent(summary.view_nonce)).resolves.toEqual({
      return_url: lineReturnUrl,
    })
    expect(lineReturnUrl).toContain(lineConfirmationNonce)
    expect(lineReturnUrl).not.toContain(viewNonce)
  })

  it('ends only the current server session before switching accounts', async () => {
    const logout = vi.fn(async () => ({}))
    const logoutAll = vi.fn(async () => undefined)
    const navigateAfterLogout = vi.fn()
    renderPage(signedInApi({ logout, logoutAll }), navigateAfterLogout)

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))

    expect(logout).toHaveBeenCalledTimes(1)
    expect(logoutAll).not.toHaveBeenCalled()
    expect(navigateAfterLogout).toHaveBeenCalledWith('/login?return_to=%2Fline%2Fbind')
    expect(sessionStorage).toHaveLength(1)
  })

  it('retries a failed account switch without reloading the intent', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      line_account_name: 'HHC Official LINE',
      view_nonce: viewNonce,
      expires_at: '2026-08-08T10:10:00Z',
    }))
    const logout = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({})
    const navigateAfterLogout = vi.fn()
    renderPage(signedInApi({ getLineLinkIntent, logout }), navigateAfterLogout)

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect this account right now. Try again.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(logout).toHaveBeenCalledTimes(2)
    expect(navigateAfterLogout).toHaveBeenCalledTimes(1)
    expect(getLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('recovers an unavailable auth check without reloading the LINE intent', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      profile_name: 'main',
      expires_at: '2026-08-08T10:10:00Z',
    }))
    const refreshAccessToken = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(null)
    renderPage(anonymousApi({ getLineLinkIntent, refreshAccessToken }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to check your sign-in status.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Check sign-in again' }))

    expect(await screen.findByRole('button', { name: 'Sign in to continue' })).toBeInTheDocument()
    expect(refreshAccessToken).toHaveBeenCalledTimes(2)
    expect(getLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('shows expired, conflict, and unavailable states with retry actions', async () => {
    const cases = [
      [new ApiError(410, 'expired', 'ACC_LINE_BINDING_INVALID'), 'This link has expired.'],
      [new ApiError(409, 'conflict', 'ACC_LINE_IDENTITY_CONFLICT'), 'This LINE account is already connected to another HHC account.'],
      [new ApiError(503, 'unavailable'), 'Unable to connect this account right now. Try again.'],
    ] as const

    for (const [error, label] of cases) {
      const view = renderPage(anonymousApi({ getLineLinkIntent: vi.fn().mockRejectedValue(error) }))
      expect(await screen.findByText(label)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      view.unmount()
    }
  })

  it('does not expose legacy profile names while retaining the rollback path', async () => {
    const prepareLineLinkIntent = vi.fn(async () => ({
      redirect_url: 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    }))
    const navigateToLine = vi.spyOn(lineLinkIntent, 'navigateToLineAccountLink').mockReturnValue(true)
    renderPage(signedInApi({
      getLineLinkIntent: async () => ({
        profile_name: 'helper',
        expires_at: '2026-08-08T10:10:00Z',
      }),
      prepareLineLinkIntent,
    }))

    expect(await screen.findByText('LINE official account')).toBeInTheDocument()
    expect(screen.queryByText('helper')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm link' }))

    expect(prepareLineLinkIntent).toHaveBeenCalledWith(undefined)
    expect(navigateToLine).toHaveBeenCalledTimes(1)
  })
})

describe('native LINE redirect validation', () => {
  it('replaces the document only for the canonical return-to-LINE URL', () => {
    const replace = vi.fn()

    expect(navigateToLineAccountLink(lineReturnUrl, replace)).toBe(true)
    expect(replace).toHaveBeenCalledWith(lineReturnUrl)
  })

  it('retains the canonical legacy accountLink rollback URL', () => {
    const replace = vi.fn()
    const legacyUrl = 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce'

    expect(navigateToLineAccountLink(legacyUrl, replace)).toBe(true)
    expect(replace).toHaveBeenCalledWith(legacyUrl)
  })

  it.each([
    `http://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `https://evil.example/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `https://user@line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `https://line.me:444/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `https://line.me/R/oaMessage/%40hhc_official/../attacker/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}#fragment`,
    `https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}&redirect=https%3A%2F%2Fevil.example`,
    `https://line.me/R/oaMessage/@hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    `${lineReturnUrl}\n`,
    `https://LINE.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3A${lineConfirmationNonce}`,
    'https://line.me/R/oaMessage/%40hhc_official/?HHC_ACCOUNT_LINK_V1%3Ashort',
    'https://access.line.me:443/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce&redirect=evil',
  ])('rejects malformed or malicious redirects: %s', (url) => {
    const replace = vi.fn()
    expect(navigateToLineAccountLink(url, replace)).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })
})

function LocationPath() {
  const location = useLocation()
  return <span data-testid="location-path">{location.pathname}{location.search}</span>
}
