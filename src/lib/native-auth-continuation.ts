const storageKey = 'hhc_native_auth_request_id'

export function saveNativeAuthContinuation(authRequestId: string) {
  localStorage.setItem(storageKey, authRequestId)
}

export function readNativeAuthContinuation() {
  return localStorage.getItem(storageKey)
}

export function clearNativeAuthContinuation() {
  localStorage.removeItem(storageKey)
}
