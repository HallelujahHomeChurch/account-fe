import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSyncExternalStore } from 'react'
import { expect, it, vi } from 'vitest'
import type { EmailCorrectionRequest, EmailReauthView } from '@hallelujahhomechurch/account-client'
import { AccountApi } from '../../lib/api'
import { DataRequestsPage } from '../../pages/DataRequestsPage'
import { correctionCatalog } from './catalog'
import { CorrectionController } from './controller'

it('keeps replacement B through recovered creation and the rendered explicit Retry without changing existing A', async () => {
  const now = '2026-10-16T00:00:00Z'
  const prior: EmailCorrectionRequest = { id: 'A', kind: 'email_change', status: 'pending_verification', requestVersion: 3, currentEmail: 'owner@example.test', newEmail: 'a@example.test', expiresAt: '2026-10-23T00:00:00Z', serverTime: now, allowedActions: ['cancel', 'reapply', 'resend_verification'] }
  const intent: EmailReauthView = { kind: 'email_change', intentId: 'b'.repeat(43) + '=', requestVersion: 1, currentEmail: prior.currentEmail!, newEmail: 'b@example.test', methods: ['password'], mfaRequired: false, expiresAt: '2026-10-16T00:05:00Z', serverTime: now, allowedActions: ['password', 'cancel'], status: 'factor_required' }
  let token = 'old-token'
  let currentReads = 0
  const writes: Array<{ path: string; body: unknown; authorization: string | null }> = []
  const refresh = vi.fn(async () => 'fresh-token')
  const api = new AccountApi({ baseUrl: '/api/account/v1', getAccessToken: () => token, setAccessToken: value => { token = value ?? '' }, refreshAfterUnauthorized: refresh, fetcher: async (url, options) => {
    const path = String(url)
    let data: unknown
    let status = 200
    if (path.endsWith('/oauth-providers')) data = { dataRequests: { emailCorrection: { enabled: true } } }
    else if (path.endsWith('/requests/current')) { currentReads++; data = { request: prior, serverTime: now } }
    else if (path.endsWith('/items')) data = { currentEmail: prior.currentEmail, serverTime: now, items: [{ kind: 'email_change', fields: correctionCatalog[0].fields }], eligibility: { status: 'eligible' }, allowedActions: ['reauth'] }
    else if (path.endsWith('/csrf-token')) data = { csrf_token: 'csrf' }
    else if (path.endsWith('/reauth') && options?.method === 'POST') {
      writes.push({ path, body: JSON.parse(String(options.body)), authorization: new Headers(options.headers).get('authorization') })
      status = writes.length === 1 ? 401 : 200
      data = status === 401 ? { errorCode: 'ACC_AUTH_TOKEN_INVALID' } : intent
    } else throw new Error(`Unexpected request: ${options?.method} ${path}`)
    return new Response(JSON.stringify(data), { status })
  } })
  const controller = new CorrectionController(api.dataRequests, { eligible: true, currentEmail: prior.currentEmail! }, () => {})
  function ConnectedView() {
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    return <DataRequestsPage {...state} locale="en" onEmailChange={value => controller.edit(value)} onAction={(action, value) => { void controller.action(action, value) }} />
  }
  try {
    await controller.load()
    render(<ConnectedView />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start a replacement request' }))
    await user.type(screen.getByLabelText('New email'), 'b@example.test')
    await user.click(screen.getByRole('button', { name: 'Next: verify your identity' }))
    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByLabelText('New email')).toHaveValue('b@example.test')
    expect(refresh).toHaveBeenCalledOnce()
    expect(writes).toHaveLength(1) // Recovery itself never repeats the POST.
    await user.click(retry)
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes).toEqual([
      { path: '/api/account/v1/data-requests/reauth', body: { kind: 'email_change', newEmail: 'b@example.test' }, authorization: 'Bearer old-token' },
      { path: '/api/account/v1/data-requests/reauth', body: { kind: 'email_change', newEmail: 'b@example.test' }, authorization: 'Bearer fresh-token' },
    ])
    expect(screen.getByLabelText('Current password')).toBeVisible()
    expect(screen.getByText('b@example.test')).toBeVisible()
    expect(currentReads).toBe(1)
    expect(prior).toMatchObject({ id: 'A', status: 'pending_verification', requestVersion: 3, newEmail: 'a@example.test' })
  } finally { controller.dispose() }
})
