/* oxlint-disable react/only-export-components */
import { useMemo } from 'react'
import { supportedSocialProviderIds } from '../auth/use-auth-capabilities'
export { useAuthCapabilities, useAuthCapabilitiesState } from '../auth/use-auth-capabilities'

import { useAuth } from '../auth/auth-context'
import { savePostLoginReturnTo } from '../auth/auth-routes'
import { useLocale } from '../i18n/locale-context'
import { SocialIcon } from './SocialIcon'

const providerLabels = {google: 'Google', line: 'LINE', microsoft: 'Microsoft'}
const socialProviders = supportedSocialProviderIds.map(id => ({id, label: providerLabels[id]}))

type SocialAuthOptionsProps = {
  providerIds: string[] | null
  authRequestId?: string
  dividerLabel: string
  dividerPosition?: 'before' | 'after'
  returnTo?: string
}

export function SocialAuthOptions({
  providerIds,
  authRequestId,
  dividerLabel,
  dividerPosition = 'before',
  returnTo,
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
              onClick={() => {
                if (returnTo && !authRequestId) savePostLoginReturnTo(returnTo)
              }}
              title={label}
            >
              <SocialIcon provider={link.id} />
              <span>{label}</span>
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
