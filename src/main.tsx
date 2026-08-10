import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { RoutedAuthProvider } from './auth/auth-context'
import { LocaleProvider } from './i18n/locale-context'
import { captureLineLinkFragment } from './lib/line-link-intent'
import { initObservability } from './observability'
import { ThemeProvider } from './theme/theme-context'
import './index.css'
import '@hallelujahhomechurch/ui/styles.css'

captureLineLinkFragment()
initObservability()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ThemeProvider>
          <RoutedAuthProvider>
            <App />
          </RoutedAuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
