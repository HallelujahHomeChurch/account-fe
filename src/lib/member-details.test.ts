import { webcrypto } from 'node:crypto'
import { CompactEncrypt, compactDecrypt, exportJWK, generateKeyPair } from 'jose'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemberDetailsClient, MemberDetailsError, type MemberTransportFetch } from './member-details'

const subject = 'c4015644-700b-4385-934e-d928bb8b93a3'
const sessionId = 'a'.repeat(64)
const etag = '"b021b2c8-40b5-4f6a-8051-c30f6d0e9d22"'
const details = { familyName: 'SyntheticPrivate', givenName: null, gender: null, identityDocument: null, mobile: null }
const encoder = new TextEncoder()
let keys: Awaited<ReturnType<typeof generateKeyPair>>
let publicJwk: Awaited<ReturnType<typeof exportJWK>>

beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto)
  // jsdom's typed arrays differ from Node TextEncoder/WebCrypto's realm.
  vi.stubGlobal('Uint8Array', new TextEncoder().encode('').constructor)
  keys = await generateKeyPair('RSA-OAEP-256', { modulusLength: 3072, extractable: true })
  publicJwk = await exportJWK(keys.publicKey)
})
afterAll(() => vi.unstubAllGlobals())
afterEach(() => vi.useRealTimers())

function fixture(scenario = '') {
  let currentSession = sessionId
  const calls: RequestInit[] = []
  const requests: Record<string, unknown>[] = []
  const send: MemberTransportFetch = async (path, init) => {
    if (path.endsWith('/transport-key')) return Response.json({ version: 1, subject: scenario === 'bootstrap-owner' ? 'different' : subject, sessionId: currentSession, keyId: 'transport-v1', expiresAt: Math.floor(Date.now() / 1000) + 120, publicJwk: { kty: publicJwk.kty, n: publicJwk.n, e: publicJwk.e, alg: 'RSA-OAEP-256', kid: 'transport-v1', use: 'enc' } })
    calls.push(init)
    const wire = init.body ?? new Headers(init.headers).get('X-HHC-Member-Envelope')
    expect(typeof wire).toBe('string')
    expect(String(wire)).not.toContain('SyntheticPrivate')
    const { plaintext } = await compactDecrypt(String(wire), keys.privateKey, { keyManagementAlgorithms: ['RSA-OAEP-256'], contentEncryptionAlgorithms: ['A256GCM'] })
    const request = JSON.parse(new TextDecoder().decode(plaintext))
    requests.push(request)
    const key = Uint8Array.from(Buffer.from(request.responseKey, 'base64url'))
    const response = { version: 1, subject, sessionId: request.sessionId, operationId: request.operationId, messageId: request.messageId, method: request.method, path: request.path, status: 200, etag: request.method === 'DELETE' ? '' : etag, issuedAt: request.issuedAt, expiresAt: request.expiresAt, payload: request.method === 'GET' ? { details } : request.method === 'PUT' ? { saved: true } : { deleted: true } }
    if (scenario === 'owner') response.subject = 'different'
    if (scenario === 'message') response.messageId = crypto.randomUUID()
    if (scenario === 'method') response.method = 'DELETE'
    if (scenario === 'status') response.status = 201
    if (scenario === 'etag') response.etag = ''
    if (scenario === 'expired') response.expiresAt = response.issuedAt - 60
    if (scenario === 'unknown-field') Object.assign(response, { unexpected: true })
    if (scenario === 'wrong-key') key[0] ^= 1
    if (scenario === 'lost-write' && request.method !== 'GET') throw new Error('network error with unsafe details')
    if (request.method === 'PUT' && scenario === 'large-body') return new Response('x'.repeat(16385), { headers: { 'Content-Type': 'application/jose' } })
    if (request.method === 'PUT' && scenario === 'missing-body') return new Response(null, { headers: { 'Content-Type': 'application/jose' } })
    if (request.method === 'PUT' && scenario === 'csrf') return Response.json({ error_code: 'ACC_CSRF_TOKEN_INVALID', message: 'invalid CSRF' }, { status: 403 })
    if (request.method === 'PUT' && ['expiry-boundary', 'late-response'].includes(scenario)) vi.setSystemTime((request.expiresAt + (scenario === 'late-response' ? 1 : 0)) * 1000)
    const sealed = await new CompactEncrypt(encoder.encode(JSON.stringify(response))).setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'hhc-member-response+jwe' }).encrypt(key)
    return new Response(sealed, { status: 200, headers: { 'Content-Type': 'application/jose', ...(response.method === 'DELETE' ? {} : { ETag: etag }) } })
  }
  return { client: new MemberDetailsClient(send, subject), calls, requests, setSession: (next: string) => { currentSession = next } }
}

