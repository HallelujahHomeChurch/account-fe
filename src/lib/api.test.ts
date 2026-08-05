import { describe, expect, it, vi } from 'vitest'

import { AccountApi } from './api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AccountApi', () => {
  it('reads the non-rotating account session summary', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input, init) => {
        calls.push({ input, init })
        return jsonResponse({ authenticated: false })
      },
    })

    await expect(api.getSession()).resolves.toEqual({ authenticated: false })
    expect(calls).toHaveLength(1)
    expect(String(calls[0]?.input)).toBe('/api/account/v1/session')
    expect(calls[0]?.init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' })
  })

  it('issues a non-rotating access token without committing it', async () => {
    const setAccessToken = vi.fn()
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      setAccessToken,
      fetcher: async (input) => String(input).endsWith('/csrf-token')
        ? jsonResponse({ csrf_token: 'csrf-123' })
        : jsonResponse({ access_token: 'access-123', expires_in: 900 }),
    })

    await expect(api.issueAccessToken()).resolves.toBe('access-123')
    expect(setAccessToken).not.toHaveBeenCalled()
  })

  it('accepts the direct profile redirect contract', async () => {
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input) =>
        String(input).endsWith('/csrf-token')
          ? jsonResponse({ csrf_token: 'csrf-123' })
          : jsonResponse({
              access_token: 'access-token',
              redirect_type: 'profile',
              redirect_uri: '/profile',
            }),
    })

    const response = await api.login({ email: 'user@example.com', password: 'password' })

    expect(response.redirect_type).toBe('profile')
  })

  it('does not expose forced MFA setup token methods', () => {
    const api = new AccountApi({ baseUrl: '/api/account/v1' })

    expect(api).not.toHaveProperty('setupMfaWithToken')
    expect(api).not.toHaveProperty('verifyMfaSetupWithToken')
  })

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

	it('uses the current-device global logout endpoint', async () => {
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
		const api = new AccountApi({
			baseUrl: '/api/account/v1',
			fetcher: async (input, init) => {
				calls.push({ input, init })
				if (String(input).endsWith('/csrf-token')) return jsonResponse({ csrf_token: 'csrf-123' })
				return jsonResponse({ message: 'Logged out successfully' })
			},
		})

		await api.logoutAll()

		expect(calls.map((call) => `${call.init?.method ?? 'GET'} ${String(call.input)}`)).toEqual([
			'GET /api/account/v1/csrf-token',
			'POST /api/account/v1/session/logout-all',
		])
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

  it('does not restore a token when logout wins an in-flight 401 recovery', async () => {
    let accessToken = 'expired-token'
    let finishRefresh!: (response: Response) => void
    const refreshResponse = new Promise<Response>((resolve) => { finishRefresh = resolve })
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      getAccessToken: () => accessToken,
      setAccessToken: (next) => { accessToken = next ?? '' },
      fetcher: async (input) => {
        const url = String(input)
        if (url.endsWith('/csrf-token')) return jsonResponse({ csrf_token: 'csrf-123' })
        if (url.endsWith('/refresh')) return refreshResponse
        return jsonResponse({ message: 'expired' }, 401)
      },
    })

    const request = api.me()
    await Promise.resolve()
    accessToken = ''
    finishRefresh(jsonResponse({ access_token: 'late-token' }))

    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(accessToken).toBe('')
  })

  it('retries every concurrent request after their shared refresh succeeds', async () => {
    let accessToken = 'expired-token'
    let refreshCalls = 0
    let resourceCalls = 0
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      getAccessToken: () => accessToken,
      setAccessToken: (next) => { accessToken = next ?? '' },
      fetcher: async (input, init) => {
        const url = String(input)
        if (url.endsWith('/csrf-token')) return jsonResponse({ csrf_token: 'csrf-123' })
        if (url.endsWith('/refresh')) {
          refreshCalls += 1
          return jsonResponse({ access_token: 'new-token' })
        }
        resourceCalls += 1
        return new Headers(init?.headers).get('authorization') === 'Bearer new-token'
          ? jsonResponse({ id: 'u1', email: 'admin@example.com' })
          : jsonResponse({ message: 'expired' }, 401)
      },
    })

    await expect(Promise.all([api.me(), api.me()])).resolves.toHaveLength(2)
    expect({ refreshCalls, resourceCalls, accessToken }).toEqual({
      refreshCalls: 1,
      resourceCalls: 4,
      accessToken: 'new-token',
    })
  })

  it('coalesces concurrent refresh requests without implicitly committing tokens', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(csrfCalls).toBe(1)
    releaseCsrf(jsonResponse({ csrf_token: 'csrf-shared' }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(refreshCalls).toBe(1)
    releaseRefresh(jsonResponse({ access_token: 'new-token' }))
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual(['new-token', 'new-token'])
    expect(tokens).toEqual([])
  })

  it('retries a superseded refresh once and preserves other errors', async () => {
    let refreshCalls = 0
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input) => {
        if (String(input).endsWith('/csrf-token')) return jsonResponse({ csrf_token: 'csrf-123' })
        refreshCalls += 1
        return refreshCalls === 1
          ? jsonResponse({ error_code: 'ACC_AUTH_REFRESH_SUPERSEDED' }, 409)
          : jsonResponse({ access_token: 'new-token' })
      },
    })

    await expect(api.refreshAccessToken()).resolves.toBe('new-token')
    expect(refreshCalls).toBe(2)

    const unavailable = new AccountApi({
      baseUrl: '/api/account/unavailable',
      fetcher: async (input) => String(input).endsWith('/csrf-token')
        ? jsonResponse({ csrf_token: 'csrf-123' })
        : jsonResponse({ message: 'unavailable' }, 503),
    })
    await expect(unavailable.refreshAccessToken()).rejects.toMatchObject({ status: 503 })
  })

  it('refreshes an invalid CSRF token once', async () => {
    let csrfCalls = 0
    let mutationCalls = 0
    const api = new AccountApi({
      baseUrl: '/api/account/csrf-retry',
      fetcher: async (input) => {
        if (String(input).endsWith('/csrf-token')) {
          csrfCalls += 1
          return jsonResponse({ csrf_token: `csrf-${csrfCalls}` })
        }
        mutationCalls += 1
        return mutationCalls === 1
          ? jsonResponse({ error_code: 'ACC_CSRF_TOKEN_INVALID' }, 403)
          : jsonResponse({ message: 'ok' })
      },
    })

    await expect(api.forgotPassword('user@example.com')).resolves.toMatchObject({ message: 'ok' })
    expect({ csrfCalls, mutationCalls }).toEqual({ csrfCalls: 2, mutationCalls: 2 })
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
      'GET /api/account/v1/csrf-token',
      'POST /api/account/v1/verify-email',
      'POST /api/account/v1/forgot-password',
      'POST /api/account/v1/reset-password',
    ])
    expect(calls[1]?.init?.body).toBe(JSON.stringify({ token: 'verify-token' }))
  })

  it('starts an authenticated linked-account authorization', async () => {
    const calls: string[] = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      getAccessToken: () => 'access-token',
      fetcher: async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
        if (String(input).endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }
        return jsonResponse({ authorization_url: 'https://provider.example/google' })
      },
    })

    await expect(api.startLinkedAccountAuthorization('google')).resolves.toEqual({
      authorization_url: 'https://provider.example/google',
    })
    expect(calls).toContain('POST /api/account/v1/linked-accounts/google/authorize')
  })

  it('builds direct and client-authorized social login URLs', () => {
    const api = new AccountApi({ baseUrl: '/api/account/v1' })

    expect(api.getSocialLoginUrl('google')).toBe('/api/account/v1/oauth2/google/login')
    expect(api.getSocialLoginUrl('google', 'req-123')).toBe(
      '/api/account/v1/oauth2/google/login?auth_request_id=req-123',
    )
  })

  it('lists OAuth providers enabled by the API', async () => {
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async () => jsonResponse({ providers: ['google', 'line'] }),
    })

    await expect(api.getOAuthProviders()).resolves.toEqual(['google', 'line'])
  })

  it('reads public registration capability', async () => {
	const api = new AccountApi({
	  baseUrl: '/api/account/v1',
	  fetcher: async () => jsonResponse({ providers: ['google'], registration_enabled: true }),
	})

	await expect(api.getAuthCapabilities()).resolves.toEqual({
	  providers: ['google'],
	  registrationEnabled: true,
	})
  })

  it('runs the social onboarding API sequence', async () => {
	const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
	const api = new AccountApi({
	  baseUrl: '/api/account/v1',
	  fetcher: async (input, init) => {
		calls.push({ input, init })
		if (String(input).endsWith('/csrf-token')) return jsonResponse({ csrf_token: 'csrf-123' })
		if (String(input).endsWith('/verify')) return jsonResponse({ provider: 'line', masked_email: 'u***@example.com', existing_account: true, requires_link_confirmation: true })
		return jsonResponse({ success: true, redirect_type: 'profile' })
	  },
	})

	await api.sendOAuthOnboardingCode('token', 'user@example.com')
	await expect(api.verifyOAuthOnboardingCode('token', '123456')).resolves.toMatchObject({ existing_account: true })
	await api.completeOAuthOnboarding('token', true)

	expect(calls.map((call) => String(call.input))).toEqual([
	  '/api/account/v1/csrf-token',
	  '/api/account/v1/oauth/onboarding/email',
	  '/api/account/v1/oauth/onboarding/verify',
	  '/api/account/v1/oauth/onboarding/confirm',
	])
  })

  it('confirms OAuth account links with CSRF-protected POST', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1',
      fetcher: async (input, init) => {
        calls.push({ input, init })
        if (String(input).endsWith('/csrf-token')) {
          return jsonResponse({ csrf_token: 'csrf-123' })
        }
        return jsonResponse({ message: 'linked' })
      },
    })

    await api.confirmOAuthLink('link-token')

    expect(calls.map((call) => `${call.init?.method ?? 'GET'} ${String(call.input)}`)).toEqual([
      'GET /api/account/v1/csrf-token',
      'POST /api/account/v1/oauth/confirm-link',
    ])
    expect(calls[1]?.init?.body).toBe(JSON.stringify({ token: 'link-token' }))
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

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(csrfCalls).toBe(1)
    releaseCsrf(jsonResponse({ csrf_token: 'csrf-shared' }))
    await Promise.all([firstRequest, secondRequest])

    expect(calls.filter((call) => String(call.input).endsWith('/csrf-token'))).toHaveLength(1)
    expect(calls.filter((call) => String(call.input).endsWith('/forgot-password'))).toHaveLength(2)
    expect(calls.slice(-2).every((call) => new Headers(call.init?.headers).get('x-csrf-token') === 'csrf-shared')).toBe(true)
  })
})
