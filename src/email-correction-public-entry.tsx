import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './i18n/locale-context'
import { ThemeProvider } from './theme/theme-context'
import { PublicVerificationRoute } from './features/email-correction/PublicVerificationRoute'
import './index.css'
import '@hallelujahhomechurch/ui/styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><ThemeProvider><main className="auth-main-panel"><PublicVerificationRoute /></main></ThemeProvider></LocaleProvider></StrictMode>)
