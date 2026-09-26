import { useEffect, useRef, useState } from 'react'

import type { EntitlementCode } from '../../lib/operations-api'

export const weeklyReportCodes: EntitlementCode[] = ['bulletin.general.zh-Hant.access', 'bulletin.general.zh-Hans.access', 'bulletin.general.en.access']
export const weeklyReportLabels = ['繁體中文', '简体中文', 'English']

export function useManagedMutation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<'forbidden' | 'conflict' | 'failed' | null>(null)
  const inFlight = useRef(false)
  const keys = useRef(new Map<string, string>())
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function mutate(signature: string, execute: (key: string) => Promise<unknown>) {
    if (inFlight.current) return false
    inFlight.current = true
    setPending(true)
    setError(null)
    const key = keys.current.get(signature) ?? crypto.randomUUID()
    keys.current.set(signature, key)
    try {
      await execute(key)
      keys.current.delete(signature)
      return mounted.current
    } catch (reason) {
      if (mounted.current) {
        const status = reason instanceof Error && 'status' in reason ? Number(reason.status) : 0
        setError(status === 403 ? 'forbidden' : [409, 412].includes(status) ? 'conflict' : 'failed')
      }
      return false
    } finally {
      inFlight.current = false
      if (mounted.current) setPending(false)
    }
  }
  return { mutate, pending, error }
}
