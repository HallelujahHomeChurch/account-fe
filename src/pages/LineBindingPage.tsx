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
  const labelsRef = useRef(t.lineBinding)
  labelsRef.current = t.lineBinding
  const [summary, setSummary] = useState<LineBindingSummary | null>(null)
  const [returnUrl, setReturnUrl] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isRetryingAuth, setIsRetryingAuth] = useState(false)
  const [failedStage, setFailedStage] = useState<'load' | 'prepare' | 'switch' | 'cancel' | 'status' | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const operationRef = useRef(0)
  const switchPreparedRef = useRef(false)
  const autoContinueCapturedRef = useRef(false)
  const viewNonceRef = useRef<string | undefined>(undefined)
  const loadRef = useRef<{
    key: number
    fromFragment: boolean
    request: Promise<LineBindingSummary> | undefined
  } | null>(null)

  useEffect(() => {
    if (autoContinueCapturedRef.current) return
    autoContinueCapturedRef.current = true
    consumeLineLinkAutoContinue()
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
      setError(labelsRef.current.invalid)
      return
    }

    setIsLoading(true)
    setError('')
    setFailedStage(null)
    setReturnUrl('')
    request
      .then((nextSummary) => {
        if (!active) return
        if (fromFragment) discardCapturedLineLinkToken()
        viewNonceRef.current = nextSummary.view_nonce
        setSummary(nextSummary)
      })
      .catch((caught: unknown) => {
        if (fromFragment && isTerminalBindingError(caught)) discardCapturedLineLinkToken()
        if (active) {
          setFailedStage('load')
          setError(bindingError(caught, labelsRef.current))
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [auth.api, retryKey])

  useEffect(() => () => {
    operationRef.current += 1
    viewNonceRef.current = undefined
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
    setReturnUrl('')
    try {
      const result = await auth.api.prepareLineLinkIntent(viewNonceRef.current)
      if (operation !== operationRef.current) return
      const nextReturnUrl = result.return_url ?? result.redirect_url
      if (!nextReturnUrl || !navigateToLineAccountLink(nextReturnUrl)) {
        setError(t.lineBinding.redirectInvalid)
        setFailedStage('prepare')
      } else {
        setReturnUrl(nextReturnUrl)
      }
    } catch (caught) {
      if (operation !== operationRef.current) return
      setError(bindingError(caught, t.lineBinding))
      setFailedStage('prepare')
    } finally {
      if (operation === operationRef.current) setIsPreparing(false)
    }
  }, [auth.api, t.lineBinding])

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
      if (!switchPreparedRef.current) {
        if (!auth.api.restartLineLinkIntent || !viewNonceRef.current) throw new Error('LINE restart unavailable')
        const replacement = await auth.api.restartLineLinkIntent(viewNonceRef.current)
        if (operation !== operationRef.current) return
        if (!replacement.view_nonce || replacement.view_nonce === viewNonceRef.current || replacement.current !== true || replacement.status !== 'created') throw new Error('Invalid replacement intent')
        viewNonceRef.current = replacement.view_nonce
        setSummary(replacement)
        switchPreparedRef.current = true
      }
      await auth.api.logout()
      if (operation !== operationRef.current) return
      markLineLinkAutoContinue()
      auth.clearLocalSession(loginPath('/line/bind'))
    } catch (caught) {
      if (operation !== operationRef.current) return
      if (isTerminalBindingError(caught)) {
        setIsSwitching(false)
        await checkStatus()
        return
      }
      setError(t.lineBinding.unavailable)
      setFailedStage('switch')
    } finally {
      if (operation === operationRef.current) setIsSwitching(false)
    }
  }

  function close() {
    operationRef.current += 1
    clearLineLinkAutoContinue()
    discardCapturedLineLinkToken()
    viewNonceRef.current = undefined
    navigate(auth.profile ? '/profile' : '/login', { replace: true })
  }

  async function cancel() {
    if (!viewNonceRef.current) { close(); return }
    const operation = ++operationRef.current
    setIsPreparing(false)
    setIsCancelling(true)
    setIsChecking(false)
    setError('')
    setReturnUrl('')
    try {
      if (!auth.api.cancelLineLinkIntent) throw new Error('LINE cancellation unavailable')
      const result = await auth.api.cancelLineLinkIntent(viewNonceRef.current)
      if (operation !== operationRef.current) return
      clearLineLinkAutoContinue()
      discardCapturedLineLinkToken()
      setSummary((current) => ({ ...current, ...result }))
      setFailedStage(null)
    } catch (caught) {
      if (operation !== operationRef.current) return
      setError(bindingError(caught, t.lineBinding))
      setFailedStage('cancel')
    } finally {
      if (operation === operationRef.current) setIsCancelling(false)
    }
  }

  async function checkStatus() {
    const operation = ++operationRef.current
    const expectedView = viewNonceRef.current
    setIsChecking(true)
    setError('')
    try {
      if (!auth.api.getLineLinkIntent) throw new Error('LINE status unavailable')
      const current = await auth.api.getLineLinkIntent()
      if (operation !== operationRef.current) return
      if (current.view_nonce !== expectedView) {
        setSummary((previous) => previous ? { ...previous, status: 'superseded', current: false } : null)
      } else {
        setSummary(current)
      }
      setFailedStage(null)
    } catch (caught) {
      if (operation !== operationRef.current) return
      setError(bindingError(caught, t.lineBinding))
      setFailedStage('status')
    } finally {
      if (operation === operationRef.current) setIsChecking(false)
    }
  }

  function retry() {
    if (failedStage === 'cancel') {
      void cancel()
    } else if (failedStage === 'status') {
      void checkStatus()
    } else if (failedStage === 'prepare') {
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

  const terminalMessage = summary?.current === false ? t.lineBinding.superseded
    : summary?.status === 'completed' ? t.lineBinding.completed
    : summary?.status === 'cancelled' ? t.lineBinding.cancelled
    : summary?.status === 'superseded' ? t.lineBinding.superseded
    : summary?.status === 'expired' ? t.lineBinding.expired
    : summary?.status === 'conflict' ? t.lineBinding.conflict
    : summary?.status && !['created', 'consented', 'awaiting_line'].includes(summary.status) ? t.lineBinding.invalid : ''

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
                <Button isDisabled={isCancelling} variant="ghost" onPress={() => void cancel()}>{t.lineBinding.cancel}</Button>
                <Button variant="outline" onPress={retry}>
                  {t.lineBinding.retry}
                </Button>
              </div>
            </div>
          ) : null}
          {terminalMessage && !error ? (
            <div className="line-binding-state" role="status">
              <p>{terminalMessage}</p>
              <Button variant="ghost" onPress={close}>{t.lineBinding.close}</Button>
            </div>
          ) : null}
          {returnUrl && !error && !terminalMessage ? (
            <div className="line-binding-state" role="status">
              <p className="inline-status">{t.lineBinding.success}</p>
              <div className="line-binding-actions">
                <Button onPress={() => navigateToLineAccountLink(returnUrl)}>
                  {t.lineBinding.returnToLine}
                </Button>
                <Button isPending={isChecking} variant="outline" onPress={() => void checkStatus()}>{t.lineBinding.checkStatus}</Button>
                <Button isPending={isCancelling} isDisabled={isChecking} variant="ghost" onPress={() => void cancel()}>{t.lineBinding.cancel}</Button>
              </div>
            </div>
          ) : null}
          {summary && !error && !returnUrl && !terminalMessage ? (
            <>
              <p className="auth-subtitle">{t.lineBinding.description}</p>
              <dl className="line-binding-details">
                <div>
                  <dt>{t.lineBinding.lineOfficialAccount}</dt>
                  <dd>{summary.line_account_name || t.lineBinding.officialAccountFallback}</dd>
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
                    <Button isDisabled={isCancelling} variant="ghost" onPress={() => void cancel()}>{t.lineBinding.cancel}</Button>
                    <Button isPending={isRetryingAuth} variant="outline" onPress={() => void retryAuth()}>
                      {t.lineBinding.retryAuth}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="line-binding-actions">
                  <Button isDisabled={isSwitching || isCancelling} variant="ghost" onPress={() => void cancel()}>
                    {t.lineBinding.cancel}
                  </Button>
                  {auth.status === 'authenticated' ? (
                    <>
                      <Button isDisabled={isSwitching || isCancelling} isPending={isSwitching} variant="outline" onPress={() => void switchAccount()}>
                        {t.lineBinding.switchAccount}
                      </Button>
                      <Button isDisabled={isSwitching || isCancelling} isPending={isPreparing} onPress={() => void prepare()}>
                        {t.lineBinding.confirm}
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
