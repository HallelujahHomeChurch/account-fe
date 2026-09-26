import { expect, it, vi } from 'vitest'

import { UnitNotificationsApi, UnitNotificationsApiError } from './unit-notifications-api'

const json = (status: number, data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
const notification = { id: 'notification', orgUnitId: 'unit', subject: '主旨', body: '第一行\n第二行', audienceAccountCount: 2, createdAt: '2026-09-25T00:00:00Z', channels: [{ campaignId: 'email', channel: 'email', status: 'scheduled', recipientCount: 2 }, { campaignId: 'push', channel: 'web_push', status: 'scheduled', recipientCount: 3 }] }

it('uses relative same-origin routes and preserves idempotency and newlines', async () => {
  const fetch = vi.fn().mockImplementation(() => json(201, { data: notification }))
  const api = new UnitNotificationsApi({ getAccessToken: () => 'token', fetch })
  await api.submit('unit', '主旨', '第一行\n第二行', 'key')
  expect(fetch).toHaveBeenCalledWith('/api/engagement/unit-notifications', expect.objectContaining({ method: 'POST', body: JSON.stringify({ orgUnitId: 'unit', subject: '主旨', body: '第一行\n第二行' }), headers: expect.objectContaining({ 'Idempotency-Key': 'key' }) }))
})

it('refreshes once on 401 and never refreshes on 403', async () => {
  const refresh = vi.fn().mockResolvedValue('fresh')
  const fetch = vi.fn().mockImplementationOnce(() => json(401, { error: 'unauthorized' })).mockImplementationOnce(() => json(200, { data: { audienceAccounts: 1, emailRecipients: 1, webPushDevices: 1 } }))
  const api = new UnitNotificationsApi({ getAccessToken: () => 'token', refreshAfterUnauthorized: refresh, fetch })
  await api.preview('unit')
  expect(refresh).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')

  const deniedRefresh = vi.fn()
  const denied = new UnitNotificationsApi({ getAccessToken: () => 'token', refreshAfterUnauthorized: deniedRefresh, fetch: vi.fn(() => json(403, { error: { code: 'ENG_FORBIDDEN' } })) })
  await expect(denied.preview('unit')).rejects.toMatchObject({ status: 403, code: 'ENG_FORBIDDEN' } satisfies Partial<UnitNotificationsApiError>)
  expect(deniedRefresh).not.toHaveBeenCalled()
})

it('rejects malformed sibling channel results', async () => {
  const api = new UnitNotificationsApi({ getAccessToken: () => 'token', fetch: vi.fn(() => json(201, { data: { ...notification, channels: notification.channels.slice(0, 1) } })) })
  await expect(api.submit('unit', '主旨', '內容', 'key')).rejects.toMatchObject({ code: 'invalid_sibling_channels' })
})
