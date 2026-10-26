import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth, type AuthApi } from './auth-context'
import { LoginPage } from '../pages/LoginPage'
import { LocaleProvider } from '../i18n/locale-context'
import { PolicyAcceptancePage } from '../pages/PolicyAcceptancePage'
import { OAuthOnboardingPage } from '../pages/OAuthOnboardingPage'
import { ApiError, type LoginResponse } from '../lib/api'
import { createOAuthTransaction } from '@hallelujahhomechurch/account-client'
import { saveAccountOAuthTransaction } from '../lib/redirects'
import { OAuthCallbackPage } from '../pages/OAuthCallbackPage'
import { StrictMode } from 'react'

afterEach(() => { vi.unstubAllGlobals() })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup(api: AuthApi, navigateExternal = vi.fn()) {
  let auth!: ReturnType<typeof useAuth>
  function Probe() { auth = useAuth(); return null }
  render(<AuthProvider api={api} navigateExternal={navigateExternal} navigateAfterLogout={vi.fn()} restoreSession={false}><Probe /></AuthProvider>)
  return () => auth
}

function apiWith(login: AuthApi['login']): AuthApi {
  return { login, me: vi.fn(async () => ({ id: 'u1', email: 'fixture@example.invalid' })), refreshAccessToken: async () => null, logout: async () => ({}) }
}

it('ignores an abandoned LoginPage response after navigating away and completing a newer login', async () => {
  const first = deferred<LoginResponse>()
  let calls = 0
  const api = apiWith(async () => ++calls === 1 ? first.promise : { access_token: 'newer-token' })
  function Profile() { return <span data-testid="token">{useAuth().accessToken}</span> }
  render(<MemoryRouter initialEntries={['/login']}><LocaleProvider><AuthProvider api={api} restoreSession={false}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<Link to="/login">Back to login</Link>} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  </AuthProvider></LocaleProvider></MemoryRouter>)
  async function submit(email: string) {
    await userEvent.type(screen.getByLabelText('Email'), email)
    await userEvent.type(screen.getByLabelText('Password'), 'fixture-password')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
  }
  await submit('older@example.invalid')
  await userEvent.click(screen.getByRole('link', { name: 'Forgot password' }))
  await userEvent.click(screen.getByRole('link', { name: 'Back to login' }))
  await submit('newer@example.invalid')
  expect(await screen.findByTestId('token')).toHaveTextContent('newer-token')
  await act(async () => { first.resolve({ access_token: 'older-token' }) })
  expect(screen.getByTestId('token')).toHaveTextContent('newer-token')
  expect(api.me).toHaveBeenCalledTimes(1)
})

it.each<LoginResponse>([
  { access_token: 'older-token' },
  { mfa_type: 'verification_required', mfa_token: 'old-mfa' },
  { policy_acceptance_required: true, policy_token: 'old-policy' },
  { redirect_type: 'oauth', redirect_uri: 'hhc-presenter://auth/account', code: 'old-code', state: 'old-state' },
])('does not apply an older authentication result: %j', async response => {
  const first = deferred<LoginResponse>()
  let calls = 0
  const api = apiWith(async () => ++calls === 1 ? first.promise : { access_token: 'newer-token' })
  const navigate = vi.fn()
  const auth = setup(api, navigate)
  let older!: Promise<LoginResponse>
  act(() => { older = auth().login({ email: 'old', password: 'fixture' }) })
  const rejection = expect(older).rejects.toMatchObject({ name: 'AbortError' })
  await act(async () => { await auth().login({ email: 'new', password: 'fixture' }) })
  await act(async () => { first.resolve(response); await rejection })
  expect(auth().accessToken).toBe('newer-token')
  expect(auth().status).toBe('authenticated')
  expect(auth().mfaChallenge).toBeNull()
  expect(navigate).not.toHaveBeenCalled()
  expect(api.me).toHaveBeenCalledTimes(1)
})

