import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearNativeAuthContinuation,
  readNativeAuthContinuation,
  saveNativeAuthContinuation,
} from './native-auth-continuation'

describe('native auth registration continuation', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips an opaque authorization request id', () => {
    saveNativeAuthContinuation('req/?# +&')
    expect(readNativeAuthContinuation()).toMatchObject({ requestId: 'req/?# +&' })
    clearNativeAuthContinuation()
    expect(readNativeAuthContinuation()).toBeNull()
  })

  it('stores bounded client metadata and removes expired data', () => {
    saveNativeAuthContinuation('req-1', { clientId: 'www-web', clientName: 'HHC Website', now: () => 100 })
    expect(readNativeAuthContinuation({ now: () => 200 })).toEqual({
      requestId: 'req-1', createdAt: 100, clientId: 'www-web', clientName: 'HHC Website',
    })
    expect(readNativeAuthContinuation({ now: () => 24 * 60 * 60 * 1000 + 101 })).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('migrates a legacy id and removes malformed JSON', () => {
    localStorage.setItem('hhc_native_auth_request_id', 'legacy-id')
    expect(readNativeAuthContinuation({ now: () => 100 })).toMatchObject({ requestId: 'legacy-id', createdAt: 100 })
    expect(localStorage.getItem('hhc_native_auth_request_id')).toContain('legacy-id')

    localStorage.setItem('hhc_native_auth_request_id', '{bad json')
    expect(readNativeAuthContinuation()).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})
