import { act } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const events: import('@sentry/react').ErrorEvent[] = []
vi.mock('@sentry/react', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@sentry/react')>()
  return { ...sdk, init: (options: Parameters<typeof sdk.init>[0]) => sdk.init({
    ...options,
    transport: () => ({
      send: (envelope) => {
        for (const [header, payload] of envelope[1]) if (header.type === 'event') events.push(payload as import('@sentry/react').ErrorEvent)
        return Promise.resolve({ statusCode: 200 })
      },
      flush: () => Promise.resolve(true),
    }),
  }) }
})

class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p>Retry</p> : this.props.children }
}

afterEach(async () => {
  const sdk = await import('@sentry/react')
  await sdk.close()
  vi.unstubAllEnvs()
  vi.resetModules()
  events.length = 0
})

it('reports a caught render failure through the real SDK, including the first failure during initialization', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.test/1')
  const { initObservability, reportReactError } = await import('./observability')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host, { onCaughtError: reportReactError })
  const failure = new DOMException('removeChild failed for member@example.com token=secret', 'NotFoundError')
  function Broken(): ReactNode { throw failure }
  try {
    await act(async () => root.render(<Boundary><Broken /></Boundary>))
    await initObservability()
    await (await import('@sentry/react')).flush(2000)
    expect(host.textContent).toBe('Retry')
    expect(events).toHaveLength(1)
    expect(events[0].exception?.values).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'NotFoundError', value: 'removeChild failed for [redacted-email] token=[redacted]' }),
    ]))
    expect(JSON.stringify(events[0])).toContain('Broken')
    expect(JSON.stringify(events[0])).not.toContain('member@example.com')
    expect(JSON.stringify(events[0])).not.toContain('token=secret')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

it('does not load or report without a DSN', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', '')
  const { reportReactError, initObservability } = await import('./observability')
  expect(() => reportReactError(new Error('render failed'), { componentStack: '\n    at Broken' })).not.toThrow()
  expect(initObservability()).toBeUndefined()
  expect(events).toHaveLength(0)
})
