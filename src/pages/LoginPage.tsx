import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  OTP,
  REGEXP_ONLY_DIGITS,
  TextField,
} from '@hhc/ui'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { safeReturnTo } from '../auth/auth-routes'
import { ApiError } from '../lib/api'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'

const socialProviders = [
  { id: 'google', label: 'Google' },
  { id: 'line', label: 'LINE' },
  { id: 'microsoft', label: 'Microsoft' },
]

export function LoginPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
  const returnTo = safeReturnTo(searchParams.get('return_to'))
  const signedOut = searchParams.get('signed_out') === '1'
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const title = t.login.brandTitle
  const challenge = auth.mfaChallenge
  const mfaSubtitle = t.login.mfaVerificationSubtitle

  const socialLinks = useMemo(() => {
    if (!auth.api.getSocialLoginUrl) return []
    return socialProviders.flatMap((provider) => {
      const href = auth.api.getSocialLoginUrl?.(provider.id, authRequestId)
      return href ? [{ ...provider, href }] : []
    })
  }, [auth.api, authRequestId])

  useEffect(() => {
    if (!signedOut) return

    setNotice(t.login.signedOut)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('signed_out')
    const search = nextSearchParams.toString()
    navigate({ pathname: '/login', search: search ? `?${search}` : '' }, { replace: true })
  }, [navigate, searchParams, signedOut, t.login.signedOut])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
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
      }
    } catch (caught) {
      setError(errorMessage(caught))
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
      const response = await auth.api.verifyMfa?.(challenge.token, code)

      if (response) {
        await auth.completeLogin(response)
        if (response.access_token) {
          navigate(returnTo, { replace: true })
        }
      }
    } catch (caught) {
      setError(errorMessage(caught))
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

          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

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
              <TextField isRequired name="email">
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

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}

function socialLabel(prefix: string, provider: string, suffix: string) {
  return [prefix, provider, suffix].filter(Boolean).join(' ')
}

function SocialIcon({ provider }: { provider: string }) {
  if (provider === 'google') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="#4285f4"
          d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.43"
        />
        <path
          fill="#34a853"
          d="M12 22c2.7 0 4.97-.9 6.62-2.34l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22"
        />
        <path
          fill="#fbbc05"
          d="M6.39 13.98A6 6 0 0 1 6.07 12c0-.69.12-1.35.32-1.98v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.58z"
        />
        <path
          fill="#ea4335"
          d="M12 5.89c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.96 2.91 14.7 2 12 2a10 10 0 0 0-8.96 5.42l3.35 2.6C7.18 7.65 9.39 5.89 12 5.89"
        />
      </svg>
    )
  }

  if (provider === 'line') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M20.6 10.7c0-4.05-4.03-7.35-8.98-7.35s-8.98 3.3-8.98 7.35c0 3.63 3.22 6.67 7.57 7.24.3.06.7.2.8.46.09.23.06.59.03.82l-.13.78c-.04.23-.18.9.78.49s5.17-3.05 7.06-5.23a6.53 6.53 0 0 0 1.85-4.56"
        />
        <path
          fill="#fff"
          d="M7.2 12.98H5.44V8.43h.92v3.76h.84zm1.63 0h-.92V8.43h.92zm4.64 0h-.87l-1.98-2.7v2.7H9.7V8.43h.87l1.98 2.72V8.43h.92zm3.48-3.77h-1.94v.86h1.75v.78h-1.75v1.34h1.94v.79H14.1V8.43h2.85z"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#f25022" d="M3 3h8.55v8.55H3z" />
      <path fill="#7fba00" d="M12.45 3H21v8.55h-8.55z" />
      <path fill="#00a4ef" d="M3 12.45h8.55V21H3z" />
      <path fill="#ffb900" d="M12.45 12.45H21V21h-8.55z" />
    </svg>
  )
}
