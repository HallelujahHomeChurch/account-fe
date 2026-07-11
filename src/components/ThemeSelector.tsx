import { Moon, Sun } from 'lucide-react'

import { useLocale } from '../i18n/locale-context'
import { useTheme } from '../theme/theme-context'

export function ThemeSelector() {
  const { messages: t } = useLocale()
  const { theme, setTheme } = useTheme()

  return (
    <div className="theme-selector" role="group" aria-label={t.profile.appearance}>
      <button
        aria-pressed={theme === 'light'}
        className="theme-selector-option"
        onClick={() => setTheme('light')}
        type="button"
      >
        <Sun size={16} aria-hidden="true" />
        {t.profile.lightTheme}
      </button>
      <button
        aria-pressed={theme === 'dark'}
        className="theme-selector-option"
        onClick={() => setTheme('dark')}
        type="button"
      >
        <Moon size={16} aria-hidden="true" />
        {t.profile.darkTheme}
      </button>
    </div>
  )
}
