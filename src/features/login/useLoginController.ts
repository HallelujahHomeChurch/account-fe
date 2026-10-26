import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { clearPostLoginReturnTo, readPostLoginReturnTo, safeReturnTo, savePostLoginReturnTo } from '../../auth/auth-routes'
import { authErrorMessage } from '../../auth/auth-form'
import { useAuthCapabilitiesState } from '../../auth/use-auth-capabilities'
import { useLocale } from '../../i18n/locale-context'
import { ApiError } from '../../lib/api'
import { clearNativeAuthContinuation, saveNativeAuthContinuation } from '../../lib/native-auth-continuation'
import { readRuntimeConfig } from '../../lib/redirects'
import { emailCorrectionMessages } from '../email-correction/messages'

export function useLoginController() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const authRequestId = searchParams.get('auth_request_id') ?? undefined
  const authRequestSearch = authRequestId
    ? `?${new URLSearchParams({ auth_request_id: authRequestId }).toString()}`
    : ''
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
    registrationState?.registrationComplete ? t.registration.verificationSent : searchParams.get('email_correction') === '1' ? emailCorrectionMessages[locale].unauthorized : '',
  )
  const [isSuccessNotice, setIsSuccessNotice] = useState(Boolean(registrationState?.registrationComplete))
  const [initialEmail] = useState(registrationState?.registrationEmail ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { capabilities } = useAuthCapabilitiesState()
  const registrationEnabled = capabilities?.registrationEnabled === true
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [transactionState, setTransactionState] = useState<'checking' | 'active' | 'invalid' | 'unavailable'>(authRequestId ? 'checking' : 'active')
  const authRequestCheckRef = useRef(0)
  const authRequestTimerRef = useRef<number | undefined>(undefined)
  const [turnstileSiteKey] = useState(() => readRuntimeConfig().turnstileSiteKey ?? '')
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])

  const checkAuthRequest = useCallback(async () => {
    const revision = ++authRequestCheckRef.current
    if (authRequestTimerRef.current !== undefined) window.clearTimeout(authRequestTimerRef.current)
    if (!authRequestId || !auth.api.getAuthRequestStatus) {
      setTransactionState('active')
      return
    }
    setTransactionState('checking')
    try {
      const status = await auth.api.getAuthRequestStatus(authRequestId)
      if (revision !== authRequestCheckRef.current) return
      const expiresAt = Date.parse(status.expires_at)
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      saveNativeAuthContinuation(authRequestId, { clientId: status.client_id, clientName: status.client_name })
      setTransactionState('active')
      authRequestTimerRef.current = window.setTimeout(() => {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
      }, expiresAt - Date.now())
    } catch (caught) {
      if (revision !== authRequestCheckRef.current) return
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
      } else {
        setTransactionState('unavailable')
      }
    }
  }, [auth.api, authRequestId])

  useEffect(() => {
    void checkAuthRequest()
    const recheck = () => void checkAuthRequest()
    window.addEventListener('pageshow', recheck)
    return () => {
      authRequestCheckRef.current += 1
      if (authRequestTimerRef.current !== undefined) window.clearTimeout(authRequestTimerRef.current)
      window.removeEventListener('pageshow', recheck)
    }
  }, [checkAuthRequest])

  const title = t.login.brandTitle
  const challenge = auth.mfaChallenge
  const mfaSubtitle = t.login.mfaVerificationSubtitle

  useEffect(() => {
    const pendingReturnTo = readPostLoginReturnTo()
    if (authRequestId || (pendingReturnTo !== null && (pendingReturnTo === '/profile' || pendingReturnTo !== returnTo))) {
      clearPostLoginReturnTo()
    }
  }, [authRequestId, returnTo])

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
      clearPostLoginReturnTo()
      const message = {
        account_conflict: t.login.oauthAccountConflict,
        cancelled: t.login.oauthCancelled,
        organization_not_allowed: t.login.oauthOrganizationNotAllowed,
        registration_unavailable: t.login.oauthRegistrationUnavailable,
        state_expired: t.login.oauthStateExpired,
        workspace_not_allowed: t.login.oauthWorkspaceNotAllowed,
        auth_request_invalid: t.login.authRequestInvalid,
      }[oauthError] ?? t.login.oauthFailed

      if (oauthError === 'cancelled') {
        setNotice(message)
        setIsSuccessNotice(false)
      } else {
        setError(message)
      }
    }
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('signed_out')
    nextSearchParams.delete('password_changed')
    nextSearchParams.delete('oauth_error')
    nextSearchParams.delete('oauth_provider')
    nextSearchParams.delete('locale')
    const search = nextSearchParams.toString()
    navigate({ pathname: '/login', search: search ? `?${search}` : '' }, { replace: true })
  }, [
    navigate,
    oauthError,
    passwordChanged,
    searchParams,
    signedOut,
    t.login.oauthCancelled,
    t.login.oauthAccountConflict,
    t.login.oauthFailed,
    t.login.oauthOrganizationNotAllowed,
    t.login.oauthRegistrationUnavailable,
    t.login.oauthStateExpired,
    t.login.oauthWorkspaceNotAllowed,
    t.login.authRequestInvalid,
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

  async function submitLogin(credentials: { email: string; password: string }) {
    if (turnstileSiteKey && !turnstileToken) return
    setError('')
    setNotice('')
    setIsSuccessNotice(false)
    setIsSubmitting(true)


    try {
      const response = await auth.login({
        email: credentials.email,
        password: credentials.password,
        authRequestId,
        turnstileToken: turnstileToken || undefined,
      })
      if (response.policy_acceptance_required && response.policy_token) {
        if (!authRequestId) savePostLoginReturnTo(returnTo)
        navigate(`/policy/acceptance#token=${encodeURIComponent(response.policy_token)}`, { replace: true })
      } else if (response.access_token) {
        clearPostLoginReturnTo()
        navigate(returnTo, { replace: true })
      } else if (!response.mfa_type) {
        setNotice(t.login.signedIn)
        setIsSuccessNotice(true)
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      setError(authErrorMessage(caught, t.login.failed, {
        ACC_AUTH_INVALID_CREDENTIALS: t.login.invalidCredentials,
        ACC_AUTH_RATE_LIMITED: t.login.rateLimited,
      }))
      if (turnstileSiteKey) {
        setTurnstileToken('')
        setTurnstileAttempt((attempt) => attempt + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitMfa(code: string) {
    if (!challenge) return

    setError('')
    setIsSubmitting(true)

    try {
      const response = await auth.verifyMfa(code)
      if (response.policy_acceptance_required && response.policy_token) {
        if (!authRequestId) savePostLoginReturnTo(returnTo)
        navigate(`/policy/acceptance#token=${encodeURIComponent(response.policy_token)}`, { replace: true })
      } else if (response.access_token) {
        clearPostLoginReturnTo()
        navigate(returnTo, { replace: true })
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_AUTH_REQUEST_INVALID') {
        clearNativeAuthContinuation()
        setTransactionState('invalid')
        return
      }
      setError(authErrorMessage(caught, t.login.mfaFailed))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    messages: t, title, challenge, mfaSubtitle, transactionState,
    loading: Boolean(auth.isBootstrapping && auth.api.getSession && !authRequestId && !signedOut && !passwordChanged && !oauthError),
    error: error || auth.bootstrapError, notice, isSuccessNotice, initialEmail, isSubmitting,
    authRequestId, authRequestSearch, returnTo, registrationEnabled, providerIds: capabilities?.providers ?? null,
    turnstileAttempt, turnstileSiteKey, passwordDisabled: Boolean(turnstileSiteKey && !turnstileToken),
    handleTurnstileToken, submitLogin, submitMfa,
    recover: () => transactionState === 'invalid' ? navigate('/login', {replace: true}) : void checkAuthRequest(),
  }
}
