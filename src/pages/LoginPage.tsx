import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  OTP,
  REGEXP_ONLY_DIGITS,
  TextField,
} from '@hallelujahhomechurch/ui'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { SocialIcon } from '../components/SocialIcon'
import { safeReturnTo } from '../auth/auth-routes'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { authErrorMessage } from '../auth/auth-form'

const socialProviders = [
  { id: 'google', label: 'Google' },
  { id: 'line', label: 'LINE' },
  { id: 'microsoft', label: 'Microsoft' },
]

export function LoginPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
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
  const [enabledProviderIds, setEnabledProviderIds] = useState<string[] | null>(null)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  const title = t.login.brandTitle
  const challenge = auth.mfaChallenge
  const mfaSubtitle = t.login.mfaVerificationSubtitle

  const socialLinks = useMemo(() => {
    if (!auth.api.getSocialLoginUrl || !enabledProviderIds) return []
    return socialProviders.flatMap((provider) => {
      if (!enabledProviderIds.includes(provider.id)) return []
      const href = auth.api.getSocialLoginUrl?.(provider.id, authRequestId)
      return href ? [{ ...provider, href }] : []
    })
  }, [auth.api, authRequestId, enabledProviderIds])

  useEffect(() => {
    let active = true
    const request = auth.api.getAuthCapabilities
      ? auth.api.getAuthCapabilities()
      : auth.api.getOAuthProviders
        ? auth.api.getOAuthProviders().then((providers) => ({ providers, registrationEnabled: false }))
        : Promise.resolve({ providers: socialProviders.map(({ id }) => id), registrationEnabled: false })
    request
      .then((capabilities) => {
        if (!active) return
        setEnabledProviderIds(capabilities.providers)
        setRegistrationEnabled(capabilities.registrationEnabled)
      })
      .catch(() => {
        if (active) setEnabledProviderIds([])
      })
    return () => {
      active = false
    }
  }, [auth.api])

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
      setError(oauthError === 'cancelled' ? t.login.oauthCancelled : t.login.oauthFailed)
    }
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('signed_out')
    nextSearchParams.delete('password_changed')
    nextSearchParams.delete('oauth_error')
    const search = nextSearchParams.toString()
    navigate({ pathname: '/login', search: search ? `?${search}` : '' }, { replace: true })
  }, [
    navigate,
    oauthError,
    passwordChanged,
    searchParams,
    signedOut,
    t.login.oauthCancelled,
    t.login.oauthFailed,
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
      })
      if (response.access_token) {
        navigate(returnTo, { replace: true })
      } else if (!response.mfa_type) {
        setNotice(t.login.signedIn)
        setIsSuccessNotice(true)
      }
    } catch (caught) {
      setError(authErrorMessage(caught, t.login.failed, {
        ACC_AUTH_INVALID_CREDENTIALS: t.login.invalidCredentials,
        ACC_AUTH_RATE_LIMITED: t.login.rateLimited,
      }))
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
      if (response.access_token) {
        navigate(returnTo, { replace: true })
      }
    } catch (caught) {
      setError(authErrorMessage(caught, t.login.mfaFailed))
    } finally {
      setIsSubmitting(false)
    }
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
                <Input autoComplete="username" placeholder="you@example.com" type="text" />
                <FieldError />
              </TextField>
              <TextField isRequired name="password" type="password">
                <Label>{t.login.passwordLabel}</Label>
                <Input autoComplete="current-password" placeholder="Password" />
                <FieldError />
              </TextField>
              <Link className="muted-link forgot-password-link" to="/forgot-password">
                {t.login.forgotPassword}
              </Link>
              <div className="login-actions">
                {registrationEnabled ? (
                  <Link className="muted-link" to="/register">{t.login.createAccount}</Link>
                ) : null}
                <Button isPending={isSubmitting} type="submit">
                  {t.login.next}
                </Button>
              </div>
            </Form>
          )}

          {!challenge && socialLinks.length ? (
            <div className="social-login-panel" aria-label={t.login.socialLogin}>
              <div className="social-divider">
                <span>{t.login.socialDivider}</span>
              </div>
              <div className="social-icon-list">
                {socialLinks.map((link) => (
                  <a
                    key={link.id}
                    aria-label={socialLabel(t.login.socialPrefix, link.label, t.login.socialSuffix)}
                    className={`social-icon-button social-icon-button--${link.id}`}
                    href={link.href}
                    title={socialLabel(t.login.socialPrefix, link.label, t.login.socialSuffix)}
                  >
                    <SocialIcon provider={link.id} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="login-footer">
        <LanguageSelector />
      </div>
    </section>
  )
}

function socialLabel(prefix: string, provider: string, suffix: string) {
  return [prefix, provider, suffix].filter(Boolean).join(' ')
}
