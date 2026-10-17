import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const destinations: Record<string, readonly string[]> = {
  '/profile': ['avatar', 'nickname', 'language', 'appearance', 'email-notifications'],
  '/security': ['password', 'linked-accounts', 'mfa', 'devices'],
}

export function AccountSectionFocus() {
  const location = useLocation()
  useEffect(() => {
    const id = location.hash.slice(1)
    if (!destinations[location.pathname]?.includes(id)) return
    let frame = 0
    const focus = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = document.getElementById(id)
        if (!target || document.querySelector('[role="dialog"], [role="alertdialog"]')) return
        target.scrollIntoView?.({ block: 'start', behavior: 'instant' })
        target.focus({ preventScroll: true })
        observer.disconnect()
      })
    }
    // Dialog portals can finish closing after the destination has rendered.
    const observer = new MutationObserver(focus)
    observer.observe(document.body, { childList: true, subtree: true })
    focus()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [location.key, location.pathname, location.hash])
  return null
}
