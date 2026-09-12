import { useId } from 'react'

import { useLocale } from '../i18n/locale-context'
import { readRuntimeConfig } from '../lib/redirects'

type LegalAcceptanceProps = {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function LegalAcceptance({ checked, onChange }: LegalAcceptanceProps) {
  const { locale, messages: t } = useLocale()
  const baseUrl = readRuntimeConfig().publicSiteUrl
  const inputId = useId()
  const accessibleLabel = [
    t.legalAcceptance.prefix,
    t.legalAcceptance.terms,
    t.legalAcceptance.middle,
    t.legalAcceptance.privacy,
  ].filter(Boolean).join(' ') + t.legalAcceptance.suffix

  return (
    <div className="auth-consent legal-acceptance">
      <input
        aria-label={accessibleLabel}
        checked={checked}
        id={inputId}
        name="policy_accepted"
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        <label htmlFor={inputId}>{t.legalAcceptance.prefix}{' '}</label>
        <a href={`${baseUrl}/${locale}/terms-of-use`} rel="noopener noreferrer" target="_blank">
          {t.legalAcceptance.terms}
        </a>{' '}
        <label htmlFor={inputId}>{t.legalAcceptance.middle}{' '}</label>
        <a href={`${baseUrl}/${locale}/privacy-policy`} rel="noopener noreferrer" target="_blank">
          {t.legalAcceptance.privacy}
        </a>
        <label htmlFor={inputId}>{t.legalAcceptance.suffix}</label>
      </span>
    </div>
  )
}
