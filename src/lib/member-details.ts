import { CompactEncrypt, compactDecrypt, importJWK, type JWK } from 'jose'

const path = '/api/account/v1/member-details'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const etagPattern = /^"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"$/
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
export type MemberDetails = { familyName: string | null; givenName: string | null; gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null; identityDocument: string | null; mobile: string | null }
export type MemberTransportFetch = (path: '/member-details' | '/member-details/transport-key', init: RequestInit) => Promise<Response>
export class MemberDetailsError extends Error {
  readonly code: string
  readonly status: number
  readonly uncertain: boolean
  constructor(code: string, status = 0, uncertain = false) { super('Member details request could not be completed'); this.name = 'MemberDetailsError'; this.code = code; this.status = status; this.uncertain = uncertain }
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function exact(value: unknown, fields: string[]): value is Record<string, unknown> { return object(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field)) }
function base64(raw: Uint8Array) { return btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') }
async function readBody(response: Response, limit: number) {
  const reader = response.body?.getReader()
  if (!reader) throw new MemberDetailsError('invalid_response')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) { void reader.cancel().catch(() => undefined); throw new MemberDetailsError('invalid_response') }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
    return decoder.decode(body)
  } finally { reader.releaseLock() }
}
export function isMemberCsrfFailure(code: string) {
  return ['ACC_AUTH_CSRF_INVALID', 'ACC_CSRF_TOKEN_INVALID', 'ACC_CSRF_TOKEN_MISSING'].includes(code)
}
export async function memberCsrfFailure(response: Response): Promise<string | undefined> {
  if (response.status !== 403 || response.headers.get('content-type')?.split(';')[0] !== 'application/json') return
  try {
    const data: unknown = JSON.parse(await readBody(response, 4096))
    if (object(data) && typeof data.error_code === 'string' && isMemberCsrfFailure(data.error_code)) return data.error_code
  } catch { /* Malformed errors never authorize a retry. */ }
}
export function isMemberDetails(value: unknown): value is MemberDetails {
  if (!exact(value, ['familyName', 'givenName', 'gender', 'identityDocument', 'mobile'])) return false
  return Object.values(value).every(item => item === null || typeof item === 'string') && (value.gender === null || ['male', 'female', 'other', 'prefer_not_to_say'].includes(String(value.gender))) && [value.familyName, value.givenName].every(item => item === null || [...String(item)].length <= 128) && (value.identityDocument === null || /^[A-Z][12][0-9]{8}$/.test(String(value.identityDocument))) && (value.mobile === null || /^\+[1-9][0-9]{1,14}$/.test(String(value.mobile)))
}

