import { localeLabels, locales, type Locale } from '../i18n/locales'
import { useLocale } from '../i18n/locale-context'

type LanguageSelectorProps = {
  className?: string
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, messages: t, setLocale } = useLocale()

  return (
    <label className={`language-selector ${className}`.trim()}>
      <span className="sr-only">{t.site.language}</span>
      <select
        aria-label={t.site.language}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as Locale)}
      >
        {locales.map((targetLocale) => (
          <option key={targetLocale} value={targetLocale}>
            {localeLabels[targetLocale]}
          </option>
        ))}
      </select>
    </label>
  )
}