it('does not reauthenticate after logout completes while password login is pending', async () => {
  const first = deferred<LoginResponse>()
  const auth = setup(apiWith(() => first.promise))
  let pending!: Promise<LoginResponse>
  act(() => { pending = auth().login({ email: 'old', password: 'fixture' }) })
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await act(async () => { await auth().logout() })
  await act(async () => { first.resolve({ access_token: 'old-token' }); await rejection })
  expect(auth().status).toBe('anonymous')
  expect(auth().accessToken).toBeNull()
})

it('does not clear a newer login when a stale MFA request reports an expired code', async () => {
  const first = deferred<LoginResponse>()
  let calls = 0
  const api = apiWith(async () => ++calls === 1 ? { mfa_type: 'verification_required', mfa_token: 'old-mfa' } : { access_token: 'newer-token' })
  api.verifyMfa = () => first.promise
  const auth = setup(api)
  await act(async () => { await auth().login({ email: 'old', password: 'fixture' }) })
  let pending!: Promise<LoginResponse>
  act(() => { pending = auth().verifyMfa('123456') })
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await act(async () => { await auth().login({ email: 'new', password: 'fixture' }) })
  await act(async () => { first.reject(new ApiError(401, 'expired', 'ACC_MFA_CODE_EXPIRED')); await rejection })
  expect(auth().status).toBe('authenticated')
  expect(auth().accessToken).toBe('newer-token')
})

