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
    expect(readNativeAuthContinuation()).toBe('req/?# +&')
    clearNativeAuthContinuation()
    expect(readNativeAuthContinuation()).toBeNull()
  })
})
