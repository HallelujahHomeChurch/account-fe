import { LegalDocuments } from '../components/LegalDocuments'
import { useCommonLegalReview } from '../components/useCommonLegalReview'
import { Button, FieldError, Form, Input, Label, OTP, REGEXP_ONLY_DIGITS, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { LegalAcceptance } from '../components/LegalAcceptance'
import { useAuthCapabilitiesState } from '../auth/use-auth-capabilities'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type OAuthOnboardingStatus } from '../lib/api'
import { validateEmail } from '../auth/auth-form'

type Step = 'loading' | 'email' | 'code' | 'confirm' | 'invalid'

export function OAuthOnboardingPage() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const navigate = useNavigate()
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [step, setStep] = useState<Step>(() => auth.api.getOAuthOnboardingStatus ? 'loading' : 'email')
  const [status, setStatus] = useState<OAuthOnboardingStatus | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now)
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const canResend = remaining === 0
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const { capabilities, error: capabilitiesError, retry: retryCapabilities } = useAuthCapabilitiesState()
  const policy = capabilities?.policy
  const legalReview = useCommonLegalReview(policy)
  useEffect(() => { setPolicyAccepted(false) }, [locale, policy?.terms_version, policy?.privacy_notice_version, legalReview.snapshot?.snapshotId])
  const policyReady = legalReview.ready && Boolean(policy && (!policy.enforced || (policy.terms_version && policy.privacy_notice_version)))

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (!token || !auth.api.getOAuthOnboardingStatus) return
    let active = true
    auth.api.getOAuthOnboardingStatus(token).then((next) => {
      if (!active) return
      setStatus(next)
      setStep(next.email_verification_required ? 'email' : 'confirm')
    }).catch((caught) => {
      if (active) setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    })
    return () => { active = false }
  }, [auth.api, t.oauthOnboarding.failed, t.oauthOnboarding.invalid, token])

  useEffect(() => {
    if (!resendAt) return
    const tick = () => setNow(Date.now())
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [resendAt])

  async function requestCode(email: string) {
    if (!token || !auth.api.sendOAuthOnboardingCode) return setError(t.oauthOnboarding.invalid)
    if (isSubmitting || Date.now() < resendAt) return
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      const response = await auth.api.sendOAuthOnboardingCode(token, email)
      setSentEmail(email)
      setNow(Date.now())
      setResendAt(deadline(response.resend_available_at) ?? Date.now() + 3 * 60 * 1000)
      setExpiresAt(deadline(response.expires_at))
      setNotice(t.oauthOnboarding.codeSent)
      setStep('code')
    } catch (caught) {
      if (caught instanceof ApiError) {
        const retrySeconds = Number(caught.retryAfter)
        const data = caught.data && typeof caught.data === 'object' ? caught.data : {}
        const retainedExpiry = 'expires_at' in data ? deadline(data.expires_at) : null
        const retryAt = 'resend_available_at' in data ? deadline(data.resend_available_at) : null
        const retryDeadline = Number.isFinite(retrySeconds) && retrySeconds > 0 ? Date.now() + retrySeconds * 1000 : null
        setNow(Date.now())
        if (retryAt !== null || retryDeadline !== null || caught.status === 429) {
          setResendAt(Math.max(retryAt ?? 0, retryDeadline ?? 0) || Date.now() + 3 * 60 * 1000)
        }
        if (retainedExpiry !== null) {
          setSentEmail(email)
          setExpiresAt(retainedExpiry)
          setStep('code')
        }
        if (caught.code === 'ACC_OAUTH_ONBOARDING_INVALID') setStep('invalid')
        if (caught.status === 429) { setError(t.oauthOnboarding.rateLimited); return }
        if (caught.status === 503 && retainedExpiry !== null) { setError(t.oauthOnboarding.deliveryUncertain); return }
      }
      setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    } finally {
      setIsSubmitting(false)
    }
  }

  function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void requestCode(String(new FormData(event.currentTarget).get('email') ?? ''))
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.verifyOAuthOnboardingCode) return
    setError('')
    setIsSubmitting(true)
    try {
      const next = await auth.api.verifyOAuthOnboardingCode(token, String(new FormData(event.currentTarget).get('code') ?? ''))
      setStatus(next)
      if (next.link_confirmation_required || next.requires_link_confirmation || policy?.enforced) setStep('confirm')
      else await complete(false)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_OAUTH_ONBOARDING_CODE_EXPIRED') {
        setError(t.oauthOnboarding.codeExpired)
        return
      }
      if (caught instanceof ApiError && caught.code === 'ACC_OAUTH_ONBOARDING_INVALID') setStep('invalid')
      setError(onboardingError(caught, t.oauthOnboarding.invalid, t.oauthOnboarding.failed))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function complete(linkExisting: boolean) {
    if (!auth.api.completeOAuthOnboarding || !capabilities || !policyReady || (policy?.enforced && !policyAccepted)) return
    const response = policy?.enforced
      ? await auth.api.completeOAuthOnboarding(token, linkExisting, {
          accepted: true,
          terms_version: policy.terms_version,
          privacy_notice_version: policy.privacy_notice_version,
          locale,
          ...(legalReview.snapshot ? {snapshot_id: legalReview.snapshot.snapshotId} : {}),
        })
      : await auth.api.completeOAuthOnboarding(token, linkExisting)
    await auth.completeLogin(response)
    if (response.redirect_type !== 'oauth') {
      await auth.retrySession()
      navigate('/profile', { replace: true })
    }
  }

  async function confirm() {
    setError('')
    setIsSubmitting(true)
    try {
      await complete(Boolean(status?.link_confirmation_required || status?.requires_link_confirmation))
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_POLICY_VERSION_CHANGED') {
        setPolicyAccepted(false)
        retryCapabilities()
        return
      }
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') setStep('invalid')
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
          {error || !token ? <p className="form-error" role="alert">{error || t.oauthOnboarding.invalid}</p> : null}
          {capabilitiesError || (capabilities && !policyReady) ? (
            <div role="alert"><p className="form-error">{t.legalAcceptance.loadFailed}</p><Button onPress={() => {retryCapabilities(); legalReview.retry()}} variant="secondary">{t.legalAcceptance.retry}</Button></div>
          ) : null}
          {step === 'loading' && !error ? <p className="form-notice">{t.oauthOnboarding.loading}</p> : null}
          {step === 'email' && token ? (
            <Form className="form-stack" onSubmit={sendCode}>
              <TextField isRequired name="email" type="email" validate={(value) => validateEmail(value, t.validation.invalidEmail)}>
                <Label>{t.oauthOnboarding.email}</Label>
                <Input autoComplete="email" autoFocus />
                <FieldError />
              </TextField>
              {!canResend ? <p className="form-notice">{t.oauthOnboarding.resendWait.replace('{time}', countdown)}</p> : null}
              <div className="login-actions"><Button isDisabled={!canResend} isPending={isSubmitting} type="submit">{t.oauthOnboarding.sendCode}</Button></div>
            </Form>
          ) : null}
          {step === 'code' ? (
            <Form className="form-stack" onSubmit={verifyCode}>
              {expiresAt !== null ? <p className="form-notice">{t.oauthOnboarding.codeExpiresAt.replace('{time}', new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'long' }).format(new Date(expiresAt)))}</p> : null}
              <OTP autoComplete="one-time-code" autoFocus inputMode="numeric" label={t.oauthOnboarding.code} maxLength={6} name="code" pattern={REGEXP_ONLY_DIGITS} required />
              <div className="login-actions"><Button isPending={isSubmitting} type="submit">{t.oauthOnboarding.verify}</Button></div>
              {canResend ? <Button isDisabled={isSubmitting} onPress={() => void requestCode(sentEmail)} variant="secondary">{t.oauthOnboarding.resendCode}</Button> : <p className="form-notice">{t.oauthOnboarding.resendWait.replace('{time}', countdown)}</p>}
            </Form>
          ) : null}
          {step === 'confirm' ? (
            <div className="form-stack">
              <p className="oauth-account-summary">{status?.masked_email}</p>
              {policy?.enforced ? <>{legalReview.snapshot ? <LegalDocuments snapshot={legalReview.snapshot} /> : null}
              <LegalAcceptance disabled={!legalReview.ready} checked={policyAccepted} onChange={setPolicyAccepted} /></> : null}
              <div className="login-actions"><Button isDisabled={!capabilities || !policyReady || Boolean(policy?.enforced && !policyAccepted)} isPending={isSubmitting} onPress={confirm}>{status?.link_confirmation_required || status?.requires_link_confirmation ? t.oauthOnboarding.linkAccount : t.oauthOnboarding.continue}</Button></div>
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
  if (caught instanceof ApiError && ['ACC_OAUTH_ONBOARDING_INVALID', 'ACC_AUTH_REQUEST_INVALID'].includes(caught.code ?? '')) return invalid
  return fallback
}

function deadline(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}
