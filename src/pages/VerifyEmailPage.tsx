import { Button, Card } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'

export function VerifyEmailPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  async function verify() {
    if (!auth.api.verifyEmail || isSubmitting) return
    if (!token) {
      setError(t.emailVerification.tokenRequired)
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      await auth.api.verifyEmail(token)
      setMessage(t.emailVerification.success)
    } catch (caught) {
      setMessage('')
      setError(errorMessage(caught, t.emailVerification.requestFailed))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-grid">
      <div className="page-heading">
        <h1>{t.emailVerification.title}</h1>
        <p>{t.emailVerification.description}</p>
      </div>
      <Card className="panel-card">
        <Card.Header>
          <Card.Title>{t.emailVerification.cardTitle}</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {!message ? (
            <Button isPending={isSubmitting} onPress={() => void verify()}>
              {t.emailVerification.verify}
            </Button>
          ) : null}
          <Link className="muted-link" to="/login">
            {t.emailVerification.backToLogin}
          </Link>
        </Card.Content>
      </Card>
    </section>
  )
}

function errorMessage(caught: unknown, fallback: string) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return fallback
}
