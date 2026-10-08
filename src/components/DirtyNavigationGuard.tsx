import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export function DirtyNavigationGuard({
  dirty,
  message,
}: {
  dirty: boolean
  message: string
}) {
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker, message])
  return null
}
