import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { loginPath } from '../auth/auth-routes'
import { useLocale } from '../i18n/locale-context'
import {
  clearAccountOAuthTransaction,
  readAccountOAuthTransaction,
} from '../lib/redirects'

export function OAuthCallbackPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const handled = useRef(false)
  const [error, setError] = useState('')
  const returnTo = readAccountOAuthTransaction()?.returnTo ?? '/profile'

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const callbackError = params.get('error')
    if (callbackError) {
      clearAccountOAuthTransaction()
      navigate(`${loginPath(returnTo)}&oauth_error=${callbackError === 'access_denied' ? 'cancelled' : 'failed'}`, { replace: true })
      return
    }

    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setError(t.oauthCallback.failed)
      return
    }

    auth.completeOAuthCallback(code, state)
      .then((destination) => navigate(destination, { replace: true }))
      .catch(() => setError(t.oauthCallback.failed))
  }, [auth, navigate, params, returnTo, t.oauthCallback.failed])

  if (!error) {
    return <span className="hhc-sr-only" role="status">{t.oauthCallback.completing}</span>
  }

  return (
    <div className="oauth-callback-error">
      <p role="alert">{error}</p>
      <Button
        variant="primary"
        onPress={() => {
          clearAccountOAuthTransaction()
          void auth.startAuthorization(returnTo)
        }}
      >
        {t.oauthCallback.retry}
      </Button>
    </div>
  )
}
