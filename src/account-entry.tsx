import {getInitialLocale} from './i18n/locales'
import {readRuntimeConfig} from './lib/redirects'
import {organizationRedirectUrl, replaceOrganizationLocation} from './lib/organization-redirect'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import App from './App'
import { RoutedAuthProvider } from './auth/auth-context'
import { LocaleProvider } from './i18n/locale-context'
import { captureLineLinkFragment } from './lib/line-link-intent'
import { initObservability, reportReactError } from './observability'
import { ThemeProvider } from './theme/theme-context'
import './index.css'
import './account-shell.css'
import '@hallelujahhomechurch/ui/styles.css'

const legacyManagementUrl = organizationRedirectUrl(location.pathname, getInitialLocale(document.cookie, navigator.languages), readRuntimeConfig().publicSiteUrl, location.hostname)
if (legacyManagementUrl) replaceOrganizationLocation(legacyManagementUrl)
else {
captureLineLinkFragment()
initObservability()

const router = createBrowserRouter([{ path: '*', element: (
  <LocaleProvider><ThemeProvider><RoutedAuthProvider><App /></RoutedAuthProvider></ThemeProvider></LocaleProvider>
) }])
createRoot(document.getElementById('root')!, { onCaughtError: reportReactError }).render(<StrictMode><RouterProvider router={router} /></StrictMode>)

}
