import { useEffect, useRef } from 'react'

import { localeLabels, locales, type Locale } from '../i18n/locales'
import { useLocale } from '../i18n/locale-context'

type LanguageSelectorProps = {
  className?: string
}

export function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { locale, messages: t, setLocale } = useLocale()
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function closeSelector() {
      if (detailsRef.current) detailsRef.current.open = false
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current
      if (!details?.open) return
      if (event.target instanceof Node && !details.contains(event.target)) closeSelector()
    }

    function handleKeyDown(event: KeyboardEvent) {
      const details = detailsRef.current
      if (!details?.open || event.key !== 'Escape') return

      event.preventDefault()
      closeSelector()
      details.querySelector<HTMLElement>('summary')?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
