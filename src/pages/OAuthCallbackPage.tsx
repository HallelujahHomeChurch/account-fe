import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { clearPostLoginReturnTo, loginPath } from '../auth/auth-routes'
import { LanguageSelector } from '../components/LanguageSelector'
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
  const [showPending, setShowPending] = useState(false)
  const returnTo = readAccountOAuthTransaction()?.returnTo ?? '/profile'

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const callbackError = params.get('error')
    if (callbackError) {
      clearAccountOAuthTransaction()
      clearPostLoginReturnTo()
      navigate(`${loginPath(returnTo)}&oauth_error=${callbackError === 'access_denied' ? 'cancelled' : 'failed'}`, { replace: true })
      return
    }

    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      clearPostLoginReturnTo()
      setError(t.oauthCallback.failed)
      return
    }

    auth.completeOAuthCallback(code, state)
      .then((destination) => navigate(destination, { replace: true }))
      .catch(() => {
        clearPostLoginReturnTo()
        setError(t.oauthCallback.failed)
      })
  }, [auth, navigate, params, returnTo, t.oauthCallback.failed])

  useEffect(() => {
    const timer = window.setTimeout(() => setShowPending(true), 350)
    return () => window.clearTimeout(timer)
  }, [])

  if (!error && !showPending) {
    return <span className="hhc-sr-only" role="status">{t.oauthCallback.completing}</span>
  }

  return (
    <section className="login-shell" aria-labelledby="oauth-callback-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="oauth-callback-title">{t.login.brandTitle}</h1>
        </div>
        <div className="login-form-panel auth-result-state">
          {error ? (
            <>
              <p className="form-error" role="alert">{error}</p>
              <div className="login-actions">
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
            </>
          ) : (
            <p className="inline-status" role="status">{t.oauthCallback.completing}</p>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
