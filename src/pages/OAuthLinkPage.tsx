import { Button, Card } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'

export function OAuthLinkPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
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
    <section className="auth-grid">
      <div className="page-heading">
        <h1>{t.oauthLink.title}</h1>
        {token && !message ? <p>{t.oauthLink.description}</p> : null}
      </div>
      <Card className="panel-card">
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {token && !message ? (
            <Button isPending={isSubmitting} onPress={() => void confirm()}>
              {t.oauthLink.confirm}
            </Button>
          ) : null}
          <Link className="muted-link" to="/login">
            {t.oauthLink.backToLogin}
          </Link>
        </Card.Content>
      </Card>
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
