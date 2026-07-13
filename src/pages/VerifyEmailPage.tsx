import { Card } from '@hhc/ui'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { ApiError } from '../lib/api'

export function VerifyEmailPage() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Verifying email...')
  const [error, setError] = useState('')
  const token = searchParams.get('token') ?? ''

  useEffect(() => {
    let alive = true

    async function verify() {
      if (!auth.api.verifyEmail) return
      if (!token) {
        setMessage('')
        setError('Verification token is required.')
        return
      }

      try {
        const response = await auth.api.verifyEmail(token)
        if (!alive) return
        setMessage(response.message ?? 'Email verified successfully')
      } catch (caught) {
        if (!alive) return
        setMessage('')
        setError(errorMessage(caught))
      }
    }

    void verify()
    return () => {
      alive = false
    }
  }, [auth.api, token])

  return (
    <section className="auth-grid">
      <div className="page-heading">
        <p className="eyebrow">Email</p>
        <h1>Verify email</h1>
        <p>Confirm this email address for your HHC account.</p>
      </div>
      <Card className="panel-card">
        <Card.Header>
          <Card.Title>Email verification</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Link className="muted-link" to="/login">
            Back to sign in
          </Link>
        </Card.Content>
      </Card>
    </section>
  )
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