describe('member transport', () => {
  it('encrypts normal owner actions with a new key/message per call', async () => {
    const { client, calls, requests } = fixture()
    const signal = new AbortController().signal
    expect(await client.load(signal)).toEqual({ details, etag })
    expect(await client.save(details, null, signal)).toBe(etag)
    await client.remove(etag, signal)
    expect(calls.map(call => call.method)).toEqual(['GET', 'PUT', 'DELETE'])
    expect(requests.map(request => request.precondition)).toEqual([null, { ifNoneMatch: '*' }, { ifMatch: etag.slice(1, -1) }])
    expect(new Set(requests.map(request => request.responseKey)).size).toBe(3)
    expect(new Set(requests.map(request => request.messageId)).size).toBe(3)
  })
  it.each(['bootstrap-owner', 'owner', 'message', 'method', 'status', 'etag', 'expired', 'unknown-field', 'wrong-key'])('rejects %s without exposing response plaintext', async scenario => {
    const { client, calls } = fixture(scenario)
    await expect(client.load(new AbortController().signal)).rejects.toThrow('Member details request could not be completed')
    expect(calls).toHaveLength(scenario === 'bootstrap-owner' ? 0 : 1)
  })
  it('reports a lost write as uncertain and never retries it', async () => {
    const { client, calls } = fixture('lost-write')
    await client.load(new AbortController().signal)
    await expect(client.save(details, null, new AbortController().signal)).rejects.toMatchObject({ uncertain: true })
    expect(calls).toHaveLength(2)
  })
  it('aborts before any encrypted action is sent', async () => {
    const { client, calls } = fixture()
    const controller = new AbortController(); controller.abort()
    await expect(client.load(controller.signal)).rejects.not.toBeInstanceOf(MemberDetailsError)
    expect(calls).toHaveLength(0)
  })
})

it.each(['large-body', 'missing-body', 'expiry-boundary', 'late-response'])('requires reconciliation after a sent PUT with %s', async scenario => {
 vi.useFakeTimers({ toFake: ['Date'] })
 const { client, calls } = fixture(scenario)
 const signal = new AbortController().signal
 await client.load(signal)
 await expect(client.save(details, etag, signal)).rejects.toMatchObject({ uncertain: true })
 expect(calls).toHaveLength(2)
})
it('fences the old editor after a same-owner session replacement', async () => {
 const { client, calls, setSession } = fixture()
 const signal = new AbortController().signal
 await client.load(signal)
 setSession('b'.repeat(64))
 await expect(client.save(details, etag, signal)).rejects.toMatchObject({ code: 'session_changed', status: 401 })
 expect(calls).toHaveLength(1)
 await client.load(signal)
 await expect(client.save(details, etag, signal)).resolves.toBe(etag)
})
it('distinguishes a CSRF rejection from membership revocation without retry', async () => {
 const { client, calls } = fixture('csrf')
 const signal = new AbortController().signal
 await client.load(signal)
 await expect(client.save(details, etag, signal)).rejects.toMatchObject({ code: 'ACC_CSRF_TOKEN_INVALID', status: 403, uncertain: false })
 expect(calls).toHaveLength(2)
})
