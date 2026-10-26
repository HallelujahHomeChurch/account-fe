import { LegalDocuments } from '../components/LegalDocuments'
import { useCommonLegalReview } from '../components/useCommonLegalReview'
import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { PasswordField } from '../components/PasswordField'
import { LanguageSelector } from '../components/LanguageSelector'
import { SocialAuthOptions } from '../components/SocialAuthOptions'
import { useAuthCapabilitiesState } from '../auth/use-auth-capabilities'
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
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [confirmationTouched, setConfirmationTouched] = useState(false)
  const confirmationError = confirmationTouched && confirmation && isStrongPassword(password) && password !== confirmation
    ? t.registration.passwordMismatch : ''
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const { capabilities, error: capabilitiesError, retry: retryCapabilities } = useAuthCapabilitiesState()
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const policy = capabilities?.policy
  const legalReview = useCommonLegalReview(policy)
  useEffect(() => { setPolicyAccepted(false) }, [locale, policy?.terms_version, policy?.privacy_notice_version, legalReview.snapshot?.snapshotId])
  const policyReady = legalReview.ready && Boolean(policy && (!policy.enforced || (policy.terms_version && policy.privacy_notice_version)))
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
    setPassword(password)
    setConfirmation(String(form.get('confirm_password') ?? ''))
    setConfirmationTouched(true)
    if (!isStrongPassword(password)) {
      setError(t.registration.passwordPolicy)
      return
    }
    if (password !== String(form.get('confirm_password') ?? '')) {
      setError('')
      return
    }
    setError('')
    setIsSubmitting(true)
    const email = String(form.get('email') ?? '')
    try {
      await auth.api.register({
        email,
        password,
        ...(capabilities.nicknameWriteEnabled ? { nickname: String(form.get('nickname') ?? '') } : { first_name: String(form.get('first_name') ?? ''), last_name: String(form.get('last_name') ?? '') }),
        newsletter_opt_in: form.has('newsletter_opt_in'),
        turnstile_token: turnstileToken || undefined,
        policy: policy?.enforced ? {
          accepted: true,
          terms_version: policy.terms_version,
          privacy_notice_version: policy.privacy_notice_version,
          locale,
          ...(legalReview.snapshot ? {snapshot_id: legalReview.snapshot.snapshotId} : {}),
        } : undefined,
      })
      navigate(`/register/check-email${authRequestSearch}`, {
        replace: true,
        state: { registrationEmail: email },
      })
    } catch (caught) {
      setError(authErrorMessage(caught, t.registration.failed, {
        ACC_REQUEST_INVALID: t.registration.invalidDetails,
        ACC_PROFILE_NAME_CLIENT_UPDATE_REQUIRED: t.nickname.clientUpdate,
        ACC_PROFILE_NAME_WRITES_PAUSED: t.nickname.paused,
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
              <Button onPress={() => {retryCapabilities(); legalReview.retry()}} variant="secondary">{t.legalAcceptance.retry}</Button>
            </div>
          ) : null}
          <SocialAuthOptions
            authRequestId={authRequestId}
            dividerLabel={t.registration.emailDivider}
            dividerPosition="after"
            providerIds={capabilities?.providers ?? null}
          />
          <Form className="form-stack" onSubmit={submit}>
            {capabilities?.nicknameWriteEnabled ? (
              <TextField isRequired name="nickname">
                <Label>{t.nickname.label}</Label>
                <Input autoComplete="nickname" />
                <p>{t.nickname.hint}</p>
                <FieldError />
              </TextField>
            ) : (<div className="auth-name-fields">
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
            </div>)}
            <TextField isRequired name="email" type="email" validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
              <Label>{t.registration.email}</Label>
              <Input autoComplete="email" />
              <FieldError />
            </TextField>
            <PasswordField name="password" label={t.registration.password} autoComplete="new-password"
              value={password} onChange={setPassword} />
            <PasswordField name="confirm_password" label={t.registration.confirmPassword} autoComplete="new-password"
              value={confirmation} onChange={setConfirmation} onBlur={() => setConfirmationTouched(true)} error={confirmationError} />
			<label className="auth-consent">
				<input name="newsletter_opt_in" type="checkbox" />
				<span>
					<strong>{t.registration.newsletterOptIn}</strong>
					<small>{t.registration.newsletterOptOut}</small>
				</span>
			</label>
            {policy?.enforced ? <>{legalReview.snapshot ? <LegalDocuments snapshot={legalReview.snapshot} /> : null}
              <LegalAcceptance disabled={!legalReview.ready} checked={policyAccepted} onChange={setPolicyAccepted} /></> : null}
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
