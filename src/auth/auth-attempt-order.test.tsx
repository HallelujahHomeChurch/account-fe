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

it.each(['access-token', 'profile'] as const)('does not let an obsolete %s bootstrap clear a newer staged login token', async phase => {
  document.cookie = 'hhc_sso_hint=; Max-Age=0; Path=/'
  const bootstrapToken = deferred<Response>()
  const bootstrapProfile = deferred<Response>()
  const newerProfile = deferred<Response>()
  const authorizations: Array<string | null> = []
  let tokenRequested = false
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = String(input)
    if (path.endsWith('/session')) return Response.json({ authenticated: true, user: { id: 'u1', email: 'fixture@example.invalid', display_name: 'Fixture', avatar_url: null }, permissions: [], permission_availability: { status: 'available' } })
    if (path.endsWith('/csrf-token')) return Response.json({ csrf_token: 'fixture-csrf' })
    if (path.endsWith('/session/access-token')) {
      tokenRequested = true
      return phase === 'access-token' ? bootstrapToken.promise : Response.json({ access_token: 'bootstrap-token', expires_in: 900 })
    }
    if (path.endsWith('/login')) return Response.json({ access_token: 'newer-token' })
    if (path.endsWith('/me')) {
      const token = new Headers(options?.headers).get('authorization')
      authorizations.push(token)
      if (token === 'Bearer bootstrap-token') return bootstrapProfile.promise
      if (authorizations.length === (phase === 'profile' ? 2 : 1)) return newerProfile.promise
      return Response.json({ id: 'u2', email: 'new@example.invalid' })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }))
  let auth!: ReturnType<typeof useAuth>
  function Probe() { auth = useAuth(); return null }
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(phase === 'profile' ? authorizations.length === 1 : tokenRequested).toBe(true))
  let login!: Promise<LoginResponse>
  act(() => { login = auth.login({ email: 'new@example.invalid', password: 'fixture' }) })
  await waitFor(() => expect(authorizations.at(-1)).toBe('Bearer newer-token'))
  await act(async () => {
    if (phase === 'profile') bootstrapProfile.resolve(Response.json({ id: 'u1', email: 'fixture@example.invalid' }))
    else bootstrapToken.resolve(Response.json({ access_token: 'bootstrap-token', expires_in: 900 }))
  })
  await auth.api.me()
  await act(async () => { newerProfile.resolve(Response.json({ id: 'u2', email: 'new@example.invalid' })); await login })
  expect(authorizations).toEqual(phase === 'profile'
    ? ['Bearer bootstrap-token', 'Bearer newer-token', 'Bearer newer-token']
    : ['Bearer newer-token', 'Bearer newer-token'])
  expect(auth.accessToken).toBe('newer-token')
  expect(auth.profile?.id).toBe('u2')
})

it('does not let an obsolete revalidation profile clear a newer staged credential', async () => {
  document.cookie = 'hhc_sso_hint=; Max-Age=0; Path=/'
  const revalidationProfile = deferred<{ id: string; email: string }>()
  const newerProfile = deferred<{ id: string; email: string }>()
  const authorizations: Array<string | null> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const request = new Request(input, options)
    expect(new URL(request.url).pathname).toBe('/api/operations/me/resources')
    authorizations.push(request.headers.get('authorization'))
    return Response.json([])
  }))
  let profileRequests = 0
  const api = apiWith(async () => ({ access_token: 'newer-token' }))
  api.getSession = async () => ({ authenticated: true, user: { id: 'u1', email: 'fixture@example.invalid', display_name: 'Fixture', avatar_url: null }, permissions: [], permission_availability: { status: 'available' } })
  api.issueAccessToken = async () => 'bootstrap-token'
  api.refreshAccessToken = async () => 'revalidated-token'
  api.me = vi.fn(async () => {
    switch (++profileRequests) {
      case 1: return { id: 'u1', email: 'fixture@example.invalid' }
      case 2: throw new ApiError(401, 'expired access token')
      case 3: return revalidationProfile.promise
      case 4: return newerProfile.promise
      default: throw new Error('Unexpected fixture profile request')
    }
  })
  let auth!: ReturnType<typeof useAuth>
  function Probe() { auth = useAuth(); return null }
  render(<AuthProvider api={api}><Probe /></AuthProvider>)
  await waitFor(() => expect(auth.status).toBe('authenticated'))
  let revalidation!: Promise<void>
  act(() => { revalidation = auth.retrySession() })
  await waitFor(() => expect(profileRequests).toBe(3))
  let login!: Promise<LoginResponse>
  act(() => { login = auth.login({ email: 'new@example.invalid', password: 'fixture' }) })
  await waitFor(() => expect(profileRequests).toBe(4))
  await act(async () => { revalidationProfile.resolve({ id: 'u1', email: 'fixture@example.invalid' }); await revalidation })
  await auth.operationsApi.listMyResources()
  await act(async () => { newerProfile.resolve({ id: 'u2', email: 'new@example.invalid' }); await login })
  expect(authorizations).toEqual(['Bearer newer-token'])
  expect(auth.accessToken).toBe('newer-token')
  expect(auth.profile?.id).toBe('u2')
})

