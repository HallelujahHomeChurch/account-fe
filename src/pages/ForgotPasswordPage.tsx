import { Button, Card, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { ApiError } from '../lib/api'

export function ForgotPasswordPage() {
  const auth = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.forgotPassword) return

    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    setMessage('')
    setError('')
    setIsSubmitting(true)

    try {
      const response = await auth.api.forgotPassword(email)
      setMessage(response.message ?? 'If the email exists, a reset link has been sent.')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-grid">
      <div className="page-heading">
        <p className="eyebrow">Password</p>
        <h1>Forgot password</h1>
        <p>Enter your email and we will send a reset link.</p>
      </div>
      <Card className="panel-card">
        <Card.Header>
          <Card.Title>Reset link</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form className="form-stack" onSubmit={submit}>
            <TextField isRequired name="email" type="email">
              <Label>Email</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <div className="login-actions">
              <Link className="muted-link" to="/login">
                Back to sign in
              </Link>
              <Button isPending={isSubmitting} type="submit">
                Send reset link
              </Button>
            </div>
          </Form>
        </Card.Content>
      </Card>
    </section>
  )
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
