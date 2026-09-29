/* oxlint-disable react/only-export-components */
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUpRight, PanelTopOpen } from 'lucide-react'

import { useLocale } from '../i18n/locale-context'

const dismissalKey = 'hhc:account:line-browser-notice:dismissed'
const excludedPaths = new Set([
  '/oauth/callback', '/native-auth-complete', '/oauth/link', '/oauth/onboarding',
  '/policy/acceptance', '/line/bind',
])

export const isLineBrowser = (userAgent: string) => /\bLINE\/\d/i.test(userAgent)

export function externalBrowserHref(path: string, origin: string): string {
  const url = new URL(path, origin)
  url.searchParams.set('openExternalBrowser', '1')
  return url.href
}

export function LineBrowserNotice() {
  const location = useLocation()
  const { messages } = useLocale()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissalKey) === '1' } catch { return false }
  })

  const tokenRoute = location.pathname === '/verify-email' || location.pathname === '/reset-password'
  const hasToken = new URLSearchParams(location.search).has('token') || new URLSearchParams(location.hash.slice(1)).has('token')
  if (!isLineBrowser(navigator.userAgent) || dismissed || excludedPaths.has(location.pathname) || (tokenRoute && hasToken)) return null

  const isAuthRequest = location.pathname === '/login' && new URLSearchParams(location.search).has('auth_request_id')
  const copy = messages.lineBrowser
  function close() {
    setDismissed(true)
    try { sessionStorage.setItem(dismissalKey, '1') } catch { /* Keep the current page dismissed. */ }
  }

  return <aside className="line-browser-notice" aria-label={copy.region}>
    <div className="line-browser-notice__content">
      <span className="line-browser-notice__icon" aria-hidden="true"><PanelTopOpen size={21} /></span>
      <div className="line-browser-notice__copy"><strong>{copy.title}</strong><p>{copy.description}</p></div>
      <button className="line-browser-notice__close" type="button" onClick={close} aria-label={copy.close}>×</button>
      {isAuthRequest
        ? <span className="line-browser-notice__manual line-browser-notice__manual--restart">{copy.restartAuth}</span>
        : <a className="line-browser-notice__action" href={externalBrowserHref(`${location.pathname}${location.search}${location.hash}`, window.location.origin)}>{copy.open}<ArrowUpRight size={17} aria-hidden="true" /></a>}
      <span className="line-browser-notice__manual">{copy.manual}</span>
    </div>
  </aside>
}
