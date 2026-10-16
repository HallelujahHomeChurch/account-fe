import { afterEach, expect, it, vi } from 'vitest'
import { AccountApi } from '../../lib/api'
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
  expect(c.getSnapshot().retryAt).toBe(Date.now() + 45000)
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
  expect(c.getSnapshot()).toMatchObject({ view: 'intent_expired', newEmail: '', busy: false }); expect(submitted).toBe(0); c.dispose()
})

it('retains the live intent after actual transport refresh and reads it with the installed token without replaying the factor', async () => {
  let token = 'old-token'; let writes = 0
  const reads: string[] = []
  const transport = new AccountApi({ baseUrl: '/api/account/v1', getAccessToken: () => token, setAccessToken: value => { token = value ?? '' }, refreshAfterUnauthorized: async () => 'fresh-token', fetcher: async (url, options) => {
    let result: unknown = intent; let status = 200
    if (String(url).endsWith('/csrf-token')) result = { csrf_token: 'csrf' }
    else if (options?.method === 'POST') { writes++; result = { errorCode: 'ACC_AUTH_TOKEN_INVALID' }; status = 401 }
    else reads.push(new Headers(options?.headers).get('authorization') ?? '')
    return new Response(JSON.stringify(result), { status })
  } })
  const c = setup({ password: transport.dataRequests.password, restoreReauth: transport.dataRequests.restoreReauth })
  await c.load(intent.intentId); await c.action('password', 'secret')
  expect(token).toBe('fresh-token'); expect(writes).toBe(1)
  expect(reads).toEqual(['Bearer old-token', 'Bearer fresh-token'])
  expect(c.getSnapshot()).toMatchObject({ view: 'reauth', newEmail: 'new@example.test', passwordAvailable: true })
  c.dispose()
})
it('does not automatically submit a ready intent restored after a recovered factor', async () => {
  let submits = 0
  const c = setup({ password: async () => { throw { status: 401, authRecovered: true } }, restoreReauth: async () => ({ ...intent, status: 'ready', allowedActions: ['submit'], proof: 'proof', submissionNonce: 'nonce' }), submit: async () => { submits++; return row() } })
  await c.load(); await c.action('replace'); c.edit('new@example.test'); await c.action('next'); await c.action('password', 'secret')
  expect(submits).toBe(0); expect(c.getSnapshot()).toMatchObject({ view: 'checking', newEmail: 'new@example.test', error: 'unavailable' }); c.dispose()
})
it('reconciles a recovered submit by nonce without repeating the write', async () => {
  let submits = 0; const submission = vi.fn(async () => row('replacement', 1))
  const c = setup({ submit: async () => { submits++; throw { status: 401, authRecovered: true } }, submission })
  await c.load(intent.intentId); await c.action('password', 'secret'); await c.action('mfa', '123456')
  expect(submits).toBe(1); expect(submission).toHaveBeenCalledWith('nonce')
  expect(c.getSnapshot().view).toBe('pending_verification'); c.dispose()
})
it('fetches current replacement B version one from superseded A and ignores a late A query', async () => {
  let calls = 0; let release!: (value: { request: EmailCorrectionRequest; serverTime: string }) => void
  const old = { ...row('A', 4), status: 'superseded' as const, allowedActions: [] }
  const current = vi.fn(async () => {
    calls++
    if (calls === 1) return { request: old, serverTime: now }
    if (calls === 2) return new Promise<{ request: EmailCorrectionRequest; serverTime: string }>(resolve => { release = resolve })
    return { request: row('B', 1), serverTime: now }
  })
  const c = setup({ current }); await c.load()
  const stale = c.action('current')
  await c.load()
  release({ request: old, serverTime: now }); await stale
  expect(current).toHaveBeenCalledTimes(3)
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', newEmail: 'new@example.test' })
  c.dispose()
})

it('retains a new replacement draft when intent creation recovers without an intent ID', async () => {
  const createReauth = vi.fn(async () => { throw { status: 401, authRecovered: true } })
  const read = vi.fn(async () => row())
  const c = setup({ createReauth, request: read }); await c.load(); await c.action('replace'); c.edit('replacement@example.test'); await c.action('next')
  expect(createReauth).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled()
  expect(c.getSnapshot()).toMatchObject({ view: 'form', newEmail: 'replacement@example.test', error: 'unavailable' }); c.dispose()
})
it.each(['cancel', 'resend'] as const)('reconciles a recovered %s with the exact known request and no replay', async action => {
  const write = vi.fn(async () => { throw { status: 401, authRecovered: true } })
  const read = vi.fn(async () => row())
  const c = setup({ cancel: write, resendVerification: write, request: read }); await c.load(); await c.action(action)
  expect(write).toHaveBeenCalledOnce(); expect(read).toHaveBeenCalledWith('old')
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', newEmail: 'new@example.test', notice: undefined }); c.dispose()
})
it('fetches and displays replacement B version one when the superseded A action is selected', async () => {
  let replaced = false
  const current = vi.fn(async () => ({ request: replaced ? { ...row('B', 1), newEmail: 'replacement@example.test' } : { ...row('A', 4), status: 'superseded' as const }, serverTime: now }))
  const c = setup({ current }); await c.load(); replaced = true; await c.action('current')
  expect(current).toHaveBeenCalledTimes(2)
  expect(c.getSnapshot()).toMatchObject({ view: 'pending_verification', newEmail: 'replacement@example.test' }); c.dispose()
})

it.each(['pending_verification', 'completed'] as const)('retains owned %s when catalog becomes ineligible or disabled', async status => {
  for (const errorCode of ['ACC_CORRECTION_INELIGIBLE', 'ACC_CORRECTION_DISABLED'] as const) {
    const current = { ...row(), status, allowedActions: [] }
    const c = setup({ current: async () => ({ request: current, serverTime: now }), catalog: async () => ({ currentEmail: 'old@example.test', serverTime: now, items: [], eligibility: { status: 'ineligible', errorCode }, allowedActions: [] }) })
    try { await c.load(); expect(c.getSnapshot()).toMatchObject({ view: status, eligible: false }); if (errorCode === 'ACC_CORRECTION_DISABLED') expect(c.getSnapshot().enabled).toBe(false) }
    finally { c.dispose() }
  }
})