it.each(['login', 'local-clear'] as const)('does not install or replay an Operations refresh after a newer %s intent', async intent => {
  const refresh = deferred<string | null>()
  const authorizations: Array<string | null> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const request = new Request(input, options)
    authorizations.push(request.headers.get('authorization'))
    return authorizations.length === 1 ? Response.json({ error_code: 'unauthorized' }, { status: 401 }) : Response.json([])
  }))
  let logins = 0
  const api = apiWith(async () => ({ access_token: ++logins === 1 ? 'initial-token' : 'newer-token' }))
  api.refreshAccessToken = vi.fn(() => refresh.promise)
  const auth = setup(api)
  await act(async () => { await auth().login({ email: 'initial', password: 'fixture' }) })
  const request = auth().operationsApi.listMyResources()
  const outcome = request.then(() => 'replayed', () => 'rejected')
  await waitFor(() => expect(api.refreshAccessToken).toHaveBeenCalledOnce())
  await act(async () => {
    if (intent === 'login') await auth().login({ email: 'newer', password: 'fixture' })
    else auth().clearLocalSession()
  })
  await act(async () => { refresh.resolve('obsolete-refresh-token'); await outcome })
  await auth().operationsApi.listMyResources()
  expect(authorizations).toEqual(['Bearer initial-token', intent === 'login' ? 'Bearer newer-token' : null])
  expect(await outcome).toBe('rejected')
  expect(auth().accessToken).toBe(intent === 'login' ? 'newer-token' : null)
})

it('retains the AccountApi current-token fence when an older refresh finishes after a newer login', async () => {
  const refresh = deferred<Response>()
  const authorizations: Array<string | null> = []
  let logins = 0
  let refreshRequested = false
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = String(input)
    if (path.endsWith('/csrf-token')) return Response.json({ csrf_token: 'fixture-csrf' })
    if (path.endsWith('/login')) return Response.json({ access_token: ++logins === 1 ? 'initial-token' : 'newer-token' })
    if (path.endsWith('/refresh')) { refreshRequested = true; return refresh.promise }
    if (path.endsWith('/me')) {
      authorizations.push(new Headers(options?.headers).get('authorization'))
      return authorizations.length === 2 ? Response.json({ error_code: 'unauthorized' }, { status: 401 }) : Response.json({ id: 'u1', email: 'fixture@example.invalid' })
    }
    throw new Error(`Unexpected fixture request: ${path}`)
  }))
  let auth!: ReturnType<typeof useAuth>
  function Probe() { auth = useAuth(); return null }
  render(<AuthProvider restoreSession={false}><Probe /></AuthProvider>)
  await act(async () => { await auth.login({ email: 'initial', password: 'fixture' }) })
  const request = auth.api.me()
  const outcome = request.then(() => 'replayed', () => 'rejected')
  await waitFor(() => expect(refreshRequested).toBe(true))
  await act(async () => { await auth.login({ email: 'newer', password: 'fixture' }) })
  await act(async () => { refresh.resolve(Response.json({ access_token: 'obsolete-refresh-token', expires_in: 900 })); await outcome })
  await auth.api.me()
  expect(authorizations).toEqual(['Bearer initial-token', 'Bearer initial-token', 'Bearer newer-token', 'Bearer newer-token'])
  expect(await outcome).toBe('rejected')
  expect(auth.accessToken).toBe('newer-token')
})

it.each(['login', 'local-clear'] as const)('does not refresh or replay a late Operations 401 after a newer %s intent', async intent => {
  const response = deferred<Response>()
  const authorizations: Array<string | null> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const request = new Request(input, options)
    authorizations.push(request.headers.get('authorization'))
    return authorizations.length === 1 ? response.promise : Response.json([])
  }))
  let logins = 0
  const api = apiWith(async () => ({ access_token: ++logins === 1 ? 'initial-token' : 'newer-token' }))
  api.refreshAccessToken = vi.fn(async () => 'obsolete-refresh-token')
  const auth = setup(api)
  await act(async () => { await auth().login({ email: 'initial', password: 'fixture' }) })
  const request = auth().operationsApi.listMyResources()
  const outcome = request.then(() => 'replayed', () => 'rejected')
  await waitFor(() => expect(authorizations).toHaveLength(1))
  await act(async () => {
    if (intent === 'login') await auth().login({ email: 'newer', password: 'fixture' })
    else auth().clearLocalSession()
  })
  await act(async () => { response.resolve(Response.json({ error_code: 'unauthorized' }, { status: 401 })); await outcome })
  await auth().operationsApi.listMyResources()
  expect(authorizations).toEqual(['Bearer initial-token', intent === 'login' ? 'Bearer newer-token' : null])
  expect(api.refreshAccessToken).not.toHaveBeenCalled()
  expect(await outcome).toBe('rejected')
})

it('retains normal Operations 401 refresh and retry for the current credential', async () => {
  const authorizations: Array<string | null> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const request = new Request(input, options)
    authorizations.push(request.headers.get('authorization'))
    return authorizations.length === 1 ? Response.json({ error_code: 'unauthorized' }, { status: 401 }) : Response.json([])
  }))
  const api = apiWith(async () => ({ access_token: 'initial-token' }))
  api.refreshAccessToken = vi.fn(async () => 'refreshed-token')
  const auth = setup(api)
  await act(async () => { await auth().login({ email: 'initial', password: 'fixture' }) })
  await expect(auth().operationsApi.listMyResources()).resolves.toEqual([])
  await auth().operationsApi.listMyResources()
  expect(authorizations).toEqual(['Bearer initial-token', 'Bearer refreshed-token', 'Bearer refreshed-token'])
  expect(api.refreshAccessToken).toHaveBeenCalledOnce()
})
