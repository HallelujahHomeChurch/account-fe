import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { readRuntimeConfig } from '../lib/redirects'
import { Turnstile } from '../components/Turnstile'

export function RegisterPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.register) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirm_password') ?? '')) {
      setError(t.registration.passwordMismatch)
      return
    }
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await auth.api.register({
        email: String(form.get('email') ?? ''),
        password,
        first_name: String(form.get('first_name') ?? ''),
        last_name: String(form.get('last_name') ?? ''),
        turnstile_token: turnstileToken || undefined,
      })
      setNotice(t.registration.success)
      event.currentTarget.reset()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.registration.failed)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell" aria-labelledby="register-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="register-title">{t.registration.title}</h1>
          <p>{t.registration.description}</p>
        </div>
        <div className="login-form-panel">
          {notice ? <p className="form-notice">{notice}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form className="form-stack" onSubmit={submit}>
            <div className="auth-name-fields">
              <TextField isRequired name="first_name">
                <Label>{t.registration.firstName}</Label>
                <Input autoComplete="given-name" />
                <FieldError />
              </TextField>
              <TextField isRequired name="last_name">
                <Label>{t.registration.lastName}</Label>
                <Input autoComplete="family-name" />
                <FieldError />
              </TextField>
            </div>
            <TextField isRequired name="email" type="email">
              <Label>{t.registration.email}</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <TextField isRequired name="password" type="password">
              <Label>{t.registration.password}</Label>
              <Input autoComplete="new-password" />
              <FieldError />
            </TextField>
            <TextField isRequired name="confirm_password" type="password">
              <Label>{t.registration.confirmPassword}</Label>
              <Input autoComplete="new-password" />
              <FieldError />
            </TextField>
            <Turnstile siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
            <div className="login-actions auth-actions-between">
              <Link className="muted-link" to="/login">{t.registration.backToLogin}</Link>
              <Button isDisabled={Boolean(turnstileSiteKey && !turnstileToken)} isPending={isSubmitting} type="submit">{t.registration.submit}</Button>
            </div>
          </Form>
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
