const autoContinueKey = 'hhc_line_link_auto_continue'

let fragmentToken: string | null = null

export function captureLineLinkFragment() {
  if (window.location.pathname !== '/line/bind' || !window.location.hash) return

  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
  if (token) fragmentToken = token
}

export function getCapturedLineLinkToken() {
  return fragmentToken
}

export function discardCapturedLineLinkToken() {
  fragmentToken = null
}

export function markLineLinkAutoContinue() {
  try {
    sessionStorage.setItem(autoContinueKey, '1')
  } catch {
    // A blocked session store degrades to the explicit Continue state after sign-in.
  }
}

export function hasLineLinkAutoContinue() {
  try {
    return sessionStorage.getItem(autoContinueKey) === '1'
  } catch {
    return false
  }
}

export function consumeLineLinkAutoContinue() {
  const pending = hasLineLinkAutoContinue()
  clearLineLinkAutoContinue()
  return pending
}

export function clearLineLinkAutoContinue() {
  try {
    sessionStorage.removeItem(autoContinueKey)
  } catch {
    // Nothing to clear when the browser blocks session storage.
  }
}

export function navigateToLineAccountLink(
  value: string,
  replace: (url: string) => void = (url) => window.location.replace(url),
) {
  const canonicalReturn = value.match(/^https:\/\/line\.me\/R\/oaMessage\/%40[A-Za-z0-9._-]{1,32}\/\?HHC_ACCOUNT_LINK_V1%3A[A-Za-z0-9_-]{43}$/)?.[0]
  if (canonicalReturn === value) {
    replace(value)
    return true
  }

  try {
    const url = new URL(value)
    const valid = url.protocol === 'https:'
      && url.href === value
      && url.hostname === 'access.line.me'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname === '/dialog/bot/accountLink'
      && url.hash === ''
      && url.searchParams.getAll('linkToken').length === 1
      && Boolean(url.searchParams.get('linkToken'))
      && url.searchParams.getAll('nonce').length === 1
      && Boolean(url.searchParams.get('nonce'))
      && Array.from(url.searchParams).length === 2
    if (!valid) return false
    replace(value)
    return true
  } catch {
    return false
  }
}
