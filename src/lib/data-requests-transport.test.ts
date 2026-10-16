import { describe, expect, it, vi } from 'vitest'
import { AccountApi } from './api'
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
describe('data requests transport', () => {
  it('verifies publicly without cookies, bearer, CSRF bootstrap or auth recovery', async () => {
    const calls: RequestInit[] = []
    const refresh = vi.fn()
    const api = new AccountApi({
      baseUrl: '/api/account/v1', getAccessToken: () => 'wrong-account', refreshAfterUnauthorized: refresh, fetcher: async (url, init) => {
        expect(String(url)).toBe('/api/account/v1/data-requests/email-verification')
        calls.push(init!)
        return json({ errorCode: 'ACC_AUTH_TOKEN_INVALID', serverTime: '2026-10-16T00:00:00Z', status: 'error' }, 401)
      }
    })
    await expect(api.dataRequests.verifyEmail({ token: 'memory-only' })).rejects.toMatchObject({ status: 401, code: 'ACC_AUTH_TOKEN_INVALID' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store' })
    expect(new Headers(calls[0].headers).has('authorization')).toBe(false)
    expect(new Headers(calls[0].headers).has('x-csrf-token')).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
  it('sends protected CAS writes once with CSRF/bearer and preserves Retry-After metadata', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const api = new AccountApi({
      baseUrl: '/api/account/v1', getAccessToken: () => 'account-token', fetcher: async (url, init) => {
        calls.push([String(url), init])
        if (String(url).endsWith('/csrf-token')) return json({ csrf_token: 'csrf' })
        return json({ status: 'error', errorCode: 'ACC_AUTH_RATE_LIMITED', serverTime: '2026-10-16T00:00:00Z' }, 429, { 'Retry-After': '45' })
      }
    })
    await expect(api.dataRequests.cancel('request-id', { requestVersion: 3 })).rejects.toMatchObject({ status: 429, code: 'ACC_AUTH_RATE_LIMITED', retryAfter: '45' })
    expect(calls).toHaveLength(2)
    const init = calls[1][1]!
    expect(init).toMatchObject({ credentials: 'include', redirect: 'error', cache: 'no-store', body: '{"requestVersion":3}' })
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer account-token')
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('csrf')
  })
})

it('recovers protected 401 normally but does not replay a correction mutation', async () => {
  let writes = 0
  let token = 'old-token'
  const refresh = vi.fn(async () => 'recovered-token')
  const api = new AccountApi({    
baseUrl: '/api/account/v1', getAccessToken: () => token, setAccessToken: value => { token = value ?? '' }, refreshAfterUnauthorized: refresh, fetcher: async (url) => {
      if (String(url).endsWith('/csrf-token')) return json({ csrf_token: 'csrf' })
      writes++; return json({ status: 'error', errorCode: 'ACC_AUTH_TOKEN_INVALID' }, 401)
    }  
})
  await expect(api.dataRequests.cancel('request', { requestVersion: 1 })).rejects.toMatchObject({ status: 401, code: 'ACC_AUTH_TOKEN_INVALID', authRecovered: true })
  expect(refresh).toHaveBeenCalledWith('old-token'); expect(writes).toBe(1)
  expect(token).toBe('recovered-token')
})
it('keeps the session on 503 without an authentication recovery call', async () => {
  const refresh = vi.fn()
  const api = new AccountApi({ baseUrl: '/api/account/v1', getAccessToken: () => 'token', refreshAfterUnauthorized: refresh, fetcher: async () => json({ status: 'error', errorCode: 'ACC_SERVICE_UNAVAILABLE' }, 503) })
  await expect(api.dataRequests.current()).rejects.toMatchObject({ status: 503, code: 'ACC_SERVICE_UNAVAILABLE' })
  expect(refresh).not.toHaveBeenCalled()
})

it('does not mark an unrecoverable mutation as recovered', async () => {
  const api = new AccountApi({ baseUrl: '/api/account/v1', getAccessToken: () => 'old-token', refreshAfterUnauthorized: async () => null, fetcher: async url => String(url).endsWith('/csrf-token') ? json({ csrf_token: 'csrf' }) : json({ errorCode: 'ACC_AUTH_TOKEN_INVALID' }, 401) })
  await expect(api.dataRequests.cancel('request', { requestVersion: 1 })).rejects.toMatchObject({ status: 401, authRecovered: false })
})
