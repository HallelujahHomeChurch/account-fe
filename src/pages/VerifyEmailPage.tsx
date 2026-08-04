import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'

export function VerifyEmailPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const handled = useRef(false)
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    if (!token || !auth.api.verifyEmail) {
      setError(t.emailVerification.tokenRequired)
      return
    }

    auth.api.verifyEmail(token)
      .then(() => setMessage(t.emailVerification.success))
      .catch((caught: unknown) => setError(errorMessage(caught, t.emailVerification.requestFailed)))
  }, [auth.api, t.emailVerification.requestFailed, t.emailVerification.success, t.emailVerification.tokenRequired, token])

  return (
    <section className="login-shell" aria-labelledby="verify-email-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="verify-email-title">{t.emailVerification.title}</h1>
          <p>{t.emailVerification.description}</p>
        </div>
        <div className="login-form-panel auth-result-state">
          {!message && !error ? <p className="inline-status" role="status">{t.emailVerification.verifying}</p> : null}
          {message ? <p className="form-notice" role="status">{message}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <Link className="muted-link" to="/login">
            {t.emailVerification.backToLogin}
          </Link>
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}

function errorMessage(caught: unknown, fallback: string) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return fallback
}
