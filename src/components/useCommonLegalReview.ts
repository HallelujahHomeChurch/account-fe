import type { LegalSnapshot } from '@hallelujahhomechurch/account-client'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { PolicyCapabilities } from '../lib/api'

export function useCommonLegalReview(
  policy: PolicyCapabilities | null | undefined,
) {
  const { api } = useAuth()
  const { locale } = useLocale()
  const required = policy?.snapshot_enforced === true
  const key = `${locale}:${policy?.terms_version}:${policy?.privacy_notice_version}`
  const [result, setResult] = useState<{
    key: string
    snapshot?: LegalSnapshot
    failed?: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!required) return
    let active = true
    setResult(null)
    const request = api.getCommonLegalSnapshot
      ? api.getCommonLegalSnapshot(locale)
      : Promise.reject(new Error('Legal documents unavailable'))
    request
      .then((snapshot) => {
        if (
          snapshot.manifest.termsVersion !== policy?.terms_version ||
          snapshot.manifest.privacyNoticeVersion !==
            policy?.privacy_notice_version
        )
          throw new Error('Legal versions changed')
        if (active) setResult({ key, snapshot })
      })
      .catch(() => {
        if (active) setResult({ key, failed: true })
      })
    return () => {
      active = false
    }
  }, [
    api,
    required,
    locale,
    key,
    attempt,
    policy?.terms_version,
    policy?.privacy_notice_version,
  ])
  const current = result?.key === key ? result : null
  return {
    required,
    ready: !required || Boolean(current?.snapshot),
    snapshot: current?.snapshot,
    failed: current?.failed === true,
    retry: () => setAttempt((value) => value + 1),
  }
}
