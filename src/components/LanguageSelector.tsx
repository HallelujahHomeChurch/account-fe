import { Select } from '@hallelujahhomechurch/ui'

import { localeLabels, locales, type Locale } from '../i18n/locales'
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
      items={locales.map((targetLocale) => ({
        id: targetLocale,
        label: localeLabels[targetLocale],
      }))}
      label={t.site.language}
      selectedKey={locale}
      variant="ghost"
      onSelectionChange={(key) => {
        if (locales.includes(key as Locale)) setLocale(key as Locale)
      }}
    />
  )
}
