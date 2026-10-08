import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  enableBrowserServicePush,
  disableBrowserServicePush,
  getBrowserServicePushState,
} from './browser-service-push'
const registration = {
  pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() },
}
const subscription = {
  unsubscribe: vi.fn(),
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    keys: { p256dh: 'public', auth: 'auth' },
  }),
}
const api = { registerInstallation: vi.fn() }
const permission = { permission: 'default', requestPermission: vi.fn() }
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('hhc.service-push.owner', 'member')
  vi.stubGlobal('crypto', webcrypto)
  vi.clearAllMocks()
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('Notification', permission)
  vi.stubGlobal('PushManager', function () {})
  vi.stubGlobal('navigator', {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
    locks: { request: (_name: string, task: () => unknown) => task() },
  })
  permission.permission = 'default'
  permission.requestPermission.mockResolvedValue('granted')
  registration.pushManager.getSubscription.mockResolvedValue(null)
  registration.pushManager.subscribe.mockResolvedValue(subscription)
  subscription.unsubscribe.mockResolvedValue(true)
  api.registerInstallation.mockResolvedValue({ ok: true })
})
afterEach(() => vi.unstubAllGlobals())
it('only reports enabled after registration, and revokes the same installation', async () => {
  await enableBrowserServicePush(api, 'member', 'AAAA')
  const body = api.registerInstallation.mock.calls[0][0]
  expect(body.platform).toBe('web')
  expect(body.subscription).toEqual(subscription.toJSON())
  expect(body.secret.length).toBeGreaterThanOrEqual(32)
  permission.permission = 'granted'
  registration.pushManager.getSubscription.mockResolvedValue(subscription)
  expect(await getBrowserServicePushState('member')).toBe('on')
  await disableBrowserServicePush(api, 'member')
  expect(api.registerInstallation).toHaveBeenLastCalledWith(
    { id: body.id, secret: body.secret, revoke: true },
    expect.any(AbortSignal),
  )
  expect(subscription.unsubscribe).toHaveBeenCalledOnce()
})
it('does not subscribe or register after permission is denied', async () => {
  permission.requestPermission.mockResolvedValue('denied')
  await expect(enableBrowserServicePush(api, 'member', 'AAAA')).rejects.toThrow(
    'denied',
  )
  expect(api.registerInstallation).not.toHaveBeenCalled()
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
})
it('cleans up the subscription after uncertain registration failure', async () => {
  api.registerInstallation.mockRejectedValue(new Error('offline'))
  await expect(enableBrowserServicePush(api, 'member', 'AAAA')).rejects.toThrow(
    'offline',
  )
  expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  expect(await getBrowserServicePushState('member')).toBe('off')
})
it('logout invalidates a pending permission request before it can bind an account', async () => {
  let grant!: (value: string) => void
  permission.requestPermission.mockReturnValue(
    new Promise((resolve) => {
      grant = resolve
    }),
  )
  const pending = enableBrowserServicePush(api, 'member', 'AAAA')
  await disableBrowserServicePush(api, 'member')
  grant('granted')
  await expect(pending).rejects.toThrow('cancelled')
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled()
  expect(api.registerInstallation).not.toHaveBeenCalled()
})

it('a changed account cannot complete an old permission prompt', async () => {
  let grant!: (value: string) => void
  permission.requestPermission.mockReturnValue(
    new Promise((resolve) => {
      grant = resolve
    }),
  )
  const pending = enableBrowserServicePush(api, 'member', 'AAAA')
  localStorage.setItem('hhc.service-push.owner', 'different-member')
  grant('granted')
  await expect(pending).rejects.toThrow('cancelled')
  expect(api.registerInstallation).not.toHaveBeenCalled()
})
it('retains an incomplete state if both registration and unsubscribe fail', async () => {
  api.registerInstallation.mockRejectedValue(new Error('offline'))
  subscription.unsubscribe.mockRejectedValue(new Error('offline'))
  await expect(enableBrowserServicePush(api, 'member', 'AAAA')).rejects.toThrow(
    'offline',
  )
  registration.pushManager.getSubscription.mockResolvedValue(subscription)
  expect(await getBrowserServicePushState('member')).toBe('pending')
})