// Keys and plaintext are scoped to one request. No persistent cache, blind write
// retry or reuse of a response key; uncertain writes must be reconciled by GET.
export class MemberDetailsClient {
  private readonly send: MemberTransportFetch
  private readonly subject: string
  private sessionId: string | null = null
  constructor(send: MemberTransportFetch, subject: string) { this.send = send; this.subject = subject }
  async load(signal: AbortSignal): Promise<{ details: MemberDetails | null; etag: string | null }> {
    const result = await this.request('GET', null, null, signal)
    if (!exact(result.payload, ['details']) || (result.payload.details !== null && !isMemberDetails(result.payload.details)) || (result.payload.details === null ? result.etag !== null : result.etag === null)) throw new MemberDetailsError('invalid_response')
    return { details: result.payload.details as MemberDetails | null, etag: result.etag }
  }
  async save(details: MemberDetails, etag: string | null, signal: AbortSignal) {
    if (!isMemberDetails(details)) throw new MemberDetailsError('ACC_MEMBER_DETAILS_INVALID', 400)
    const result = await this.request('PUT', details, etag, signal)
    if (!exact(result.payload, ['saved']) || result.payload.saved !== true || result.etag === null) throw new MemberDetailsError('invalid_response', 0, true)
    return result.etag
  }
  async remove(etag: string, signal: AbortSignal) {
    const result = await this.request('DELETE', null, etag, signal)
    if (!exact(result.payload, ['deleted']) || result.payload.deleted !== true || result.etag !== null) throw new MemberDetailsError('invalid_response', 0, true)
  }
  private async request(method: 'GET' | 'PUT' | 'DELETE', payload: MemberDetails | null, etag: string | null, signal: AbortSignal) {
    let sent = false
    const responseKey = crypto.getRandomValues(new Uint8Array(32))
    try {
      signal.throwIfAborted()
      if (etag !== null && !etagPattern.test(etag) || method === 'DELETE' && etag === null) throw new MemberDetailsError('invalid_precondition')
      const bootstrapResponse = await this.send('/member-details/transport-key', { method: 'GET', signal, cache: 'no-store' })
      if (!bootstrapResponse.ok) throw new MemberDetailsError('unavailable', bootstrapResponse.status)
      const bootstrap: unknown = JSON.parse(await readBody(bootstrapResponse, 4096))
      const now = Math.floor(Date.now() / 1000)
      if (!exact(bootstrap, ['version', 'subject', 'sessionId', 'keyId', 'publicJwk', 'expiresAt']) || bootstrap.version !== 1 || bootstrap.subject !== this.subject || typeof bootstrap.sessionId !== 'string' || !/^[0-9a-f]{64}$/.test(bootstrap.sessionId) || typeof bootstrap.keyId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(bootstrap.keyId) || !Number.isSafeInteger(bootstrap.expiresAt) || Number(bootstrap.expiresAt) <= now || Number(bootstrap.expiresAt) > now + 120 || !exact(bootstrap.publicJwk, ['kty', 'n', 'e', 'alg', 'kid', 'use']) || bootstrap.publicJwk.kty !== 'RSA' || bootstrap.publicJwk.e !== 'AQAB' || bootstrap.publicJwk.alg !== 'RSA-OAEP-256' || bootstrap.publicJwk.kid !== bootstrap.keyId || bootstrap.publicJwk.use !== 'enc' || typeof bootstrap.publicJwk.n !== 'string' || !/^[A-Za-z0-9_-]{512}$/.test(bootstrap.publicJwk.n)) throw new MemberDetailsError('invalid_response')
      if (method !== 'GET' && this.sessionId !== bootstrap.sessionId) throw new MemberDetailsError('session_changed', 401)
      const key = await importJWK(bootstrap.publicJwk as JWK, 'RSA-OAEP-256')
      const precondition = method === 'GET' ? null : etag === null ? { ifNoneMatch: '*' } : { ifMatch: etag.slice(1, -1) }
      const request = { version: 1, subject: this.subject, sessionId: bootstrap.sessionId, method, path, operationId: `${now}.${crypto.randomUUID()}`, messageId: crypto.randomUUID(), issuedAt: now, expiresAt: Math.min(now + 120, Number(bootstrap.expiresAt)), precondition, responseKey: base64(responseKey), payload }
      const wire = await new CompactEncrypt(encoder.encode(JSON.stringify(request))).setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM', typ: 'hhc-member-request+jwe', kid: bootstrap.keyId }).encrypt(key)
      const headers: Record<string, string> = { accept: 'application/jose' }
      if (method === 'PUT') headers['Content-Type'] = 'application/jose'
      else headers['X-HHC-Member-Envelope'] = wire
      if (method !== 'GET') headers[etag === null ? 'If-None-Match' : 'If-Match'] = etag ?? '*'
      signal.throwIfAborted()
      sent = true
      const response = await this.send('/member-details', { method, headers, body: method === 'PUT' ? wire : undefined, signal, cache: 'no-store' })
      signal.throwIfAborted()
      const body = await readBody(response, 16384)
      if (response.headers.get('content-type')?.split(';')[0] !== 'application/jose') {
        if (response.ok) throw new MemberDetailsError('invalid_response', 0, method !== 'GET')
        let code = 'unavailable'
        try { const data: unknown = JSON.parse(body); if (object(data) && typeof data.error_code === 'string' && isMemberCsrfFailure(data.error_code) && response.status === 403) code = data.error_code } catch { /* Only allowlisted error codes leave this boundary. */ }
        throw new MemberDetailsError(code, response.status, response.status >= 500 && method !== 'GET')
      }
      const { plaintext, protectedHeader } = await compactDecrypt(body, responseKey, { keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] })
      if (!exact(protectedHeader, ['alg', 'enc', 'typ']) || protectedHeader.typ !== 'hhc-member-response+jwe' || plaintext.length > 8192) throw new MemberDetailsError('invalid_response', 0, method !== 'GET')
      let decoded: unknown
      try { decoded = JSON.parse(decoder.decode(plaintext)) } finally { plaintext.fill(0) }
      const nowResponse = Math.floor(Date.now() / 1000)
      if (!exact(decoded, ['version', 'subject', 'sessionId', 'operationId', 'messageId', 'method', 'path', 'status', 'etag', 'issuedAt', 'expiresAt', 'payload']) || decoded.version !== 1 || decoded.subject !== request.subject || decoded.sessionId !== request.sessionId || decoded.operationId !== request.operationId || decoded.messageId !== request.messageId || !uuid.test(String(decoded.messageId)) || decoded.method !== method || decoded.path !== path || decoded.status !== response.status || decoded.etag !== (response.headers.get('ETag') ?? '') || !Number.isSafeInteger(decoded.issuedAt) || !Number.isSafeInteger(decoded.expiresAt) || Number(decoded.issuedAt) < nowResponse - 150 || Number(decoded.issuedAt) > nowResponse + 30 || Number(decoded.expiresAt) <= Number(decoded.issuedAt) || Number(decoded.expiresAt) > Number(decoded.issuedAt) + 120 || Number(decoded.expiresAt) > request.expiresAt || Number(decoded.expiresAt) <= nowResponse || request.expiresAt <= nowResponse) throw new MemberDetailsError('invalid_response', 0, method !== 'GET')
      signal.throwIfAborted()
      if (!response.ok) {
        if (!exact(decoded.payload, ['error_code']) || typeof decoded.payload.error_code !== 'string' || !/^ACC_[A-Z_]+$/.test(decoded.payload.error_code)) throw new MemberDetailsError('invalid_response', 0, method !== 'GET')
        throw new MemberDetailsError(decoded.payload.error_code, response.status, response.status >= 500 && method !== 'GET')
      }
      const version = response.headers.get('ETag')
      if (version !== null && !etagPattern.test(version)) throw new MemberDetailsError('invalid_response', 0, method !== 'GET')
      if (method === 'GET') this.sessionId = bootstrap.sessionId
      return { payload: decoded.payload, etag: version }
    } catch (error) {
      if (signal.aborted) throw signal.reason
      if (error instanceof MemberDetailsError) throw sent && method !== 'GET' && error.status === 0 ? new MemberDetailsError(error.code, 0, true) : error
      throw new MemberDetailsError('unavailable', 0, sent && method !== 'GET')
    } finally { responseKey.fill(0) }
  }
}
