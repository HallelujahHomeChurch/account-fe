import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { SocialAuthOptions, useAuthCapabilitiesState } from '../components/SocialAuthOptions'
import { LegalAcceptance } from '../components/LegalAcceptance'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { readRuntimeConfig } from '../lib/redirects'
import { Turnstile } from '../components/Turnstile'
import { authErrorMessage, isStrongPassword, validateEmail } from '../auth/auth-form'
import {
  clearNativeAuthContinuation,
  saveNativeAuthContinuation,
} from '../lib/native-auth-continuation'

export function RegisterPage() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
  const authRequestSearch = authRequestId
    ? `?${new URLSearchParams({ auth_request_id: authRequestId }).toString()}`
    : ''
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const { capabilities, error: capabilitiesError, retry: retryCapabilities } = useAuthCapabilitiesState()
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const policy = capabilities?.policy
  const policyReady = Boolean(policy && (!policy.enforced || (policy.terms_version && policy.privacy_notice_version)))
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])

  useEffect(() => {
    if (authRequestId) saveNativeAuthContinuation(authRequestId)
    else clearNativeAuthContinuation()
  }, [authRequestId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.register) return
    if (!capabilities || !policyReady || (policy?.enforced && !policyAccepted)) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    if (!isStrongPassword(password)) {
      setError(t.registration.passwordPolicy)
      return
    }
    if (password !== String(form.get('confirm_password') ?? '')) {
      setError(t.registration.passwordMismatch)
      return
    }
    setError('')
    setIsSubmitting(true)
    const email = String(form.get('email') ?? '')
    try {
      await auth.api.register({
        email,
        password,
        first_name: String(form.get('first_name') ?? ''),
        last_name: String(form.get('last_name') ?? ''),
        newsletter_opt_in: form.has('newsletter_opt_in'),
        turnstile_token: turnstileToken || undefined,
        policy: policy?.enforced ? {
          accepted: true,
          terms_version: policy.terms_version,
          privacy_notice_version: policy.privacy_notice_version,
          locale,
        } : undefined,
      })
      navigate(`/login${authRequestSearch}`, {
        replace: true,
        state: { registrationComplete: true, registrationEmail: email },
      })
    } catch (caught) {
      setError(authErrorMessage(caught, t.registration.failed, {
        ACC_REQUEST_INVALID: t.registration.invalidDetails,
      }))
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
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {capabilitiesError || (capabilities && !policyReady) ? (
            <div role="alert">
              <p className="form-error">{t.legalAcceptance.loadFailed}</p>
              <Button onPress={retryCapabilities} variant="secondary">{t.legalAcceptance.retry}</Button>
            </div>
          ) : null}
          <SocialAuthOptions
            authRequestId={authRequestId}
            dividerLabel={t.registration.emailDivider}
            dividerPosition="after"
            providerIds={capabilities?.providers ?? null}
          />
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
            <TextField isRequired name="email" type="email" validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
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
			<label className="auth-consent">
				<input name="newsletter_opt_in" type="checkbox" />
				<span>
					<strong>{t.registration.newsletterOptIn}</strong>
					<small>{t.registration.newsletterOptOut}</small>
				</span>
			</label>
            {policy?.enforced ? <LegalAcceptance checked={policyAccepted} onChange={setPolicyAccepted} /> : null}
            <Turnstile siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
            <div className="login-actions auth-actions-between">
              <Link className="muted-link" to={`/login${authRequestSearch}`}>{t.registration.backToLogin}</Link>
              <Button isDisabled={!capabilities || !policyReady || Boolean(policy?.enforced && !policyAccepted) || Boolean(turnstileSiteKey && !turnstileToken)} isPending={isSubmitting} type="submit">{t.registration.submit}</Button>
            </div>
          </Form>
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
