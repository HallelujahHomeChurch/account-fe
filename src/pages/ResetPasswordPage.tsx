import { Button, Card, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { ApiError } from '../lib/api'

export function ResetPasswordPage() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.resetPassword) return

    const form = new FormData(event.currentTarget)
    setMessage('')
    setError('')

    try {
      const response = await auth.api.resetPassword({
        email: String(form.get('email') ?? ''),
        token: String(form.get('token') ?? ''),
        new_password: String(form.get('new_password') ?? ''),
      })
      setMessage(response.message ?? 'Password reset.')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <section className="auth-grid">
      <div className="page-heading">
        <p className="eyebrow">Password</p>
        <h1>Reset password</h1>
        <p>Use the reset token from your email.</p>
      </div>
      <Card className="panel-card">
        <Card.Header>
          <Card.Title>New password</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form className="form-stack" onSubmit={submit}>
            <TextField isRequired defaultValue={searchParams.get('email') ?? ''} name="email" type="email">
              <Label>Email</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <TextField isRequired defaultValue={searchParams.get('token') ?? ''} name="token">
              <Label>Reset token</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField isRequired name="new_password" type="password">
              <Label>New password</Label>
              <Input autoComplete="new-password" />
              <FieldError />
            </TextField>
            <Button type="submit">Reset password</Button>
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
