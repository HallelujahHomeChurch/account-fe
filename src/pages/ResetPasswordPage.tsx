import { Button, FieldError, Form, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { authErrorMessage, isStrongPassword } from '../auth/auth-form'

export function ResetPasswordPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [isComplete, setComplete] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetLink] = useState(() => {
    const values = new URLSearchParams(window.location.hash.slice(1))
    return {
      email: values.get('email') ?? '',
      token: values.get('token') ?? '',
    }
  })

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.resetPassword) return

    const form = new FormData(event.currentTarget)
    const password = String(form.get('new_password') ?? '')
    setError('')
    if (!isStrongPassword(password)) {
      setError(t.passwordRecovery.passwordPolicy)
      return
    }
    if (password !== String(form.get('confirm_password') ?? '')) {
      setError(t.passwordRecovery.passwordMismatch)
      return
    }
    setIsSubmitting(true)

    try {
      await auth.api.resetPassword({
        email: String(form.get('email') ?? ''),
        token: resetLink.token,
        new_password: password,
      })
      setComplete(true)
    } catch (caught) {
      setError(authErrorMessage(caught, t.passwordRecovery.requestFailed, {
        ACC_REQUEST_INVALID: t.passwordRecovery.passwordPolicy,
        ACC_AUTH_TOKEN_INVALID: t.passwordRecovery.invalidLink,
      }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1>{isComplete ? t.passwordRecovery.resetSuccess : t.passwordRecovery.resetTitle}</h1>
          {!isComplete ? <p>{t.passwordRecovery.resetDescription}</p> : null}
        </div>
        <div className={`login-form-panel${isComplete ? ' auth-result-state' : ''}`}>
          {isComplete ? (
            <>
              <div className="auth-completion" role="status">
                <span className="auth-success-mark" aria-hidden="true">
                  <CheckCircle2 />
                </span>
                <p>{t.passwordRecovery.resetSuccessDescription}</p>
              </div>
              <Button onPress={() => navigate('/login', { replace: true })}>
                {t.passwordRecovery.backToLogin}
              </Button>
            </>
          ) : (
            <>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <Form className="form-stack" onSubmit={submit}>
                <TextField isReadOnly isRequired defaultValue={resetLink.email} name="email" type="email">
                  <Label>{t.passwordRecovery.email}</Label>
                  <Input autoComplete="email" />
                  <FieldError />
                </TextField>
                <TextField isRequired name="new_password" type="password">
                  <Label>{t.passwordRecovery.newPassword}</Label>
                  <Input autoComplete="new-password" />
                  <FieldError />
                </TextField>
                <TextField isRequired name="confirm_password" type="password">
                  <Label>{t.passwordRecovery.confirmPassword}</Label>
                  <Input autoComplete="new-password" />
                  <FieldError />
                </TextField>
                <div className="login-actions">
                  <Button isPending={isSubmitting} type="submit">{t.passwordRecovery.resetPassword}</Button>
                </div>
              </Form>
            </>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
