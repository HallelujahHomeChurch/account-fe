import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { authErrorMessage } from '../auth/auth-form'

export function ForgotPasswordPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
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
      await auth.api.forgotPassword(email)
      setMessage(t.passwordRecovery.sent)
    } catch (caught) {
      setError(authErrorMessage(caught, t.passwordRecovery.requestFailed, {
        ACC_REQUEST_INVALID: t.passwordRecovery.invalidEmail,
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
        <h1>{t.passwordRecovery.forgotTitle}</h1>
        <p>{t.passwordRecovery.forgotDescription}</p>
        </div>
        <div className="login-form-panel">
          {message ? <p className="form-notice" role="status">{message}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!message ? <Form className="form-stack" onSubmit={submit}>
            <TextField isRequired name="email" type="email">
              <Label>{t.passwordRecovery.email}</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <div className="login-actions">
              <Link className="muted-link" to="/login">
                {t.passwordRecovery.backToLogin}
              </Link>
              <Button isPending={isSubmitting} type="submit">
                {t.passwordRecovery.sendResetLink}
              </Button>
            </div>
          </Form> : (
            <Link className="muted-link" to="/login">{t.passwordRecovery.backToLogin}</Link>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
