import {
  BrandLoadingScreen,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  OTP,
  REGEXP_ONLY_DIGITS,
  TextField,
} from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { SocialAuthOptions, useAuthCapabilities } from '../components/SocialAuthOptions'
import { clearPostLoginReturnTo, readPostLoginReturnTo, safeReturnTo, savePostLoginReturnTo } from '../auth/auth-routes'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { authErrorMessage } from '../auth/auth-form'
import { Turnstile } from '../components/Turnstile'
import { readRuntimeConfig } from '../lib/redirects'
import { clearNativeAuthContinuation, saveNativeAuthContinuation } from '../lib/native-auth-continuation'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
  const authRequestSearch = authRequestId
    ? `?${new URLSearchParams({ auth_request_id: authRequestId }).toString()}`
    : ''
  const returnTo = safeReturnTo(searchParams.get('return_to'))
  const signedOut = searchParams.get('signed_out') === '1'
  const passwordChanged = searchParams.get('password_changed') === '1'
  const oauthError = searchParams.get('oauth_error')
  const [error, setError] = useState('')
  const registrationState = location.state as {
    registrationComplete?: boolean
    registrationEmail?: string
  } | null
  const [notice, setNotice] = useState(() =>
    registrationState?.registrationComplete ? t.registration.verificationSent : '',
  )
  const [isSuccessNotice, setIsSuccessNotice] = useState(Boolean(registrationState?.registrationComplete))
  const [initialEmail] = useState(registrationState?.registrationEmail ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const capabilities = useAuthCapabilities()
  const registrationEnabled = capabilities?.registrationEnabled === true
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [transactionState, setTransactionState] = useState<'checking' | 'active' | 'invalid' | 'unavailable'>(authRequestId ? 'checking' : 'active')
  const authRequestCheckRef = useRef(0)
  const authRequestTimerRef = useRef<number | undefined>(undefined)
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])

  const checkAuthRequest = useCallback(async () => {
    const revision = ++authRequestCheckRef.current
    if (authRequestTimerRef.current !== undefined) window.clearTimeout(authRequestTimerRef.current)
    if (!authRequestId || !auth.api.getAuthRequestStatus) {
      setTransactionState('active')
      return
    }
    setTransactionState('checking')
    try {
      const status = await auth.api.getAuthRequestStatus(authRequestId)
      if (revision !== authRequestCheckRef.current) return
      const expiresAt = Date.parse(status.expires_at)
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      saveNativeAuthContinuation(authRequestId, { clientId: status.client_id, clientName: status.client_name })
      setTransactionState('active')
      authRequestTimerRef.current = window.setTimeout(() => {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
      }, expiresAt - Date.now())
    } catch (caught) {
      if (revision !== authRequestCheckRef.current) return
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
      } else {
        setTransactionState('unavailable')
      }
    }
  }, [auth.api, authRequestId])

  useEffect(() => {
    void checkAuthRequest()
    const recheck = () => void checkAuthRequest()
    window.addEventListener('pageshow', recheck)
    return () => {
      authRequestCheckRef.current += 1
      if (authRequestTimerRef.current !== undefined) window.clearTimeout(authRequestTimerRef.current)
      window.removeEventListener('pageshow', recheck)
    }
  }, [checkAuthRequest])

  const title = t.login.brandTitle
  const challenge = auth.mfaChallenge
  const mfaSubtitle = t.login.mfaVerificationSubtitle

  useEffect(() => {
    const pendingReturnTo = readPostLoginReturnTo()
    if (authRequestId || (pendingReturnTo !== null && (pendingReturnTo === '/profile' || pendingReturnTo !== returnTo))) {
      clearPostLoginReturnTo()
    }
  }, [authRequestId, returnTo])

  useEffect(() => {
    if (!signedOut && !passwordChanged && !oauthError) return

    if (signedOut) {
      setNotice(t.login.signedOut)
      setIsSuccessNotice(true)
    }
    if (passwordChanged) {
      setNotice(t.security.passwordChanged)
      setIsSuccessNotice(true)
    }
    if (oauthError) {
      clearPostLoginReturnTo()
      const message = {
        account_conflict: t.login.oauthAccountConflict,
        cancelled: t.login.oauthCancelled,
        organization_not_allowed: t.login.oauthOrganizationNotAllowed,
        registration_unavailable: t.login.oauthRegistrationUnavailable,
        state_expired: t.login.oauthStateExpired,
        workspace_not_allowed: t.login.oauthWorkspaceNotAllowed,
        auth_request_invalid: t.login.authRequestInvalid,
      }[oauthError] ?? t.login.oauthFailed

      if (oauthError === 'cancelled') {
        setNotice(message)
        setIsSuccessNotice(false)
      } else {
        setError(message)
      }
    }
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('signed_out')
    nextSearchParams.delete('password_changed')
    nextSearchParams.delete('oauth_error')
    nextSearchParams.delete('oauth_provider')
    nextSearchParams.delete('locale')
    const search = nextSearchParams.toString()
    navigate({ pathname: '/login', search: search ? `?${search}` : '' }, { replace: true })
  }, [
    navigate,
    oauthError,
    passwordChanged,
    searchParams,
    signedOut,
    t.login.oauthCancelled,
    t.login.oauthAccountConflict,
    t.login.oauthFailed,
    t.login.oauthOrganizationNotAllowed,
    t.login.oauthRegistrationUnavailable,
    t.login.oauthStateExpired,
    t.login.oauthWorkspaceNotAllowed,
    t.login.authRequestInvalid,
    t.login.signedOut,
    t.security.passwordChanged,
  ])

  useEffect(() => {
    if (!registrationState) return
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    })
  }, [location.hash, location.pathname, location.search, navigate, registrationState])

  useEffect(() => {
    if (authRequestId || auth.isBootstrapping || !auth.profile) return
    navigate(returnTo, { replace: true })
  }, [auth.isBootstrapping, auth.profile, authRequestId, navigate, returnTo])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (turnstileSiteKey && !turnstileToken) return
    setError('')
    setNotice('')
    setIsSuccessNotice(false)
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)

    try {
      const response = await auth.login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        authRequestId,
        turnstileToken: turnstileToken || undefined,
      })
      if (response.policy_acceptance_required && response.policy_token) {
        if (!authRequestId) savePostLoginReturnTo(returnTo)
        navigate(`/policy/acceptance#token=${encodeURIComponent(response.policy_token)}`, { replace: true })
      } else if (response.access_token) {
        clearPostLoginReturnTo()
        navigate(returnTo, { replace: true })
      } else if (!response.mfa_type) {
        setNotice(t.login.signedIn)
        setIsSuccessNotice(true)
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      setError(authErrorMessage(caught, t.login.failed, {
        ACC_AUTH_INVALID_CREDENTIALS: t.login.invalidCredentials,
        ACC_AUTH_RATE_LIMITED: t.login.rateLimited,
      }))
      if (turnstileSiteKey) {
        setTurnstileToken('')
        setTurnstileAttempt((attempt) => attempt + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challenge) return

    setError('')
    setIsSubmitting(true)
    const code = String(new FormData(event.currentTarget).get('code') ?? '')

    try {
      const response = await auth.verifyMfa(code)
      if (response.policy_acceptance_required && response.policy_token) {
        if (!authRequestId) savePostLoginReturnTo(returnTo)
        navigate(`/policy/acceptance#token=${encodeURIComponent(response.policy_token)}`, { replace: true })
      } else if (response.access_token) {
        clearPostLoginReturnTo()
        navigate(returnTo, { replace: true })
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      setError(authErrorMessage(caught, t.login.mfaFailed))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (auth.isBootstrapping && auth.api.getSession && !authRequestId && !signedOut && !passwordChanged && !oauthError) {
    return <BrandLoadingScreen label={t.profile.loading} />
  }

  if (transactionState !== 'active') {
    const invalid = transactionState === 'invalid'
    return (
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-copy">
            <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
            <h1 id="login-title">{title}</h1>
          </div>
          <div className="login-form-panel">
            {transactionState === 'checking' ? <p className="inline-status" role="status">{t.login.authRequestChecking}</p> : null}
            {invalid ? <p className="form-error" role="alert">{t.login.authRequestInvalid}</p> : null}
            {transactionState === 'unavailable' ? <p className="form-error" role="alert">{t.login.authRequestUnavailable}</p> : null}
            <Button onPress={() => invalid ? navigate('/login', { replace: true }) : void checkAuthRequest()}>
              {invalid ? t.login.authRequestRestart : t.login.authRequestRetry}
            </Button>
          </div>
        </div>
        <div className="login-footer"><LanguageSelector /></div>
      </section>
    )
  }

  return (
    <section className="login-shell" aria-labelledby="login-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="login-title">{title}</h1>
        </div>

        <div className="login-form-panel">
          {challenge ? (
            <>
              <h2>{t.login.mfaTitle}</h2>
              <p className="auth-subtitle">{mfaSubtitle}</p>
            </>
          ) : null}

          {error || auth.bootstrapError ? <p className="form-error" role="alert">{error || auth.bootstrapError}</p> : null}
          {notice ? (
            <p className={isSuccessNotice ? 'form-success' : 'form-notice'} role="status">
              {notice}
            </p>
          ) : null}

          {challenge ? (
            <Form className="form-stack" onSubmit={submitMfa}>
              <div className="mfa-code-field">
                <OTP
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  label={t.login.verify}
                  maxLength={6}
                  name="code"
                  pattern={REGEXP_ONLY_DIGITS}
                  required
                />
              </div>
              <div className="login-actions">
                <Button isPending={isSubmitting} type="submit">
                  {t.login.next}
                </Button>
              </div>
            </Form>
          ) : (
            <Form className="form-stack" onSubmit={submitLogin}>
              <TextField isRequired defaultValue={initialEmail} name="email">
                <Label>{t.login.accountLabel}</Label>
                <Input autoComplete="username" inputMode="email" placeholder="you@example.com" type="text" />
                <FieldError />
              </TextField>
              <TextField isRequired name="password" type="password">
                <Label>{t.login.passwordLabel}</Label>
                <Input autoComplete="current-password" />
                <FieldError />
              </TextField>
              <Link className="muted-link forgot-password-link" to={`/forgot-password${authRequestSearch}`}>
                {t.login.forgotPassword}
              </Link>
              <Turnstile key={turnstileAttempt} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
              <div className="login-actions">
                {registrationEnabled ? (
                  <Link className="muted-link" to={`/register${authRequestSearch}`}>{t.login.createAccount}</Link>
                ) : null}
                <Button isDisabled={Boolean(turnstileSiteKey && !turnstileToken)} isPending={isSubmitting} type="submit">
                  {t.login.next}
                </Button>
              </div>
            </Form>
          )}

          {!challenge ? (
            <SocialAuthOptions
              authRequestId={authRequestId}
              dividerLabel={t.login.socialDivider}
              providerIds={capabilities?.providers ?? null}
              returnTo={returnTo}
            />
          ) : null}
        </div>
      </div>
      <div className="login-footer">
        <LanguageSelector />
      </div>
    </section>
  )
}
