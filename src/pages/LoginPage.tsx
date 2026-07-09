import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from '@heroui/react'
import { KeyRound, LogIn } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { ApiError, type MfaSetup } from '../lib/api'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'

const socialProviders = ['google', 'line', 'microsoft']

export function LoginPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const title = authRequestId ? t.login.continueSignIn : t.login.signIn
  const challenge = auth.mfaChallenge

  const socialLinks = useMemo(() => {
    if (!authRequestId || !auth.api.getSocialLoginUrl) return []
    return socialProviders.map((provider) => ({
      provider,
      href: auth.api.getSocialLoginUrl?.(provider, authRequestId) ?? '#',
    }))
  }, [auth.api, authRequestId])

  useEffect(() => {
    if (challenge?.type !== 'setup_required' || !auth.api.setupMfaWithToken) return

    auth.api
      .setupMfaWithToken(challenge.token)
      .then(setMfaSetup)
      .catch((caught: unknown) => setError(errorMessage(caught)))
  }, [auth.api, challenge])

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
        navigate('/profile', { replace: true })
      } else {
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
      const response =
        challenge.type === 'setup_required'
          ? await auth.api.verifyMfaSetupWithToken?.(challenge.token, code)
          : await auth.api.verifyMfa?.(challenge.token, code)

      if (response) {
        await auth.completeLogin(response)
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
          <p>{t.login.intro}</p>
        </div>

        <div className="login-form-panel">
          {challenge ? (
            <>
              <h2>{t.login.mfaTitle}</h2>
              <p className="auth-subtitle">{t.login.mfaSubtitle}</p>
            </>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          {challenge ? (
            <Form className="form-stack" onSubmit={submitMfa}>
              <p className="inline-status">
                {challenge.type === 'setup_required'
                  ? t.login.mfaSetupRequired
                  : t.login.mfaVerificationRequired}
              </p>
              {mfaSetup?.otpauth_url ? <code className="setup-code">{mfaSetup.otpauth_url}</code> : null}
              {mfaSetup?.backup_codes?.length ? (
                <ul className="backup-codes">
                  {mfaSetup.backup_codes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              ) : null}
              <TextField isRequired name="code">
                <Label>{t.login.verify}</Label>
                <Input inputMode="numeric" placeholder="123456" />
                <FieldError />
              </TextField>
              <div className="login-actions">
                <Button isPending={isSubmitting} type="submit">
                  <KeyRound size={17} />
                  {t.login.verify}
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
              <div className="login-actions">
                <Link className="muted-link" to="/forgot-password">
                  {t.login.forgotPassword}
                </Link>
                <Button isPending={isSubmitting} type="submit">
                  <LogIn size={17} />
                  {t.login.signIn}
                </Button>
              </div>
            </Form>
          )}

          {socialLinks.length ? (
            <div className="social-list">
              {socialLinks.map((link) => (
                <a key={link.provider} className="social-button" href={link.href}>
                  {[t.login.socialPrefix, link.provider, t.login.socialSuffix].filter(Boolean).join(' ')}
                </a>
              ))}
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
