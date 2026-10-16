import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import App from '../../src/App'
import { LocaleProvider } from '../../src/i18n/locale-context'
import { ThemeProvider } from '../../src/theme/theme-context'
import { PreviewFixtureProvider } from './pages'
import '../../src/index.css'
import '@hallelujahhomechurch/ui/styles.css'
import './preview.css'

if (!import.meta.env.DEV) throw new Error('Development fixtures only')
// Fail closed if a future shell change tries to call a real backend.
window.fetch = async () => { throw new Error('Network disabled in email correction fixture preview') }
const params = new URLSearchParams(location.search)
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'
document.documentElement.style.colorScheme = document.documentElement.dataset.theme
const router = createMemoryRouter([{ path: '*', element: <LocaleProvider><ThemeProvider><PreviewFixtureProvider><App /></PreviewFixtureProvider></ThemeProvider></LocaleProvider> }], { initialEntries: [params.get('surface') === 'verify' ? '/data-requests/verify-email' : '/data-requests'] })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
