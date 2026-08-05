import { Button, FieldError, Form, Input, Label, OTP, REGEXP_ONLY_DIGITS, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type OAuthOnboardingStatus } from '../lib/api'
import { validateEmail } from '../auth/auth-form'

type Step = 'email' | 'code' | 'link'

export function OAuthOnboardingPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [step, setStep] = useState<Step>('email')
  const [status, setStatus] = useState<OAuthOnboardingStatus | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !auth.api.sendOAuthOnboardingCode) return setError(t.oauthOnboarding.invalid)
    setError('')
    setIsSubmitting(true)
    try {
      await auth.api.sendOAuthOnboardingCode(token, String(new FormData(event.currentTarget).get('email') ?? ''))
      setNotice(t.oauthOnboarding.codeSent)
      setStep('code')
    } catch (caught) {
      setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.verifyOAuthOnboardingCode) return
    setError('')
    setIsSubmitting(true)
    try {
      const next = await auth.api.verifyOAuthOnboardingCode(token, String(new FormData(event.currentTarget).get('code') ?? ''))
      setStatus(next)
      if (next.requires_link_confirmation) setStep('link')
      else await complete(false)
    } catch (caught) {
      setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function complete(linkExisting: boolean) {
    if (!auth.api.completeOAuthOnboarding) return
    const response = await auth.api.completeOAuthOnboarding(token, linkExisting)
    await auth.completeLogin(response)
    if (response.redirect_type !== 'oauth') {
      await auth.retrySession()
      navigate('/profile', { replace: true })
    }
  }

  async function confirmLink() {
    setError('')
    setIsSubmitting(true)
    try {
      await complete(true)
    } catch (caught) {
      setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    } finally {
      setIsSubmitting(false)
    }
  }

  const description = step === 'email'
    ? t.oauthOnboarding.emailDescription
    : step === 'code'
      ? t.oauthOnboarding.codeDescription
      : t.oauthOnboarding.linkDescription

  return (
    <section className="login-shell" aria-labelledby="onboarding-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="onboarding-title">{t.oauthOnboarding.title}</h1>
          <p>{description}</p>
        </div>
        <div className="login-form-panel">
          {notice && step === 'code' ? <p className="form-notice">{notice}</p> : null}
          {error || !token ? <p className="form-error">{error || t.oauthOnboarding.invalid}</p> : null}
          {step === 'email' && token ? (
            <Form className="form-stack" onSubmit={sendCode}>
              <TextField isRequired name="email" type="email" validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
                <Label>{t.oauthOnboarding.email}</Label>
                <Input autoComplete="email" autoFocus />
                <FieldError />
              </TextField>
              <div className="login-actions"><Button isPending={isSubmitting} type="submit">{t.oauthOnboarding.sendCode}</Button></div>
            </Form>
          ) : null}
          {step === 'code' ? (
            <Form className="form-stack" onSubmit={verifyCode}>
              <OTP autoComplete="one-time-code" autoFocus inputMode="numeric" label={t.oauthOnboarding.code} maxLength={6} name="code" pattern={REGEXP_ONLY_DIGITS} required />
              <div className="login-actions"><Button isPending={isSubmitting} type="submit">{t.oauthOnboarding.verify}</Button></div>
            </Form>
          ) : null}
          {step === 'link' ? (
            <div className="form-stack">
              <p className="oauth-account-summary">{status?.masked_email}</p>
              <div className="login-actions"><Button isPending={isSubmitting} onPress={confirmLink}>{t.oauthOnboarding.linkAccount}</Button></div>
            </div>
          ) : null}
          <Link className="muted-link auth-back-link" to="/login">{t.oauthOnboarding.cancel}</Link>
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}

function onboardingError(caught: unknown, invalid: string, fallback: string) {
  if (caught instanceof ApiError && caught.code === 'ACC_OAUTH_ONBOARDING_INVALID') return invalid
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return fallback
}
