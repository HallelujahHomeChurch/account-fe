import { useRef } from 'react'

import { localeLabels, locales, type Locale } from '../i18n/locales'
import { useLocale } from '../i18n/locale-context'

type LanguageSelectorProps = {
  className?: string
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, messages: t, setLocale } = useLocale()
  const detailsRef = useRef<HTMLDetailsElement>(null)

  function chooseLocale(nextLocale: Locale) {
    setLocale(nextLocale)
    if (detailsRef.current) detailsRef.current.open = false
  }

  return (
    <details ref={detailsRef} className={`language-selector ${className}`.trim()}>
      <summary aria-label={t.site.language} className="language-selector-trigger">
        <span>{localeLabels[locale]}</span>
      </summary>
      <div className="language-selector-menu" role="listbox">
        {locales.map((targetLocale) => (
          <button
            key={targetLocale}
            aria-selected={targetLocale === locale}
            className="language-selector-option"
            onClick={() => chooseLocale(targetLocale)}
            role="option"
            type="button"
          >
            {localeLabels[targetLocale]}
          </button>
        ))}
      </div>
    </details>
  )
}
