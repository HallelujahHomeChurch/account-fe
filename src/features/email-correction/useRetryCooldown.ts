import { useEffect, useState } from 'react'

// Wake once at the server deadline; the visible copy is a timestamp, not a live countdown.
export function useRetryCooldown(retryAt?: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(retryAt - Date.now(), 2147483647))
    return () => clearTimeout(timer)
  }, [retryAt, now])
  return Boolean(retryAt && retryAt > Math.max(now, Date.now()))
}
