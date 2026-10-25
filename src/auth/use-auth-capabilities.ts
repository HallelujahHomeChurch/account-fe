import { useEffect, useState } from 'react'
import { useAuth } from './auth-context'
import type { AuthCapabilities } from '../lib/api'

export const supportedSocialProviderIds = ['google', 'line', 'microsoft'] as const

export function useAuthCapabilities() {
  return useAuthCapabilitiesState().capabilities
}

export function useAuthCapabilitiesState(enabled = true) {
  const auth = useAuth()
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const request = auth.api.getAuthCapabilities
      ? auth.api.getAuthCapabilities()
      : auth.api.getOAuthProviders
        ? auth.api.getOAuthProviders().then((providers) => ({ providers, registrationEnabled: false, policy: { enforced: false, terms_version: '', privacy_notice_version: '' } }))
        : Promise.resolve({ providers: [...supportedSocialProviderIds], registrationEnabled: false, policy: { enforced: false, terms_version: '', privacy_notice_version: '' } })

    request
      .then((nextCapabilities) => {
        if (nextCapabilities.policy?.enforced && (!nextCapabilities.policy.terms_version || !nextCapabilities.policy.privacy_notice_version)) {
          throw new Error('Policy versions missing')
        }
        if (active) {
          setCapabilities(nextCapabilities)
          setError(false)
        }
      })
      .catch(() => {
        if (active) {
          setCapabilities(null)
          setError(true)
        }
      })

    return () => {
      active = false
    }
  }, [attempt, auth.api, enabled])

  return { capabilities, error, retry: () => setAttempt((value) => value + 1) }
}

