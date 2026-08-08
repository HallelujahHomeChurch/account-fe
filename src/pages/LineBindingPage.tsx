import { Button } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { loginPath } from '../auth/auth-routes'
import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type LineBindingSummary } from '../lib/api'
import {
  clearLineLinkAutoContinue,
  consumeLineLinkAutoContinue,
  discardCapturedLineLinkToken,
  getCapturedLineLinkToken,
  markLineLinkAutoContinue,
  navigateToLineAccountLink,
} from '../lib/line-link-intent'

export function LineBindingPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<LineBindingSummary | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const loadRef = useRef<{
    key: number
    token: string | null
    request: Promise<LineBindingSummary> | undefined
  } | null>(null)

  useEffect(() => {
    let active = true
    if (loadRef.current?.key !== retryKey) {
      const token = getCapturedLineLinkToken()
      loadRef.current = {
        key: retryKey,
        token,
        request: token
          ? auth.api.exchangeLineLinkIntent?.(token)
          : auth.api.getLineLinkIntent?.(),
      }
    }
    const { request, token } = loadRef.current

    if (!request) {
      setIsLoading(false)
      setError(t.lineBinding.invalid)
      return
    }

    setIsLoading(true)
    setError('')
    request
      .then((nextSummary) => {
        if (!active) return
        if (token) discardCapturedLineLinkToken()
        setSummary(nextSummary)
      })
      .catch((caught: unknown) => {
        if (token && isTerminalBindingError(caught)) discardCapturedLineLinkToken()
        if (active) setError(bindingError(caught, t.lineBinding))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [auth.api, retryKey, t.lineBinding])

  useEffect(() => () => {
    if (window.location.pathname !== '/line/bind') discardCapturedLineLinkToken()
  }, [])

  const prepare = useCallback(async () => {
    if (!auth.api.prepareLineLinkIntent) {
      setError(t.lineBinding.unavailable)
      return
    }

    setIsPreparing(true)
    setError('')
    try {
      const result = await auth.api.prepareLineLinkIntent()
      if (!navigateToLineAccountLink(result.redirect_url)) {
        setError(t.lineBinding.redirectInvalid)
      }
    } catch (caught) {
      setError(bindingError(caught, t.lineBinding))
    } finally {
      setIsPreparing(false)
    }
  }, [auth.api, t.lineBinding])

  useEffect(() => {
    if (!summary || auth.status !== 'authenticated' || !consumeLineLinkAutoContinue()) return
    void prepare()
  }, [auth.status, prepare, summary])

  function signIn() {
    markLineLinkAutoContinue()
    navigate(loginPath('/line/bind'))
  }

  async function switchAccount() {
    setIsSwitching(true)
    setError('')
    try {
      await (auth.api.logoutAll ? auth.api.logoutAll() : auth.api.logout())
      markLineLinkAutoContinue()
      auth.clearLocalSession(loginPath('/line/bind'))
    } catch {
      setError(t.lineBinding.unavailable)
      setIsSwitching(false)
    }
  }

  function cancel() {
    clearLineLinkAutoContinue()
    discardCapturedLineLinkToken()
    navigate(auth.profile ? '/profile' : '/login', { replace: true })
  }

  return (
    <section className="login-shell" aria-labelledby="line-binding-title">
      <div className="login-card line-binding-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="line-binding-title">{t.lineBinding.title}</h1>
        </div>

        <div className="login-form-panel">
          {isLoading ? <p className="inline-status">{t.lineBinding.loading}</p> : null}
          {error ? (
            <div className="line-binding-state" role="alert">
              <p className="form-error">{error}</p>
              <div className="line-binding-actions">
                <Button variant="ghost" onPress={cancel}>{t.lineBinding.cancel}</Button>
                <Button variant="outline" onPress={() => setRetryKey((value) => value + 1)}>
                  {t.lineBinding.retry}
                </Button>
              </div>
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
                {auth.profile ? (
                  <div>
                    <dt>{t.lineBinding.hhcAccount}</dt>
                    <dd>{auth.profile.email}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="line-binding-actions">
                <Button variant="ghost" onPress={cancel}>{t.lineBinding.cancel}</Button>
                {auth.status === 'authenticated' ? (
                  <>
                    <Button isPending={isSwitching} variant="outline" onPress={() => void switchAccount()}>
                      {t.lineBinding.switchAccount}
                    </Button>
                    <Button isPending={isPreparing} onPress={() => void prepare()}>
                      {t.lineBinding.continue}
                    </Button>
                  </>
                ) : auth.status === 'anonymous' ? (
                  <Button onPress={signIn}>{t.lineBinding.signIn}</Button>
                ) : null}
              </div>
            </>
          ) : null}
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

function isTerminalBindingError(caught: unknown) {
  return caught instanceof ApiError && (
    caught.status === 409
    || caught.status === 410
    || caught.code === 'ACC_LINE_BINDING_INVALID'
    || caught.code === 'ACC_LINE_IDENTITY_CONFLICT'
  )
}
