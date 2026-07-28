import { Button } from '@hhc/ui'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type LineBindingSummary } from '../lib/api'

export function LineBindingPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [summary, setSummary] = useState<LineBindingSummary | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    if (!token || !auth.api.getLineBinding) {
      setIsLoading(false)
      setError(t.lineBinding.invalid)
      return
    }

    setIsLoading(true)
    setError('')
    auth.api
      .getLineBinding(token)
      .then((nextSummary) => {
        if (active) setSummary(nextSummary)
      })
      .catch((caught: unknown) => {
        if (active) setError(bindingError(caught, t.lineBinding))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [auth.api, retryKey, t.lineBinding, token])

  async function confirm() {
    if (!token || !auth.api.confirmLineBinding) return
    setIsConfirming(true)
    setError('')
    try {
      await auth.api.confirmLineBinding(token)
      setIsComplete(true)
      navigate('/line/bind', { replace: true })
    } catch (caught) {
      setError(bindingError(caught, t.lineBinding))
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <section className="login-shell" aria-labelledby="line-binding-title">
      <div className="login-card line-binding-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="line-binding-title">{t.lineBinding.title}</h1>
        </div>

        <div className="login-form-panel">
          {isComplete ? (
            <div className="line-binding-state">
              <p className="form-notice">{t.lineBinding.success}</p>
              <div className="login-actions">
                <Button onPress={() => navigate('/profile', { replace: true })}>
                  {t.lineBinding.done}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {isLoading ? <p className="inline-status">{t.lineBinding.loading}</p> : null}
              {error ? (
                <div className="line-binding-state" role="alert">
                  <p className="form-error">{error}</p>
                  {token ? (
                    <Button variant="outline" onPress={() => setRetryKey((value) => value + 1)}>
                      {t.lineBinding.retry}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {summary && !error ? (
                <>
                  <p className="auth-subtitle">{t.lineBinding.description}</p>
                  <dl className="line-binding-details">
                    <div>
                      <dt>{t.lineBinding.lineProfile}</dt>
                      <dd>{summary.profile_name}</dd>
                    </div>
                    <div>
                      <dt>{t.lineBinding.hhcAccount}</dt>
                      <dd>{auth.profile?.email}</dd>
                    </div>
                  </dl>
                  <div className="line-binding-actions">
                    <Button variant="ghost" onPress={() => navigate('/profile', { replace: true })}>
                      {t.lineBinding.cancel}
                    </Button>
                    <Button isPending={isConfirming} onPress={() => void confirm()}>
                      {t.lineBinding.connect}
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="login-footer">
        <LanguageSelector />
      </div>
    </section>
  )
}

function bindingError(caught: unknown, labels: {
  expired: string
  conflict: string
  unavailable: string
}) {
  if (caught instanceof ApiError) {
    if (caught.status === 410 || caught.code === 'ACC_LINE_BINDING_INVALID') return labels.expired
    if (caught.status === 409 || caught.code === 'ACC_LINE_IDENTITY_CONFLICT') return labels.conflict
  }
  return labels.unavailable
}
