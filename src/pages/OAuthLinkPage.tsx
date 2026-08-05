import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { AuthResultState } from '../components/AuthResultState'

export function OAuthLinkPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [message, setMessage] = useState(searchParams.get('status') === 'pending' ? t.oauthLink.pending : '')
  const [error, setError] = useState(token || message ? '' : t.oauthLink.invalid)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  async function confirm() {
    if (!auth.api.confirmOAuthLink || !token || isSubmitting) return

    setError('')
    setIsSubmitting(true)
    try {
      await auth.api.confirmOAuthLink(token)
      setMessage(t.oauthLink.success)
    } catch (caught) {
      setError(linkError(caught, t.oauthLink))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell" aria-labelledby="oauth-link-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="oauth-link-title">{t.oauthLink.title}</h1>
          {token && !message ? <p>{t.oauthLink.description}</p> : null}
        </div>
        <div className="login-form-panel auth-result-state">
          {message ? <AuthResultState>{message}</AuthResultState> : null}
          {error ? <AuthResultState tone="danger">{error}</AuthResultState> : null}
          {token && !message && !error ? (
            <div className="login-actions">
              <Button isPending={isSubmitting} onPress={() => void confirm()}>
                {t.oauthLink.confirm}
              </Button>
            </div>
          ) : null}
          {message || error ? (
            <Button onPress={() => navigate('/login', { replace: true })}>{t.oauthLink.backToLogin}</Button>
          ) : (
            <Link className="muted-link" to="/login">{t.oauthLink.backToLogin}</Link>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}

function linkError(
  caught: unknown,
  messages: { invalid: string; conflict: string; unavailable: string },
) {
  if (caught instanceof ApiError) {
    if (caught.status === 410) return messages.invalid
    if (caught.status === 409) return messages.conflict
  }
  return messages.unavailable
}
