import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { LanguageSelector } from '../components/LanguageSelector'
import { LegalAcceptance } from '../components/LegalAcceptance'
import { useAuthCapabilitiesState } from '../components/SocialAuthOptions'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type PolicyCapabilities } from '../lib/api'

export function PolicyAcceptancePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { locale, messages: t } = useLocale()
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState(!token)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPolicy, setCurrentPolicy] = useState<PolicyCapabilities | null>(null)
  const { capabilities, error: capabilitiesError, retry } = useAuthCapabilitiesState()
  const policy = currentPolicy ?? capabilities?.policy ?? null
  const policyReady = Boolean(policy?.terms_version && policy.privacy_notice_version)

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [])

  async function submit() {
    if (!token || !policy?.terms_version || !policy.privacy_notice_version || !accepted || !auth.api.confirmPolicyAcceptance) return
    setError('')
    setIsSubmitting(true)
    try {
      const response = await auth.api.confirmPolicyAcceptance(token, {
        accepted: true,
        terms_version: policy.terms_version,
        privacy_notice_version: policy.privacy_notice_version,
        locale,
      })
      await auth.completeLogin(response)
      if (response.redirect_type !== 'oauth') navigate('/profile', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'ACC_POLICY_VERSION_CHANGED') {
        const data = caught.data as Partial<PolicyCapabilities & { policy_token: string }>
        if (data.policy_token && data.terms_version && data.privacy_notice_version) {
          setToken(data.policy_token)
          setCurrentPolicy({
            enforced: true,
            terms_version: data.terms_version,
            privacy_notice_version: data.privacy_notice_version,
          })
          setAccepted(false)
          return
        }
      }
      if (caught instanceof ApiError && ['ACC_POLICY_TOKEN_INVALID', 'ACC_AUTH_INVALID'].includes(caught.code ?? '')) {
        setInvalid(true)
      } else {
        setError(t.policyAcceptance.failed)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-shell" aria-labelledby="policy-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="policy-title">{t.policyAcceptance.title}</h1>
          <p>{t.policyAcceptance.description}</p>
        </div>
        <div className="login-form-panel">
          {invalid ? (
            <>
              <p className="form-error" role="alert">{t.policyAcceptance.invalid}</p>
              <Link className="muted-link" to="/login">{t.policyAcceptance.restart}</Link>
            </>
          ) : null}
          {!invalid && (capabilitiesError || (capabilities && !policyReady)) ? (
            <div role="alert">
              <p className="form-error">{t.legalAcceptance.loadFailed}</p>
              <Button onPress={retry} variant="secondary">{t.legalAcceptance.retry}</Button>
            </div>
          ) : null}
          {!invalid && policyReady ? (
            <div className="form-stack">
              <LegalAcceptance checked={accepted} onChange={setAccepted} />
              <div className="login-actions">
                <Button isDisabled={!accepted} isPending={isSubmitting} onPress={submit}>
                  {t.policyAcceptance.continue}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
