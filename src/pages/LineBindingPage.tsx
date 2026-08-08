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
  const [isRetryingAuth, setIsRetryingAuth] = useState(false)
  const [failedStage, setFailedStage] = useState<'load' | 'prepare' | 'switch' | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [shouldAutoContinue, setShouldAutoContinue] = useState(false)
  const operationRef = useRef(0)
  const autoContinueCapturedRef = useRef(false)
  const loadRef = useRef<{
    key: number
    fromFragment: boolean
    request: Promise<LineBindingSummary> | undefined
  } | null>(null)

  useEffect(() => {
    if (autoContinueCapturedRef.current) return
    autoContinueCapturedRef.current = true
    setShouldAutoContinue(consumeLineLinkAutoContinue())
  }, [])

  useEffect(() => {
    let active = true
    if (loadRef.current?.key !== retryKey) {
      const token = getCapturedLineLinkToken()
      loadRef.current = {
        key: retryKey,
        fromFragment: Boolean(token),
        request: token
          ? auth.api.exchangeLineLinkIntent?.(token)
          : auth.api.getLineLinkIntent?.(),
      }
    }
    const { fromFragment, request } = loadRef.current

    if (!request) {
      setIsLoading(false)
      setError(t.lineBinding.invalid)
      return
    }

    setIsLoading(true)
    setError('')
    setFailedStage(null)
    request
      .then((nextSummary) => {
        if (!active) return
        if (fromFragment) discardCapturedLineLinkToken()
        setSummary(nextSummary)
      })
      .catch((caught: unknown) => {
        if (fromFragment && isTerminalBindingError(caught)) discardCapturedLineLinkToken()
        if (active) {
          setFailedStage('load')
          setError(bindingError(caught, t.lineBinding))
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [auth.api, retryKey, t.lineBinding])

  useEffect(() => () => {
    operationRef.current += 1
    if (window.location.pathname !== '/line/bind') discardCapturedLineLinkToken()
  }, [])

  const prepare = useCallback(async () => {
    const operation = ++operationRef.current
    if (!auth.api.prepareLineLinkIntent) {
      setError(t.lineBinding.unavailable)
      setFailedStage('prepare')
      return
    }

    setIsPreparing(true)
    setError('')
    setFailedStage(null)
    try {
      const result = await auth.api.prepareLineLinkIntent()
      if (operation !== operationRef.current) return
      if (!navigateToLineAccountLink(result.redirect_url)) {
        setError(t.lineBinding.redirectInvalid)
        setFailedStage('prepare')
      }
    } catch (caught) {
      if (operation !== operationRef.current) return
      setError(bindingError(caught, t.lineBinding))
      setFailedStage('prepare')
    } finally {
      if (operation === operationRef.current) setIsPreparing(false)
    }
  }, [auth.api, t.lineBinding])

  useEffect(() => {
    if (!shouldAutoContinue || !summary || auth.status !== 'authenticated') return
    setShouldAutoContinue(false)
    void prepare()
  }, [auth.status, prepare, shouldAutoContinue, summary])

  function signIn() {
    markLineLinkAutoContinue()
    navigate(loginPath('/line/bind'))
  }

  async function switchAccount() {
    const operation = ++operationRef.current
    setIsPreparing(false)
    setIsSwitching(true)
    setError('')
    setFailedStage(null)
    try {
      await (auth.api.logoutAll ? auth.api.logoutAll() : auth.api.logout())
      if (operation !== operationRef.current) return
      markLineLinkAutoContinue()
      auth.clearLocalSession(loginPath('/line/bind'))
    } catch {
      if (operation !== operationRef.current) return
      setError(t.lineBinding.unavailable)
      setFailedStage('switch')
    } finally {
      if (operation === operationRef.current) setIsSwitching(false)
    }
  }

  function cancel() {
    operationRef.current += 1
    clearLineLinkAutoContinue()
    discardCapturedLineLinkToken()
    navigate(auth.profile ? '/profile' : '/login', { replace: true })
  }

  function retry() {
    if (failedStage === 'prepare') {
      void prepare()
    } else if (failedStage === 'switch') {
      void switchAccount()
    } else {
      setRetryKey((value) => value + 1)
    }
  }

  async function retryAuth() {
    const operation = ++operationRef.current
    setIsRetryingAuth(true)
    try {
      await auth.retrySession()
    } finally {
      if (operation === operationRef.current) setIsRetryingAuth(false)
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
          {isLoading ? <p className="inline-status">{t.lineBinding.loading}</p> : null}
          {error ? (
            <div className="line-binding-state" role="alert">
              <p className="form-error">{error}</p>
              <div className="line-binding-actions">
                <Button variant="ghost" onPress={cancel}>{t.lineBinding.cancel}</Button>
                <Button variant="outline" onPress={retry}>
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
              {auth.status === 'unavailable' ? (
                <div className="line-binding-state" role="alert">
                  <p className="form-error">{t.lineBinding.authUnavailable}</p>
                  <div className="line-binding-actions">
                    <Button variant="ghost" onPress={cancel}>{t.lineBinding.cancel}</Button>
                    <Button isPending={isRetryingAuth} variant="outline" onPress={() => void retryAuth()}>
                      {t.lineBinding.retryAuth}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="line-binding-actions">
                  <Button isDisabled={isSwitching} variant="ghost" onPress={cancel}>
                    {t.lineBinding.cancel}
                  </Button>
                  {auth.status === 'authenticated' ? (
                    <>
                      <Button isDisabled={isSwitching} isPending={isSwitching} variant="outline" onPress={() => void switchAccount()}>
                        {t.lineBinding.switchAccount}
                      </Button>
                      <Button isDisabled={isSwitching} isPending={isPreparing} onPress={() => void prepare()}>
                        {t.lineBinding.continue}
                      </Button>
                    </>
                  ) : auth.status === 'anonymous' ? (
                    <Button onPress={signIn}>{t.lineBinding.signIn}</Button>
                  ) : null}
                </div>
              )}
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
