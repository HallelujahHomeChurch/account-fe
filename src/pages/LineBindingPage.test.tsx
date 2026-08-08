import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import * as lineLinkIntent from '../lib/line-link-intent'
import {
  captureLineLinkFragment,
  clearLineLinkAutoContinue,
  discardCapturedLineLinkToken,
  getCapturedLineLinkToken,
  markLineLinkAutoContinue,
  navigateToLineAccountLink,
} from '../lib/line-link-intent'
import { LineBindingPage } from './LineBindingPage'

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
      profile_name: 'main',
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
      return { profile_name: 'main', expires_at: '2026-08-08T10:10:00Z' }
    })
    window.history.replaceState({}, '', '/line/bind#token=fragment-bearer')
    captureLineLinkFragment()

    renderPage(anonymousApi({ exchangeLineLinkIntent }))

    expect(await screen.findByText('main')).toBeInTheDocument()
    expect(exchangeLineLinkIntent).toHaveBeenCalledWith('fragment-bearer')
    expect(window.location.href).not.toContain('fragment-bearer')
    expect(JSON.stringify(sessionStorage)).not.toContain('fragment-bearer')
  })

  it('exchanges the fragment once under the production StrictMode lifecycle', async () => {
    const exchangeLineLinkIntent = vi.fn(async () => ({
      profile_name: 'main',
      expires_at: '2026-08-08T10:10:00Z',
    }))
    window.history.replaceState({}, '', '/line/bind#token=strict-bearer')
    captureLineLinkFragment()

    renderPage(anonymousApi({ exchangeLineLinkIntent }), undefined, true)

    expect(await screen.findByText('main')).toBeInTheDocument()
    expect(exchangeLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('retries a transient exchange in the same page without storage leakage', async () => {
    const exchangeLineLinkIntent = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({ profile_name: 'main', expires_at: '2026-08-08T10:10:00Z' })
    window.history.replaceState({}, '', '/line/bind#token=retry-bearer')
    captureLineLinkFragment()
    renderPage(anonymousApi({ exchangeLineLinkIntent }))

    expect(await screen.findByText('Unable to connect this account right now. Try again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('main')).toBeInTheDocument()
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
      profile_name: 'main',
      expires_at: '2026-08-08T10:10:00Z',
    }))
    renderPage(anonymousApi({ getLineLinkIntent }))

    expect(await screen.findByText('main')).toBeInTheDocument()
    expect(getLineLinkIntent).toHaveBeenCalledWith()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to continue' }))
    expect(await screen.findByTestId('location-path')).toHaveTextContent(
      '/login?return_to=%2Fline%2Fbind',
    )
    expect(sessionStorage).toHaveLength(1)
  })

  it('auto-prepares exactly once after an intentional sign-in return', async () => {
    markLineLinkAutoContinue()
    const prepareLineLinkIntent = vi.fn(async () => ({ redirect_url: 'https://evil.example/link' }))
    renderPage(signedInApi({ prepareLineLinkIntent }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The LINE connection response was invalid. Try again.',
    )
    expect(prepareLineLinkIntent).toHaveBeenCalledTimes(1)
    expect(sessionStorage).toHaveLength(0)
  })

  it('retries an auto-prepare failure without reloading the intent', async () => {
    markLineLinkAutoContinue()
    const getLineLinkIntent = vi.fn(async () => ({
      profile_name: 'main',
      expires_at: '2026-08-08T10:10:00Z',
    }))
    const prepareLineLinkIntent = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({ redirect_url: 'https://evil.example/link' })
    renderPage(signedInApi({ getLineLinkIntent, prepareLineLinkIntent }))

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

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
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

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
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
        logoutAll: async () => undefined,
        prepareLineLinkIntent: () => pending.promise,
      }),
      navigateAfterLogout,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Switch account' }))
    pending.resolve({
      redirect_url: 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    })
    await Promise.resolve()

    expect(navigateAfterLogout).toHaveBeenCalledTimes(1)
    expect(navigateToLine).not.toHaveBeenCalled()
  })

  it('does not clear local auth when a switch completes after unmount', async () => {
    const pending = deferred<void>()
    const navigateAfterLogout = vi.fn()
    const view = renderPage(
      signedInApi({ logoutAll: () => pending.promise }),
      navigateAfterLogout,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))
    view.unmount()
    pending.resolve()
    await Promise.resolve()

    expect(navigateAfterLogout).not.toHaveBeenCalled()
  })

  it('requires an already-authenticated user to explicitly continue', async () => {
    const prepareLineLinkIntent = vi.fn(async () => ({ redirect_url: 'https://evil.example/link' }))
    renderPage(signedInApi({ prepareLineLinkIntent }))

    expect(await screen.findByText('ray@example.com')).toBeInTheDocument()
    expect(prepareLineLinkIntent).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(prepareLineLinkIntent).toHaveBeenCalledTimes(1)
  })

  it('ends the current server session before switching accounts', async () => {
    const logoutAll = vi.fn(async () => undefined)
    const navigateAfterLogout = vi.fn()
    renderPage(signedInApi({ logoutAll }), navigateAfterLogout)

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))

    expect(logoutAll).toHaveBeenCalledTimes(1)
    expect(navigateAfterLogout).toHaveBeenCalledWith('/login?return_to=%2Fline%2Fbind')
    expect(sessionStorage).toHaveLength(1)
  })

  it('retries a failed account switch without reloading the intent', async () => {
    const getLineLinkIntent = vi.fn(async () => ({
      profile_name: 'main',
      expires_at: '2026-08-08T10:10:00Z',
    }))
    const logoutAll = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined)
    const navigateAfterLogout = vi.fn()
    renderPage(signedInApi({ getLineLinkIntent, logoutAll }), navigateAfterLogout)

    await userEvent.click(await screen.findByRole('button', { name: 'Switch account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect this account right now. Try again.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(logoutAll).toHaveBeenCalledTimes(2)
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
})

describe('native LINE redirect validation', () => {
  it('replaces the document only for the canonical accountLink URL', () => {
    const replace = vi.fn()
    const url = 'https://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce'

    expect(navigateToLineAccountLink(url, replace)).toBe(true)
    expect(replace).toHaveBeenCalledWith(url)
  })

  it.each([
    'http://access.line.me/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    'https://evil.example/dialog/bot/accountLink?linkToken=token&nonce=nonce',
    'https://access.line.me/dialog/bot/accountLink?linkToken=token',
    'https://access.line.me/dialog/bot/accountLink?nonce=nonce',
    'https://access.line.me/dialog/bot/accountLink?linkToken=one&linkToken=two&nonce=nonce',
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
