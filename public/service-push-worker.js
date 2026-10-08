self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
)
// Push-only worker: Account pages, credentials and API data are never cached.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    /* Display a safe generic notification. */
  }
  let path = '/service'
  try {
    const url = new URL(payload.actionUrl, self.location.origin)
    if (
      url.origin === self.location.origin &&
      /^\/service\/assignments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.pathname) &&
      !url.search &&
      !url.hash
    )
      path = url.pathname
  } catch {
    /* Keep the authenticated roster fallback. */
  }
  event.waitUntil(
    self.registration.showNotification('HHC · 服事通知', {
      body: '你的服事有新的消息，請開啟服事表查看。',
      icon: '/assets/brand/logo.png',
      tag: `service:${path}`,
      data: { path },
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.path
  const target =
    typeof path === 'string' &&
    /^\/service(?:\/assignments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(path)
      ? path
      : '/service'
  event.waitUntil(
    self.clients.openWindow(new URL(target, self.location.origin).href),
  )
})
