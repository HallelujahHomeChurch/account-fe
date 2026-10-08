import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'
const source = readFileSync(
  `${process.cwd()}/public/service-push-worker.js`,
  'utf8',
)
it('shows generic text and only opens authenticated same-origin roster paths', async () => {
  const handlers: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const openWindow = vi.fn().mockResolvedValue(undefined)
  runInNewContext(source, {
    URL,
    self: {
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        handlers[type] = listener
      },
      location: { origin: 'https://account.alive.org.tw' },
      registration: { showNotification },
      clients: { openWindow },
    },
  })
  expect(handlers.fetch).toBeUndefined()
  let done: Promise<unknown> | undefined
  handlers.push({
    data: {
      json: () => ({
        title: 'private name',
        body: 'private duty',
        actionUrl:
          'https://evil.example/service/assignments/11111111-1111-4111-8111-111111111111',
      }),
    },
    waitUntil: (value: Promise<unknown>) => {
      done = value
    },
  })
  await done
  expect(showNotification).toHaveBeenLastCalledWith(
    'HHC · 服事通知',
    expect.objectContaining({ data: { path: '/service' } }),
  )
  expect(JSON.stringify(showNotification.mock.calls)).not.toContain('private')
  handlers.notificationclick({
    notification: { close: vi.fn(), data: { path: '//evil.example' } },
    waitUntil: (value: Promise<unknown>) => {
      done = value
    },
  })
  await done
  expect(openWindow).toHaveBeenCalledWith(
    'https://account.alive.org.tw/service',
  )
  const path = '/service/assignments/11111111-1111-4111-8111-111111111111'
  handlers.push({
    data: {
      json: () => ({ actionUrl: `https://account.alive.org.tw${path}` }),
    },
    waitUntil: (value: Promise<unknown>) => {
      done = value
    },
  })
  await done
  expect(showNotification).toHaveBeenLastCalledWith(
    'HHC · 服事通知',
    expect.objectContaining({ data: { path } }),
  )
})
