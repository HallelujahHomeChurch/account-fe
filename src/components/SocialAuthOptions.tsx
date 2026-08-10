/* oxlint-disable react/only-export-components */
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { AuthCapabilities } from '../lib/api'
import { SocialIcon } from './SocialIcon'

const socialProviders = [
  { id: 'google', label: 'Google' },
  { id: 'line', label: 'LINE' },
  { id: 'microsoft', label: 'Microsoft' },
]

type SocialAuthOptionsProps = {
  providerIds: string[] | null
  authRequestId?: string
  dividerLabel: string
  dividerPosition?: 'before' | 'after'
}

export function useAuthCapabilities() {
  const auth = useAuth()
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null)

  useEffect(() => {
    let active = true
    const request = auth.api.getAuthCapabilities
      ? auth.api.getAuthCapabilities()
      : auth.api.getOAuthProviders
        ? auth.api.getOAuthProviders().then((providers) => ({ providers, registrationEnabled: false }))
        : Promise.resolve({ providers: socialProviders.map(({ id }) => id), registrationEnabled: false })

    request
      .then((nextCapabilities) => {
        if (active) setCapabilities(nextCapabilities)
      })
      .catch(() => {
        if (active) setCapabilities({ providers: [], registrationEnabled: false })
      })

    return () => {
      active = false
    }
  }, [auth.api])

  return capabilities
}

export function SocialAuthOptions({
  providerIds,
  authRequestId,
  dividerLabel,
  dividerPosition = 'before',
}: SocialAuthOptionsProps) {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const socialLinks = useMemo(() => {
    if (!auth.api.getSocialLoginUrl || !providerIds) return []
    return socialProviders.flatMap((provider) => {
      if (!providerIds.includes(provider.id)) return []
      const href = auth.api.getSocialLoginUrl?.(provider.id, authRequestId)
      return href ? [{ ...provider, href }] : []
    })
  }, [auth.api, authRequestId, providerIds])

  if (!socialLinks.length) return null

  const divider = (
    <div className="social-divider">
      <span>{dividerLabel}</span>
    </div>
  )

  return (
    <div className="social-login-panel" aria-label={t.login.socialLogin}>
      {dividerPosition === 'before' ? divider : null}
      <div className="social-icon-list">
        {socialLinks.map((link) => {
          const label = socialLabel(t.login.socialPrefix, link.label, t.login.socialSuffix)
          return (
            <a
              key={link.id}
              aria-label={label}
              className={`social-icon-button social-icon-button--${link.id}`}
              href={link.href}
              title={label}
            >
              <SocialIcon provider={link.id} />
            </a>
          )
        })}
      </div>
      {dividerPosition === 'after' ? divider : null}
    </div>
  )
}

function socialLabel(prefix: string, provider: string, suffix: string) {
  return [prefix, provider, suffix].filter(Boolean).join(' ')
}
