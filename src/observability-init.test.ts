import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@sentry/react') })

it('retains the first failure while the SDK is loading', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.test/1')
  const captureException = vi.fn()
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  vi.doMock('@sentry/react', async () => { await pending; return { captureException, init: vi.fn(), addBreadcrumb: vi.fn(), browserTracingIntegration: vi.fn() } })
  const { reportApiFailure, initObservability } = await import('./observability')
  reportApiFailure({ operation: 'first.request', method: 'GET' }, 'network')
  expect(captureException).not.toHaveBeenCalled()
  release()
  await initObservability()
  expect(captureException).toHaveBeenCalledOnce()
})

it('preserves the request failure when SDK loading fails', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.test/1')
  vi.doMock('@sentry/react', () => { throw new Error('SDK unavailable') })
  const { observeApiFetch, initObservability } = await import('./observability')
  const original = new TypeError('offline')
  await expect(observeApiFetch(async () => { throw original }, 'review')('/api/test')).rejects.toBe(original)
  await expect(initObservability()).resolves.toBeUndefined()
})

it('does not import the SDK without a DSN', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', '')
  const factory = vi.fn(() => { throw new Error('must not load') })
  vi.doMock('@sentry/react', factory)
  const { observeApiFetch, initObservability } = await import('./observability')
  const response = new Response(null, { status: 503 })
  await expect(observeApiFetch(async () => response, 'review')('/api/test')).resolves.toBe(response)
  expect(initObservability()).toBeUndefined()
  expect(factory).not.toHaveBeenCalled()
})
