import { Button } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/locale-context'
import { authErrorMessage } from '../auth/auth-form'
import { AuthResultState } from '../components/AuthResultState'
import { ApiError } from '../lib/api'
import {
  clearNativeAuthContinuation,
  readNativeAuthContinuation,
} from '../lib/native-auth-continuation'

export function VerifyEmailPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const handled = useRef(false)
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [continuation] = useState(readNativeAuthContinuation)
  const [continuationState, setContinuationState] = useState<'checking' | 'active' | 'invalid' | 'unavailable' | 'direct'>(continuation ? 'checking' : 'direct')

  const returnToLogin = () => {
    clearNativeAuthContinuation()
    const search = continuation && continuationState === 'active'
      ? `?${new URLSearchParams({ auth_request_id: continuation.requestId }).toString()}`
      : ''
    navigate(`/login${search}`, { replace: true })
  }

  const checkContinuation = useCallback(async () => {
    if (!continuation || !auth.api.getAuthRequestStatus) {
      setContinuationState('direct')
      return
    }
    setContinuationState('checking')
    try {
      await auth.api.getAuthRequestStatus(continuation.requestId)
      setContinuationState('active')
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setContinuationState('invalid')
      } else {
        setContinuationState('unavailable')
      }
    }
  }, [auth.api, continuation])

  useEffect(() => {
    if (!window.location.hash) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    if (!token || !auth.api.verifyEmail) {
      setError(t.emailVerification.tokenRequired)
      return
    }

    auth.api.verifyEmail(token)
      .then(() => {
        setVerified(true)
        void checkContinuation()
      })
      .catch((caught: unknown) => setError(authErrorMessage(caught, t.emailVerification.requestFailed)))
  }, [auth.api, checkContinuation, t.emailVerification.requestFailed, t.emailVerification.tokenRequired, token])

  return (
    <section className="login-shell" aria-labelledby="verify-email-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="verify-email-title">
            {verified ? t.emailVerification.success : t.emailVerification.title}
          </h1>
        </div>
        <div className="login-form-panel auth-result-state">
          {!verified && !error ? <p className="inline-status" role="status">{t.emailVerification.verifying}</p> : null}
          {verified ? (
            <AuthResultState>{t.emailVerification.successDescription}</AuthResultState>
          ) : null}
          {verified && continuationState === 'checking' ? <p className="inline-status" role="status">{t.login.authRequestChecking}</p> : null}
          {verified && continuationState === 'invalid' ? <p className="form-error" role="alert">{t.login.authRequestInvalid}</p> : null}
          {verified && continuationState === 'unavailable' ? <p className="form-error" role="alert">{t.login.authRequestUnavailable}</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {verified && continuationState === 'unavailable' ? <Button onPress={() => void checkContinuation()}>{t.login.authRequestRetry}</Button> : null}
          {(error || (verified && continuationState !== 'checking' && continuationState !== 'unavailable')) ? (
            <Button onPress={returnToLogin}>{continuationState === 'invalid' ? t.login.authRequestRestart : t.emailVerification.backToLogin}</Button>
          ) : null}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
