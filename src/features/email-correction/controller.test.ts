import { afterEach, expect, it, vi } from 'vitest'
import { CorrectionController, type CorrectionClient } from './controller'
import type { EmailCorrectionRequest, EmailReauthView } from '@hallelujahhomechurch/account-client'
const now = '2026-10-16T00:00:00Z'
const row = (id = 'old', requestVersion = 3): EmailCorrectionRequest => ({ id, kind: 'email_change', status: 'pending_verification', requestVersion, currentEmail: 'old@example.test', newEmail: 'new@example.test', expiresAt: '2026-10-23T00:00:00Z', serverTime: now, allowedActions: ['cancel', 'reapply', 'resend_verification'] })
const intent: EmailReauthView = { kind: 'email_change', intentId: 'a'.repeat(43) + '=', requestVersion: 1, currentEmail: 'old@example.test', newEmail: 'new@example.test', methods: ['password', 'google'], mfaRequired: true, expiresAt: '2026-10-16T00:05:00Z', serverTime: now, allowedActions: ['password', 'oauth', 'cancel'], status: 'factor_required' }
function setup(overrides: Partial<CorrectionClient> = {}) {
  const api = { capability: async () => ({ dataRequests: { emailCorrection: { enabled: true } } }), catalog: async () => ({ currentEmail: 'old@example.test', serverTime: now, items: [], eligibility: { status: 'eligible' }, allowedActions: ['reauth'] }), current: async () => ({ request: row(), serverTime: now }), createReauth: async () => intent, restoreReauth: async () => intent, cancelReauth: async () => { }, password: async () => ({ ...intent, status: 'mfa_required', allowedActions: ['mfa', 'cancel'] }), mfa: async () => ({ ...intent, status: 'ready', allowedActions: ['submit', 'cancel'], proof: 'proof', submissionNonce: 'nonce' }), submit: async () => row('new', 1), submission: async () => row('new', 1), ...overrides } as CorrectionClient
  return new CorrectionController(api, { eligible: true, currentEmail: 'old@example.test' }, () => { })
}
afterEach(() => vi.useRealTimers())
it('restores bounded server draft after OAuth and carries MFA into submission', async () => {
  const c = setup({ restoreReauth: async () => ({ ...intent, status: 'mfa_required', allowedActions: ['mfa', 'cancel'] }) })
  await c.load(intent.intentId)
  expect(c.getSnapshot()).toMatchObject({ view: 'mfa', newEmail: 'new@example.test' })
  await c.action('mfa', '123456')
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', newEmail: 'new@example.test' })
  c.dispose()
})
it('retains draft and old request on factor or replacement failure', async () => {
  const c = setup({ password: async () => { throw { status: 403, code: 'ACC_REAUTH_FACTOR_INVALID' } } })
  await c.load(); await c.action('replace'); c.edit('new@example.test'); await c.action('next'); await c.action('password', 'wrong')
  expect(c.getSnapshot()).toMatchObject({ view: 'reauth', newEmail: 'new@example.test', error: 'reauth' })
  await c.action('back'); await c.action('current')
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification' })
  c.dispose()
})
it('reconciles response loss by nonce without a duplicate submit and accepts replacement version one', async () => {
  let submits = 0
  const c = setup({ submit: async () => { submits++; throw new TypeError('lost') } })
  await c.load(); await c.action('replace'); c.edit('new@example.test'); await c.action('next'); await c.action('password', 'secret'); await c.action('mfa', '123456')
  expect(submits).toBe(1)
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', notice: 'queued' })
  c.dispose()
})
it('preserves authenticated screen on 503 and stops at neutral 401', async () => {
  let failure: unknown = null
  const c = setup({ current: async () => { if (failure) throw failure; return { request: row(), serverTime: now } } })
  await c.load(); failure = { status: 503 }; await c.refresh()
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', error: 'unavailable' })
  failure = { status: 401 }; await c.refresh()
  expect(c.getSnapshot()).toMatchObject({ view: 'unauthorized', newEmail: '' })
  c.dispose()
})
it('keeps existing request readable/cancellable while disabled and forbids new writes', async () => {
  let cancelled = false, created = false
  const c = setup({ capability: async () => ({ dataRequests: { emailCorrection: { enabled: false } } }), cancel: async () => { cancelled = true; return { ...row(), status: 'cancelled', requestVersion: 4, allowedActions: [] } }, createReauth: async () => { created = true; return intent } })
  await c.load(); await c.action('replace'); await c.action('next'); expect(created).toBe(false)
  await c.action('cancel'); expect(cancelled).toBe(true)
  expect(c.getSnapshot()).toMatchObject({ view: 'cancelled', enabled: false })
  c.dispose()
})
it('expires the server draft and erases secrets without browser storage', async () => {
  vi.useFakeTimers()
  const c = setup(); await c.load(intent.intentId); await vi.advanceTimersByTimeAsync(300001)
  expect(c.getSnapshot()).toMatchObject({ view: 'intent_expired', newEmail: '' })
  c.dispose()
})
it('rejects a late same-request version and never compares versions across different request IDs', async () => {
  let current = row()
  const c = setup({ current: async () => ({ request: current, serverTime: now }) })
  await c.load(); current = { ...row('old', 2), status: 'cancelled' }; await c.refresh()
  expect(c.getSnapshot().view).toBe('pending_verification')
  current = { ...row('replacement', 1), status: 'pending_approval' }; await c.refresh()
  expect(c.getSnapshot().view).toBe('pending_approval'); c.dispose()
})
it('honors Retry-After and allows only one foreground refresh in flight', async () => {
  vi.useFakeTimers(); let calls = 0; let fail = false
  const c = setup({ current: async () => { calls++; if (fail) throw { status: 429, retryAfter: '45' }; return { request: row(), serverTime: now } } })
  await c.load(); fail = true; await c.refresh(); await c.refresh(); expect(calls).toBe(2)
  await vi.advanceTimersByTimeAsync(44000); await c.refresh(); expect(calls).toBe(2)
  await vi.advanceTimersByTimeAsync(1000); fail = false; await c.refresh(); expect(calls).toBe(3); c.dispose()
})
it('does not submit a draft for an inactive or unverified account', async () => {
  let writes = 0
  const client = { capability: async () => ({ dataRequests: { emailCorrection: { enabled: true } } }), current: async () => ({ request: null, serverTime: now }), catalog: async () => ({ currentEmail: 'old@example.test', serverTime: now, items: [], eligibility: { status: 'eligible' }, allowedActions: ['reauth'] }), createReauth: async () => { writes++; return intent } } as unknown as CorrectionClient
  const c = new CorrectionController(client, { eligible: false, currentEmail: 'old@example.test' }, () => { })
  await c.load(); c.edit('new@example.test'); await c.action('next'); expect(writes).toBe(0); c.dispose()
})
it('returns a rejected replacement target to its editable draft without cancelling the existing request', async () => {
  let cancels = 0
  const c = setup({ submit: async () => { throw { status: 409, code: 'ACC_CORRECTION_TARGET_UNAVAILABLE' } }, cancel: async () => { cancels++; return row() } })
  await c.load(); await c.action('replace'); c.edit('new@example.test'); await c.action('next'); await c.action('password', 'secret'); await c.action('mfa', '123456')
  expect(c.getSnapshot()).toMatchObject({ view: 'form', newEmail: 'new@example.test', error: 'email' })
  expect(cancels).toBe(0); await c.action('current'); expect(c.getSnapshot().view).toBe('pending_verification'); c.dispose()
})
it('does not revive an expired intent from a late factor response', async () => {
  vi.useFakeTimers(); let release!: (value: EmailReauthView) => void; let submitted = 0
  const c = setup({ password: () => new Promise(resolve => { release = resolve }), submit: async () => { submitted++; return row() } })
  await c.load(intent.intentId); const pending = c.action('password', 'secret')
  await vi.advanceTimersByTimeAsync(300001)
  release({ ...intent, status: 'ready', allowedActions: ['submit'], proof: 'proof', submissionNonce: 'nonce' }); await pending
  expect(c.getSnapshot()).toMatchObject({ view: 'intent_expired', newEmail: '' }); expect(submitted).toBe(0); c.dispose()
})
