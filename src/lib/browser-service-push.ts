import type { MemberServiceApi } from './member-service-api'

type PushApi = Pick<MemberServiceApi, 'registerInstallation'>
type Installation = {
  id: string
  secret: string
  owner: string
  fingerprint: string
  enabled: boolean
}
export type BrowserServicePushState =
  'on' | 'off' | 'denied' | 'unsupported' | 'pending'
const recordKey = 'hhc.service-push.installation'
const epochKey = 'hhc.service-push.epoch'
const ownerKey = 'hhc.service-push.owner'
const lockKey = 'hhc.service-push'

export function browserServicePushSupported() {
  return (
    window.isSecureContext &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    'locks' in navigator
  )
}
function readInstallation(): Installation | null {
  const raw = localStorage.getItem(recordKey)
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object')
    throw new Error('invalid installation')
  const item = value as Partial<Installation>
  if (
    typeof item.id !== 'string' ||
    typeof item.secret !== 'string' ||
    typeof item.owner !== 'string' ||
    typeof item.fingerprint !== 'string' ||
    typeof item.enabled !== 'boolean'
  )
    throw new Error('invalid installation')
  return item as Installation
}
function save(item: Installation) {
  localStorage.setItem(recordKey, JSON.stringify(item))
}
function serialized<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request(lockKey, action) : action()
}
async function fingerprint(subscription: PushSubscription) {
  const raw = subscription.toJSON()
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
    ),
  )
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}
async function register(
  api: PushApi,
  body: Parameters<PushApi['registerInstallation']>[0],
  signal?: AbortSignal,
) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, 8000)
  try {
    return await api.registerInstallation(body, controller.signal)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
export async function getBrowserServicePushState(
  owner: string,
): Promise<BrowserServicePushState> {
  if (!browserServicePushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const item = readInstallation()
  const worker = await navigator.serviceWorker.getRegistration('/')
  const subscription = await worker?.pushManager.getSubscription()
  if (item?.owner === owner && subscription && !item.enabled) return 'pending'
  return Notification.permission === 'granted' &&
    item?.owner === owner &&
    item.enabled &&
    subscription &&
    item.fingerprint === (await fingerprint(subscription))
    ? 'on'
    : 'off'
}
export async function enableBrowserServicePush(
  api: PushApi,
  owner: string,
  publicKey: string,
  signal?: AbortSignal,
) {
  if (!browserServicePushSupported() || !owner) throw new Error('unsupported')
  const epoch = localStorage.getItem(epochKey)
  const current = () => {
    if (
      signal?.aborted ||
      localStorage.getItem(epochKey) !== epoch ||
      localStorage.getItem(ownerKey) !== owner
    )
      throw new Error('cancelled')
  }
  current()
  // Keep the browser permission prompt directly attached to the user's click.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')
  return serialized(async () => {
    current()
    let item = readInstallation()
    const worker = await navigator.serviceWorker.register(
      '/service-push-worker.js',
      { scope: '/' },
    )
    await navigator.serviceWorker.ready
    current()
    let subscription = await worker.pushManager.getSubscription()
    if (subscription && item?.owner !== owner) {
      if (!(await subscription.unsubscribe()))
        throw new Error('unsubscribe failed')
      subscription = null
    }
    current()
    if (!item || item.owner !== owner)
      item = {
        id: crypto.randomUUID(),
        secret: [...crypto.getRandomValues(new Uint8Array(32))]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join(''),
        owner,
        fingerprint: '',
        enabled: false,
      }
    item.enabled = false
    save(item)
    const applicationServerKey = Uint8Array.from(
      atob(
        publicKey
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(publicKey.length / 4) * 4, '='),
      ),
      (character) => character.charCodeAt(0),
    )
    subscription ??= await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    try {
      current()
      const raw = subscription.toJSON()
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth)
        throw new Error('invalid subscription')
      const hash = await fingerprint(subscription)
      await register(
        api,
        {
          id: item.id,
          secret: item.secret,
          platform: 'web',
          subscription: {
            endpoint: raw.endpoint,
            keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
          },
        },
        signal,
      )
      current()
      save({ ...item, fingerprint: hash, enabled: true })
    } catch (error) {
      await subscription.unsubscribe().catch(() => false)
      throw error
    }
  })
}
export async function disableBrowserServicePush(api: PushApi, owner: string) {
  localStorage.setItem(epochKey, crypto.randomUUID())
  return serialized(async () => {
    const item = readInstallation()
    if (item) save({ ...item, enabled: false })
    let error: unknown
    try {
      if (item?.owner === owner)
        await register(api, { id: item.id, secret: item.secret, revoke: true })
    } catch (caught) {
      error = caught
    }
    try {
      const worker =
        'serviceWorker' in navigator
          ? await navigator.serviceWorker.getRegistration('/')
          : undefined
      const subscription = await worker?.pushManager.getSubscription()
      if (subscription && !(await subscription.unsubscribe()))
        throw new Error('unsubscribe failed')
      if (!error) localStorage.removeItem(recordKey)
    } catch (caught) {
      error ??= caught
    }
    if (error) throw error
  })
}

export async function synchronizeBrowserServicePushAccount(
  api: PushApi,
  owner: string,
) {
  if (localStorage.getItem(ownerKey) !== owner) {
    localStorage.setItem(ownerKey, owner)
    localStorage.setItem(epochKey, crypto.randomUUID())
  }
  const item = readInstallation()
  if (item && item.owner !== owner) await disableBrowserServicePush(api, owner)
}
