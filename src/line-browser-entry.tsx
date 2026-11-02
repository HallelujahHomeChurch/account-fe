import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LineBrowserHandoff } from './components/LineBrowserHandoff'
import { LocaleProvider } from './i18n/locale-context'
import { ThemeProvider } from './theme/theme-context'
import './index.css'
import '@hallelujahhomechurch/ui/styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><ThemeProvider><LineBrowserHandoff /></ThemeProvider></LocaleProvider></StrictMode>)
