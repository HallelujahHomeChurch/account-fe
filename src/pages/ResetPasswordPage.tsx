import { Button, Card, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'

export function ResetPasswordPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetLink] = useState(() => {
    const values = new URLSearchParams(window.location.hash.slice(1))
    return {
      email: values.get('email') ?? '',
      token: values.get('token') ?? '',
    }
  })

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.resetPassword) return

    const form = new FormData(event.currentTarget)
    setMessage('')
    setError('')

    try {
      await auth.api.resetPassword({
        email: String(form.get('email') ?? ''),
        token: resetLink.token,
        new_password: String(form.get('new_password') ?? ''),
      })
      setMessage(t.passwordRecovery.resetSuccess)
    } catch (caught) {
      setError(errorMessage(caught, t.passwordRecovery.requestFailed))
    }
  }

  return (
    <section className="auth-grid">
      <div className="page-heading">
        <p className="eyebrow">{t.passwordRecovery.section}</p>
        <h1>{t.passwordRecovery.resetTitle}</h1>
        <p>{t.passwordRecovery.resetDescription}</p>
      </div>
      <Card className="panel-card">
        <Card.Header>
          <Card.Title>{t.passwordRecovery.newPassword}</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form className="form-stack" onSubmit={submit}>
            <TextField isRequired defaultValue={resetLink.email} name="email" type="email">
              <Label>{t.passwordRecovery.email}</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <TextField isRequired name="new_password" type="password">
              <Label>{t.passwordRecovery.newPassword}</Label>
              <Input autoComplete="new-password" />
              <FieldError />
            </TextField>
            <Button type="submit">{t.passwordRecovery.resetPassword}</Button>
          </Form>
        </Card.Content>
      </Card>
    </section>
  )
}

function errorMessage(caught: unknown, fallback: string) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return fallback
}
