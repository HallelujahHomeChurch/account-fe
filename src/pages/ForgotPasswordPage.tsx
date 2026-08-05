import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { authErrorMessage, validateEmail } from '../auth/auth-form'
import { AuthResultState } from '../components/AuthResultState'

export function ForgotPasswordPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
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
          <h1>{message ? t.passwordRecovery.sentTitle : t.passwordRecovery.forgotTitle}</h1>
          {!message ? <p>{t.passwordRecovery.forgotDescription}</p> : null}
        </div>
        <div className={`login-form-panel${message ? ' auth-result-state' : ''}`}>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!message ? <Form className="form-stack" onSubmit={submit}>
            <TextField isRequired name="email" type="email" validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
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
            <>
              <AuthResultState>{message}</AuthResultState>
              <Button onPress={() => navigate('/login', { replace: true })}>
                {t.passwordRecovery.backToLogin}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
