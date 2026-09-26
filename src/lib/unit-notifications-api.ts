export type UnitNotificationPreview = {
  audienceAccounts: number
  emailRecipients: number
  webPushDevices: number
}

export type UnitNotificationChannel = {
  campaignId: string
  channel: 'email' | 'web_push'
  status: string
  recipientCount: number
}

export type UnitNotification = {
  id: string
  orgUnitId: string
  subject: string
  body: string
  audienceAccountCount: number
  createdAt: string
  channels: UnitNotificationChannel[]
}

export type UnitNotificationPage = {
  items: UnitNotification[]
  page: number
  perPage: number
  total: number
}

export class UnitNotificationsApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, code?: string) {
    super(code ?? `HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

type Options = {
  getAccessToken: () => string | null | Promise<string | null>
  refreshAfterUnauthorized?: (rejectedToken: string) => Promise<string | null>
  fetch?: typeof fetch
}

export class UnitNotificationsApi {
  private readonly fetch: typeof fetch
  private readonly options: Options

  constructor(options: Options) {
    this.options = options
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  preview(orgUnitId: string, signal?: AbortSignal) {
    return this.request<UnitNotificationPreview>('/api/engagement/unit-notifications/preview', { method: 'POST', body: JSON.stringify({ orgUnitId }), signal }).then(value => {
      if (!value || ![value.audienceAccounts, value.emailRecipients, value.webPushDevices].every(validCount)) throw new UnitNotificationsApiError(502, 'invalid_response')
      return value
    })
  }

  submit(orgUnitId: string, subject: string, body: string, key: string, signal?: AbortSignal) {
    return this.request<UnitNotification>('/api/engagement/unit-notifications', { method: 'POST', body: JSON.stringify({ orgUnitId, subject, body }), headers: { 'Idempotency-Key': key }, signal }).then(validateNotification)
  }

  list(orgUnitId: string, page = 1, limit = 20, signal?: AbortSignal) {
    const query = new URLSearchParams({ orgUnitId, page: String(page), limit: String(limit) })
    return this.request<UnitNotificationPage>(`/api/engagement/unit-notifications?${query}`, { signal }).then(value => {
      if (!value || !Array.isArray(value.items) || ![value.page, value.perPage, value.total].every(validCount) || value.page < 1 || value.perPage < 1) throw new UnitNotificationsApiError(502, 'invalid_response')
      return { ...value, items: value.items.map(validateNotification) }
    })
  }

  get(notificationId: string, signal?: AbortSignal) {
    return this.request<UnitNotification>(`/api/engagement/unit-notifications/${encodeURIComponent(notificationId)}`, { signal }).then(validateNotification)
  }

  private async request<T>(path: string, init: RequestInit, retry = true, refreshedToken?: string): Promise<T> {
    const token = refreshedToken ?? await this.options.getAccessToken()
    const response = await this.fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (response.status === 401 && retry && token && this.options.refreshAfterUnauthorized) {
      const refreshed = await this.options.refreshAfterUnauthorized(token)
      if (refreshed) return this.request<T>(path, init, false, refreshed)
    }
    const value = await response.json().catch(() => undefined) as { data?: T; error?: string | { code?: string } } | undefined
    const code = typeof value?.error === 'string' ? value.error : value?.error?.code
    if (!response.ok || value?.data === undefined) throw new UnitNotificationsApiError(response.status, code)
    return value.data
  }
}

function validateNotification(value: UnitNotification) {
  if (!value || ![value.id, value.orgUnitId, value.subject, value.body, value.createdAt].every(field => typeof field === 'string') || !validCount(value.audienceAccountCount) || !Number.isFinite(Date.parse(value.createdAt))) throw new UnitNotificationsApiError(502, 'invalid_response')
  if (!Array.isArray(value.channels) || value.channels.length !== 2 || !value.channels.every(channel => channel && typeof channel.campaignId === 'string' && typeof channel.status === 'string' && validCount(channel.recipientCount)) || new Set(value.channels.map(({ channel }) => channel)).size !== 2 || !value.channels.some(({ channel }) => channel === 'email') || !value.channels.some(({ channel }) => channel === 'web_push')) {
    throw new UnitNotificationsApiError(502, 'invalid_sibling_channels')
  }
  return value
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
