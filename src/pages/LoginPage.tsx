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
import { Link } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { LanguageSelector } from '../components/LanguageSelector'
import { SocialAuthOptions } from '../components/SocialAuthOptions'
import { Turnstile } from '../components/Turnstile'
import { useLoginController } from '../features/login/useLoginController'

export function LoginPage() {
  const {
    messages: t, title, challenge, mfaSubtitle, transactionState, loading,
    error, notice, isSuccessNotice, initialEmail, isSubmitting,
    authRequestId, authRequestSearch, returnTo, registrationEnabled, providerIds,
    turnstileAttempt, turnstileSiteKey, passwordDisabled, handleTurnstileToken,
    submitLogin, submitMfa, recover,
  } = useLoginController()

  if (loading) {
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
            <Button onPress={recover}>
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

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {notice ? (
            <p className={isSuccessNotice ? 'form-success' : 'form-notice'} role="status">
              {notice}
            </p>
          ) : null}

          {challenge ? (
            <Form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submitMfa(String(new FormData(event.currentTarget).get('code') ?? '')) }}>
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
            <Form className="form-stack" onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void submitLogin({email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '')})
            }}>
              <TextField isRequired defaultValue={initialEmail} name="email">
                <Label>{t.login.accountLabel}</Label>
                <Input autoComplete="username" inputMode="email" placeholder="you@example.com" type="text" />
                <FieldError />
              </TextField>
              <PasswordField name="password" label={t.login.passwordLabel} autoComplete="current-password" />
              <Link className="muted-link forgot-password-link" to={`/forgot-password${authRequestSearch}`}>
                {t.login.forgotPassword}
              </Link>
              <Turnstile key={turnstileAttempt} siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
              <div className="login-actions">
                {registrationEnabled ? (
                  <Link className="muted-link" to={`/register${authRequestSearch}`}>{t.login.createAccount}</Link>
                ) : null}
                <Button isDisabled={passwordDisabled} isPending={isSubmitting} type="submit">
                  {t.login.next}
                </Button>
              </div>
            </Form>
          )}

          {!challenge ? (
            <SocialAuthOptions
              authRequestId={authRequestId}
              dividerLabel={t.login.socialDivider}
              providerIds={providerIds}
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
