import { useEffect, useRef, useState } from 'react'
import { createAccountDataRequestsClient } from '@hallelujahhomechurch/account-client'
import { useLocale } from '../../i18n/locale-context'
import { clearVerificationToken, readVerificationToken } from '../../lib/email-correction-entry'
import { EmailCorrectionVerification, type VerificationView } from '../../pages/EmailCorrectionVerification'

type PublicFailure = { status?: number; code?: string; retryAfter?: string | null }
// This document never imports AccountApi or AuthProvider, including for discovery.
const client = createAccountDataRequestsClient(async (path, options) => {
  const response = await fetch(`/api/account/v1${path}`, {
    method: options.method,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
  })
  const data: unknown = await response.json()
  if (!response.ok) throw { status: response.status, code: data && typeof data === 'object' && 'errorCode' in data ? data.errorCode : undefined, retryAfter: response.headers.get('Retry-After') }
  return data
})
export function PublicVerificationRoute() {
  const { locale } = useLocale()
  const [view, setView] = useState<VerificationView>(() => readVerificationToken() ? 'verifying' : 'missing_token')
  const enabled = useRef<boolean | null>(null)
  const busy = useRef(false)
  const [retryAt, setRetryAt] = useState(0)
  const discovery = useRef<ReturnType<typeof client.capability> | null>(null)
  function fail(error: unknown) {
    const value = error as PublicFailure
    if (value.status === 429) {
      const seconds = Number(value.retryAfter)
      setRetryAt(value.retryAfter && Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Math.max(Date.now() + 30000, Date.parse(value.retryAfter ?? '') || 0))
    }
    if (!value.status || value.status >= 500 || value.status === 429 || value.status >= 200 && value.status < 300) setView('unavailable')
    else { clearVerificationToken(); setView(value.code === 'ACC_CORRECTION_DISABLED' ? 'disabled' : 'invalid') }
  }
  useEffect(() => {
    if (!readVerificationToken()) return
    let active = true
    discovery.current ??= client.capability()
    void discovery.current.then(result => {
      if (!active) return
      enabled.current = result.dataRequests.emailCorrection.enabled
      setView(enabled.current ? 'ready' : 'disabled')
    }).catch(error => { if (active) fail(error) })
    return () => { active = false }
  }, [])
  async function verify() {
    const token = readVerificationToken()
    if (!token || enabled.current !== true || busy.current || view === 'verifying' || Date.now() < retryAt) return
    busy.current = true
    setView('verifying')
    try {
      await client.verifyEmail({ token })
      clearVerificationToken()
      setView('verified')
    } catch (error) { fail(error) }
    finally { busy.current = false }
  }
  async function retryDiscovery() {
    if (busy.current || Date.now() < retryAt) return
    busy.current = true
    setView('verifying')
    try { enabled.current = (await client.capability()).dataRequests.emailCorrection.enabled; setView(enabled.current ? 'ready' : 'disabled') }
    catch (error) { fail(error) }
    finally { busy.current = false }
  }
  return <EmailCorrectionVerification retryAt={retryAt} canVerify={enabled.current === true} onRetry={() => void retryDiscovery()} locale={locale} view={view} onVerify={() => void verify()} onReturn={() => { clearVerificationToken(); window.location.assign('/data-requests') }} />
}
