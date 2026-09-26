import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOperationsClient } from '@hallelujahhomechurch/operations-client'
import { createAccountSessionClient, createBrowserAccountAuthRuntime } from '@hallelujahhomechurch/account-client'
import { AccountApi } from './api'
import { OperationsApi } from './operations-api'
import { UnitNotificationsApi } from './unit-notifications-api'
import { initObservability, observeApiFetch, recordAccountAuthEvent, sanitizeSentryEvent } from '../observability'

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), init: vi.fn(), addBreadcrumb: vi.fn(), browserTracingIntegration: vi.fn() }))
vi.mock('@sentry/react', () => sentry)

beforeEach(() => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.test/1')
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllEnvs())

function clients(fetcher: typeof fetch) {
  return {
    account: () => new AccountApi({ baseUrl: '/api/account/v1', fetcher }).me(),
    operations: () => new OperationsApi(createOperationsClient({ baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher })).listMyResources(),
    notifications: () => new UnitNotificationsApi({ getAccessToken: () => 'token', fetch: fetcher }).list('private-unit'),
  }
}

async function flushSentry() { await initObservability(); await Promise.resolve() }

describe.each(['account', 'operations', 'notifications'] as const)('%s caught API errors', client => {
  it.each([500, 502, 503])('reports HTTP %s exactly once, with request correlation but no payload', async status => {
    const response = new Response(JSON.stringify({ message: 'private@example.test', secret: 'sensitive-body' }), { status, headers: { 'X-HHC-Request-ID': 'req-review' } })
    await expect(clients(async () => response)[client]()).rejects.toBeDefined()
    await flushSentry()
    expect(sentry.captureException).toHaveBeenCalledOnce()
    const [error, context] = sentry.captureException.mock.calls[0]
    expect(context.contexts.api).toMatchObject({ status, request_id: 'req-review' })
    expect(context.tags.api_failure).toBe('http')
    expect(`${error.message}${JSON.stringify(context)}`).not.toMatch(/private|sensitive|token/)
  })

  it.each([400, 401, 403, 404, 409, 422, 429])('does not report expected HTTP %s', async status => {
    await expect(clients(async () => Response.json({}, { status }))[client]()).rejects.toBeDefined()
    await flushSentry()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports a network rejection without forwarding the original error', async () => {
    const error = new TypeError('Failed fetch: private@example.test?token=secret')
    await expect(clients(async () => { throw error })[client]()).rejects.toBe(error)
    await flushSentry()
    expect(sentry.captureException).toHaveBeenCalledOnce()
    expect(sentry.captureException.mock.calls[0][0]).not.toBe(error)
    expect(sentry.captureException.mock.calls[0][1].tags.api_failure).toBe('network')
  })

  it('does not report an intentional cancellation', async () => {
    await expect(clients(async () => { throw new DOMException('Aborted', 'AbortError') })[client]()).rejects.toBeDefined()
    await flushSentry()
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports malformed successful JSON exactly once', async () => {
    await expect(clients(async () => new Response('{', { headers: { 'X-HHC-Request-ID': 'req-invalid' } }))[client]()).rejects.toBeDefined()
    await flushSentry()
    expect(sentry.captureException).toHaveBeenCalledOnce()
    expect(sentry.captureException.mock.calls[0][1].tags.api_failure).toBe('invalid_response')
  })
})

it('uses the Operations route template, never a member ID or search query', async () => {
  const api = new OperationsApi(createOperationsClient({ baseUrl: '', getAccessToken: async () => null, refreshAfterUnauthorized: async () => null, fetcher: async () => Response.json({}, { status: 500 }) }))
  await expect(api.listManagedMembers('private-unit', 'private@example.test')).rejects.toBeDefined()
  await flushSentry()
  expect(sentry.captureException.mock.calls[0][1].tags.operation).toBe('/api/operations/manage/org-units/{unitId}/members')
  expect(JSON.stringify(sentry.captureException.mock.calls)).not.toContain('private')
})

