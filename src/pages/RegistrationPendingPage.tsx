import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { authErrorMessage, validateEmail } from '../auth/auth-form'
import { LanguageSelector } from '../components/LanguageSelector'
import { Turnstile } from '../components/Turnstile'
import { useLocale } from '../i18n/locale-context'
import { readRuntimeConfig } from '../lib/redirects'

export function RegistrationPendingPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialEmail = (location.state as { registrationEmail?: string } | null)?.registrationEmail ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [notice, setNotice] = useState(t.registration.verificationSent)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])
  const authRequestId = searchParams.get('auth_request_id')
  const loginSearch = authRequestId ? `?${new URLSearchParams({ auth_request_id: authRequestId })}` : ''

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.resendVerificationEmail || (turnstileSiteKey && !turnstileToken)) return
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await auth.api.resendVerificationEmail(email, turnstileToken || undefined)
      setNotice(t.registration.verificationSent)
    } catch (caught) {
      setError(authErrorMessage(caught, t.registration.resendFailed))
      setTurnstileToken('')
      setTurnstileAttempt((value) => value + 1)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell" aria-labelledby="check-email-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="check-email-title">{t.registration.checkEmailTitle}</h1>
          <p>{t.registration.checkEmailDescription}</p>
        </div>
        <div className="login-form-panel">
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {notice ? <p className="form-success" role="status">{notice}</p> : null}
          <p className="form-notice">{t.registration.verificationAttemptReminder}</p>
          <Form className="form-stack" onSubmit={resend}>
            <TextField isRequired name="email" type="email" value={email} onChange={setEmail} validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
              <Label>{t.registration.email}</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <Turnstile key={turnstileAttempt} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
            <div className="login-actions auth-actions-between">
              <Link className="muted-link" to={`/register${loginSearch}`}>{t.registration.useAnotherEmail}</Link>
              <Button isDisabled={Boolean(turnstileSiteKey && !turnstileToken)} isPending={isSubmitting} type="submit">{t.registration.resend}</Button>
            </div>
          </Form>
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
