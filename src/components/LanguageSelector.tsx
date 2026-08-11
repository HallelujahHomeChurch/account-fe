import { Select } from '@hallelujahhomechurch/ui'

import { localeMetadata, locales, type Locale } from '../i18n/locales'
import { useLocale } from '../i18n/locale-context'

type LanguageSelectorProps = {
  className?: string
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, messages: t, setLocale } = useLocale()

  return (
    <Select
      className={className}
      hideLabel
      items={localeMetadata.map(({ code, shortLabel, nativeLabel }) => ({
        id: code,
        label: shortLabel,
        ariaLabel: nativeLabel,
      }))}
      label={t.site.language}
      selectedKey={locale}
      variant="utility"
      onSelectionChange={(key) => {
        if (locales.includes(key as Locale)) setLocale(key as Locale)
      }}
    />
  )
}