it('captures direct completion intent before its request and does not start an already abandoned request', async () => {
  const first = deferred<LoginResponse>()
  const auth = setup(apiWith(async () => ({})))
  let pending!: Promise<LoginResponse>
  act(() => { pending = auth().completeLogin(() => first.promise) })
  const controller = new AbortController()
  controller.abort()
  const abandoned = vi.fn(async () => ({ access_token: 'abandoned-token' }))
  await expect(auth().completeLogin(abandoned, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  await act(async () => { first.resolve({ access_token: 'current-token' }); await pending })
  expect(abandoned).not.toHaveBeenCalled()
  expect(auth().accessToken).toBe('current-token')
})


it.each([
  ['policy', PolicyAcceptancePage],
  ['onboarding', OAuthOnboardingPage],
] as const)('does not complete %s authentication after its page is left', async (route, Page) => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', `/${route}#token=pending-token`)
  const response = deferred<LoginResponse>()
  const api = apiWith(async () => ({}))
  api.confirmPolicyAcceptance = () => response.promise
  api.completeOAuthOnboarding = () => response.promise
  api.getAuthCapabilities = async () => ({ providers: [], registrationEnabled: false, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } })
  api.getOAuthOnboardingStatus = async () => ({ provider: 'google', masked_email: 'f***@example.invalid', email_verification_required: false, link_confirmation_required: false })
  function Token() { return <span data-testid="token">{useAuth().accessToken}</span> }
  render(<MemoryRouter initialEntries={[`/${route}`]}><LocaleProvider><AuthProvider api={api} restoreSession={false}>
    <Token /><Link to="/elsewhere">Leave</Link><Routes>
      <Route path={`/${route}`} element={<Page />} />
      <Route path="/elsewhere" element={<h1>Elsewhere</h1>} />
      <Route path="/profile" element={<h1>Unexpected profile</h1>} />
    </Routes>
  </AuthProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await userEvent.click(screen.getByRole('link', { name: 'Leave' }))
  await act(async () => { response.resolve({ access_token: 'abandoned-token' }) })
  expect(screen.getByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument()
  expect(screen.getByTestId('token')).toBeEmptyDOMElement()
  expect(api.me).not.toHaveBeenCalled()
})


it('does not let an older profile lookup clear a newer attempt’s staged credential', async () => {
  const firstMe = deferred<Response>()
  const secondMe = deferred<Response>()
  const authorizations: Array<string | null> = []
  let logins = 0
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const path = String(url)
    if (path.endsWith('/csrf-token')) return Response.json({ csrf_token: 'fixture-csrf' })
    if (path.endsWith('/login')) return Response.json({ access_token: ++logins === 1 ? 'older-token' : 'newer-token' })
    if (path.endsWith('/me')) {
      authorizations.push(new Headers(options?.headers).get('authorization'))
      if (authorizations.length === 1) return firstMe.promise
      if (authorizations.length === 2) return secondMe.promise
      return Response.json({ id: 'u2', email: 'new@example.invalid' })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  })
  vi.stubGlobal('fetch', fetcher)
  let auth!: ReturnType<typeof useAuth>
  function Probe() { auth = useAuth(); return null }
  render(<AuthProvider restoreSession={false}><Probe /></AuthProvider>)
  let older!: Promise<LoginResponse>
  let newer!: Promise<LoginResponse>
  act(() => { older = auth.login({ email: 'old', password: 'fixture' }) })
  const rejection = expect(older).rejects.toMatchObject({ name: 'AbortError' })
  await waitFor(() => expect(authorizations).toHaveLength(1))
  act(() => { newer = auth.login({ email: 'new', password: 'fixture' }) })
  await waitFor(() => expect(authorizations).toHaveLength(2))
  await act(async () => { firstMe.resolve(Response.json({ id: 'u1', email: 'old@example.invalid' })); await rejection })
  await auth.api.me()
  expect(authorizations).toEqual(['Bearer older-token', 'Bearer newer-token', 'Bearer newer-token'])
  await act(async () => { secondMe.resolve(Response.json({ id: 'u2', email: 'new@example.invalid' })); await newer })
  expect(auth.accessToken).toBe('newer-token')
  expect(auth.profile?.id).toBe('u2')
})

it('does not install or return a stale OAuth callback after a newer login', async () => {
  const transaction = await createOAuthTransaction('/security', { randomBytes: () => new Uint8Array(32).fill(17) })
  saveAccountOAuthTransaction(transaction)
  const response = deferred<{ access_token: string }>()
  const api = apiWith(async () => ({ access_token: 'newer-token' }))
  api.exchangeCode = () => response.promise
  const auth = setup(api)
  let pending!: Promise<string>
  act(() => { pending = auth().completeOAuthCallback('old-code', transaction.state) })
  const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await act(async () => { await auth().login({ email: 'new', password: 'fixture' }) })
  await act(async () => { response.resolve({ access_token: 'old-token' }); await rejection })
  expect(auth().accessToken).toBe('newer-token')
  expect(api.me).toHaveBeenCalledTimes(1)
})

it.each([false, true])('does not install or navigate an abandoned OAuth callback (StrictMode=%s)', async strict => {
  const transaction = await createOAuthTransaction('/profile', { randomBytes: () => new Uint8Array(32).fill(19) })
  saveAccountOAuthTransaction(transaction)
  const response = deferred<{ access_token: string }>()
  const api = apiWith(async () => ({}))
  api.exchangeCode = vi.fn(() => response.promise)
  function Token() { return <span data-testid="token">{useAuth().accessToken}</span> }
  const tree = <MemoryRouter initialEntries={[`/oauth/callback?code=old-code&state=${transaction.state}`]}><LocaleProvider><AuthProvider api={api} restoreSession={false}>
    <Token /><Link to="/elsewhere">Leave</Link><Routes>
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/elsewhere" element={<h1>Elsewhere</h1>} />
      <Route path="/profile" element={<h1>Unexpected profile</h1>} />
    </Routes>
  </AuthProvider></LocaleProvider></MemoryRouter>
  render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  await userEvent.click(screen.getByRole('link', { name: 'Leave' }))
  await act(async () => { response.resolve({ access_token: 'abandoned-token' }) })
  expect(screen.getByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument()
  expect(screen.getByTestId('token')).toBeEmptyDOMElement()
  expect(api.exchangeCode).toHaveBeenCalledTimes(1)
  expect(api.me).not.toHaveBeenCalled()
})
