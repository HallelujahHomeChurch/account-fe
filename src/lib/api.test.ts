import { describe, expect, it } from 'vitest'

import { AccountApi } from './api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AccountApi', () => {
  it('binds the default fetcher to globalThis', async () => {
    const originalFetch = globalThis.fetch
    const receivers: unknown[] = []

    globalThis.fetch = async function (this: unknown, input: RequestInfo | URL) {
      receivers.push(this)
      const url = String(input)

      if (url.endsWith('/csrf-token')) {
        return jsonResponse({ csrf_token: 'csrf-123' })
      }

      return jsonResponse({ access_token: 'access-123' })
    } as typeof fetch

    try {
      const api = new AccountApi({ baseUrl: '/api/account/v1' })
      await api.login({ email: 'admin@example.com', password: 'secret123' })
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(receivers).toEqual([globalThis, globalThis])
  })

  it('attaches CSRF token on mutations', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input, init) => {
        calls.push({ input, init })
        const url = String(input)

        if (url.endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }

        return jsonResponse({ access_token: 'access-123' })
      },
    })

    await api.login({ email: 'admin@example.com', password: 'secret123' })

    expect(String(calls[0].input)).toBe('/api/account/v1/csrf-token')
    expect(String(calls[1].input)).toBe('/api/account/v1/login')
    expect(calls[1].init?.credentials).toBe('include')
    expect(calls[1].init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-csrf-token': 'csrf-123',
    })
  })

  it('refreshes once after a 401 and retries with the new access token', async () => {
    const seenAuth: Array<string | null> = []
    let accessToken = 'old-token'
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      getAccessToken: () => accessToken,
      setAccessToken: (next) => {
        accessToken = next ?? ''
      },
      fetcher: async (input, init) => {
        const url = String(input)

        if (url.endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }

        if (url.endsWith('/refresh')) {
          return jsonResponse({ access_token: 'new-token' })
        }

        seenAuth.push(new Headers(init?.headers).get('authorization'))
        if (seenAuth.length === 1) {
          return jsonResponse({ message: 'expired' }, 401)
        }

        return jsonResponse({ id: 'u1', email: 'admin@example.com' })
      },
    })

    await expect(api.me()).resolves.toMatchObject({ id: 'u1', email: 'admin@example.com' })
    expect(seenAuth).toEqual(['Bearer old-token', 'Bearer new-token'])
    expect(accessToken).toBe('new-token')
  })

  it('coalesces concurrent refresh token requests across clients with the same base URL', async () => {
    let csrfCalls = 0
    let refreshCalls = 0
    const tokens: Array<string | null> = []
    let releaseCsrf!: (response: Response) => void
    let releaseRefresh!: (response: Response) => void
    const csrfResponse = new Promise<Response>((resolve) => {
      releaseCsrf = resolve
    })
    const refreshResponse = new Promise<Response>((resolve) => {
      releaseRefresh = resolve
    })
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/csrf-token')) {
        csrfCalls += 1
        return csrfResponse
      }
      if (url.endsWith('/refresh')) {
        refreshCalls += 1
        return refreshResponse
      }
      return jsonResponse({ message: 'ok' })
    }
    const first = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher,
      setAccessToken: (token) => tokens.push(token),
    })
    const second = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher,
      setAccessToken: (token) => tokens.push(token),
    })

    const firstRequest = first.refreshAccessToken()
    const secondRequest = second.refreshAccessToken()

    expect(csrfCalls).toBe(1)
    releaseCsrf(jsonResponse({ csrf_token: 'csrf-shared' }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(refreshCalls).toBe(1)
    releaseRefresh(jsonResponse({ access_token: 'new-token' }))
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual(['new-token', 'new-token'])
    expect(tokens).toEqual(['new-token', 'new-token'])
  })

  it('maps profile and security helpers to account-api endpoints', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      getAccessToken: () => 'token',
      fetcher: async (input, init) => {
        calls.push({ input, init })
        if (String(input).endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }
        return jsonResponse({ ok: true })
      },
    })

    await api.updateProfile({ first_name: 'Ray', last_name: 'Self' })
    await api.uploadAvatar(new Blob(['jpeg'], { type: 'image/jpeg' }))
    await api.deleteAvatar()
    await api.changePassword({ old_password: 'oldSecret1', new_password: 'newSecret1' })
    await api.setupMfa()
    await api.disableMfa()
    await api.logoutDevice('device-1')
    await api.unlinkAccount('google')

    expect(calls.map((call) => `${call.init?.method ?? 'GET'} ${String(call.input)}`)).toEqual([
      'GET /api/account/v1/csrf-token',
      'PUT /api/account/v1/profile',
      'POST /api/account/v1/profile/avatar',
      'DELETE /api/account/v1/profile/avatar',
      'POST /api/account/v1/change-password',
      'POST /api/account/v1/mfa/setup',
      'POST /api/account/v1/mfa/disable',
      'DELETE /api/account/v1/devices/device-1',
      'DELETE /api/account/v1/linked-accounts/google',
    ])
  })

  it('maps email verification and password recovery helpers to account-api endpoints', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input, init) => {
        calls.push({ input, init })
        if (String(input).endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }
        return jsonResponse({ message: 'ok' })
      },
    })

    await api.verifyEmail('verify-token')
    await api.forgotPassword('user@example.com')
    await api.resetPassword({ email: 'user@example.com', token: 'reset-token', new_password: 'Secret123!' })

    expect(calls.map((call) => `${call.init?.method ?? 'GET'} ${String(call.input)}`)).toEqual([
      'GET /api/account/v1/verify-email?token=verify-token',
      'GET /api/account/v1/csrf-token',
      'POST /api/account/v1/forgot-password',
      'POST /api/account/v1/reset-password',
    ])
  })

  it('only builds social login URLs when an auth request is available', () => {
    const api = new AccountApi({ baseUrl: '/api/account/v1' })

    expect(api.getSocialLoginUrl('google')).toBe('')
    expect(api.getSocialLoginUrl('google', 'req-123')).toBe(
      '/api/account/v1/oauth2/google/login?auth_request_id=req-123',
    )
  })

  it('coalesces concurrent csrf token requests across clients with the same base URL', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    let csrfCalls = 0
    let releaseCsrf!: (response: Response) => void
    const csrfResponse = new Promise<Response>((resolve) => {
      releaseCsrf = resolve
    })
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init })
      if (String(input).endsWith('/csrf-token')) {
        csrfCalls += 1
        return csrfResponse
      }
      return jsonResponse({ message: 'ok' })
    }
    const first = new AccountApi({ baseUrl: '/api/account/v1', fetcher })
    const second = new AccountApi({ baseUrl: '/api/account/v1', fetcher })

    const firstRequest = first.forgotPassword('first@example.com')
    const secondRequest = second.forgotPassword('second@example.com')

    expect(csrfCalls).toBe(1)
    releaseCsrf(jsonResponse({ csrf_token: 'csrf-shared' }))
    await Promise.all([firstRequest, secondRequest])

    expect(calls.filter((call) => String(call.input).endsWith('/csrf-token'))).toHaveLength(1)
    expect(calls.filter((call) => String(call.input).endsWith('/forgot-password'))).toHaveLength(2)
    expect(calls.slice(-2).every((call) => new Headers(call.init?.headers).get('x-csrf-token') === 'csrf-shared')).toBe(true)
  })
})
