const storageKey = 'hhc_native_auth_request_id'
const maxAgeMs = 24 * 60 * 60 * 1000

export type AuthContinuation = {
  requestId: string
  createdAt: number
  clientId?: string
  clientName?: string
}

type ContinuationOptions = {
  clientId?: string
  clientName?: string
  now?: () => number
}

export function saveNativeAuthContinuation(authRequestId: string, options: ContinuationOptions = {}) {
  localStorage.setItem(storageKey, JSON.stringify({
    requestId: authRequestId,
    createdAt: (options.now ?? Date.now)(),
    ...(options.clientId ? { clientId: options.clientId } : {}),
    ...(options.clientName ? { clientName: options.clientName } : {}),
  }))
}

export function readNativeAuthContinuation(options: Pick<ContinuationOptions, 'now'> = {}): AuthContinuation | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  const now = (options.now ?? Date.now)()
  try {
    const parsed = JSON.parse(raw) as Partial<AuthContinuation>
    if (typeof parsed.requestId !== 'string' || !Number.isFinite(parsed.createdAt)) throw new Error('invalid continuation')
    if (now - parsed.createdAt! > maxAgeMs) {
      clearNativeAuthContinuation()
      return null
    }
    return parsed as AuthContinuation
  } catch {
    if (raw.startsWith('{') || raw.startsWith('[')) {
      clearNativeAuthContinuation()
      return null
    }
    saveNativeAuthContinuation(raw, { now: () => now })
    return { requestId: raw, createdAt: now }
  }
}

export function clearNativeAuthContinuation() {
  localStorage.removeItem(storageKey)
}