it.each([null, {}, { items: null }])('rejects malformed Operations resources %j before rendering', async data => {
  await expect(clients(async () => Response.json(data)).operations()).rejects.toMatchObject({ code: 'invalid_response' })
  await flushSentry()
  expect(sentry.captureException).toHaveBeenCalledOnce()
})

it('reports the shared session client validation failure using its actual response', async () => {
  const api = new AccountApi({ baseUrl: '/api/account/v1', fetcher: async () => Response.json({}, { headers: { 'X-HHC-Request-ID': 'req-session' } }) })
  await expect(api.getSession()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  await flushSentry()
  expect(sentry.captureException).toHaveBeenCalledOnce()
  expect(sentry.captureException.mock.calls[0][1].contexts.api.request_id).toBe('req-session')
})

it('strips automatically attached form and navigation data from caught API events', () => {
  const event = sanitizeSentryEvent({ tags: { api_failure: 'http', operation: 'account.request' }, user: { id: 'private' }, request: { url: '/private' }, extra: { body: 'private' }, breadcrumbs: [{ message: 'private' }], transaction: '/private', contexts: { api: { request_id: 'req-1' } } })
  expect(JSON.stringify(event)).not.toContain('private')
  expect(event.contexts).toEqual({ api: { request_id: 'req-1' } })
})

it.each([200, 503])('does not report recovered 401 and reports the final %s only if it fails', async status => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 401 })).mockResolvedValueOnce(Response.json([], { status }))
  const refresh = vi.fn().mockResolvedValue('fresh')
  const api = new OperationsApi(createOperationsClient({ baseUrl: '', getAccessToken: async () => 'old', refreshAfterUnauthorized: refresh, fetcher }))
  if (status === 200) await expect(api.listMyResources()).resolves.toEqual([])
  else await expect(api.listMyResources()).rejects.toMatchObject({ status })
  await flushSentry()
  expect(refresh).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(sentry.captureException).toHaveBeenCalledTimes(status === 200 ? 0 : 1)
})

it('never resends a notification because telemetry capture throws', async () => {
  sentry.captureException.mockImplementationOnce(() => { throw new Error('transport unavailable') })
  const fetcher = vi.fn(async () => Response.json({}, { status: 503 }))
  const api = new UnitNotificationsApi({ getAccessToken: () => 'token', fetch: fetcher })
  await expect(api.submit('unit', 'subject', 'body', 'key')).rejects.toMatchObject({ status: 503 })
  await flushSentry()
  expect(fetcher).toHaveBeenCalledOnce()
})

it.each(['network', 'http', 'invalid_response'] as const)('reports runtime refresh %s failure once across client boundaries', async kind => {
  const runtime = createBrowserAccountAuthRuntime({ storage: undefined, onEvent: recordAccountAuthEvent, client: createAccountSessionClient({ fetcher: observeApiFetch(async input => {
    if (String(input).endsWith('/csrf-token')) return Response.json({ csrf_token: 'csrf' })
    if (kind === 'network') throw new TypeError('offline')
    return Response.json({}, { status: kind === 'http' ? 503 : 200 })
  }, 'account.session') }) })
  const api = new OperationsApi(createOperationsClient({ baseUrl: '', getAccessToken: async () => 'old', refreshAfterUnauthorized: token => runtime.refreshAfterUnauthorized(token), fetcher: async () => Response.json({}, { status: 401 }) }))
  await expect(api.listMyResources()).rejects.toBeDefined()
  await flushSentry()
  expect(sentry.captureException).toHaveBeenCalledOnce()
  expect(sentry.captureException.mock.calls[0][1].tags.api_failure).toBe(kind)
  runtime.dispose()
})

it('reports invalid session bootstrap through the runtime event hook', async () => {
  const runtime = createBrowserAccountAuthRuntime({ onEvent: recordAccountAuthEvent, client: createAccountSessionClient({ fetcher: observeApiFetch(async () => Response.json({}), 'account.session') }) })
  await expect(runtime.revalidate()).resolves.toMatchObject({ status: 'unavailable' })
  await flushSentry()
  expect(sentry.captureException).toHaveBeenCalledOnce()
  expect(sentry.captureException.mock.calls[0][1].tags.operation).toBe('account.session.session')
  runtime.dispose()
})
