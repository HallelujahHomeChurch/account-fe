import { Button } from '@heroui/react'
import { LogOut, ShieldCheck, UserCircle, UserRound } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/auth-context'
import { isAuthRoutePath } from './auth/auth-routes'
import { useLocale } from './i18n/locale-context'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SecurityPage } from './pages/SecurityPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

function Layout() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const location = useLocation()
  const isAuthRoute = isAuthRoutePath(location.pathname)

  if (isAuthRoute) {
    return (
      <div className="app-shell">
        <main className="auth-main-panel">
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<ForgotPasswordPage />} path="/forgot-password" />
            <Route element={<ResetPasswordPage />} path="/reset-password" />
            <Route element={<VerifyEmailPage />} path="/verify-email" />
            <Route element={<OAuthCallbackPage />} path="/oauth/callback" />
            <Route element={<Navigate replace to="/profile" />} path="*" />
          </Routes>
        </main>
      </div>
    )
  }

  if (auth.isBootstrapping) {
    return (
      <div className="app-shell">
        <main className="auth-main-panel">
          <p className="inline-status">{t.profile.loading}</p>
        </main>
      </div>
    )
  }

  if (!auth.profile) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return (
    <div className="app-shell">
      <div className="account-layout">
        <aside className="account-sidebar" aria-label={t.nav.accountSections}>
          <Link className="brand" to="/profile">
            <img className="brand-mark" src="/assets/brand/logo.png" alt="" />
            <span>{t.site.accountName}</span>
          </Link>
          <nav className="nav-links" aria-label={t.nav.accountNavigation}>
            <Link aria-current={location.pathname === '/profile' ? 'page' : undefined} to="/profile">
              <UserRound size={17} />
              {t.nav.personalInfo}
            </Link>
            <Link aria-current={location.pathname === '/security' ? 'page' : undefined} to="/security">
              <ShieldCheck size={17} />
              {t.nav.security}
            </Link>
          </nav>
        </aside>
        <div className="account-content">
          <header className="account-header">
            <details className="account-menu">
              <summary aria-label={t.nav.accountMenu}>
                <UserCircle size={22} />
              </summary>
              <div className="account-menu-panel">
                <p>{auth.profile.email}</p>
                <Button size="sm" variant="ghost" onPress={() => void auth.logout()}>
                  <LogOut size={16} />
                  {t.nav.signOut}
                </Button>
              </div>
            </details>
          </header>
          <main className="main-panel">
            <Routes>
              <Route element={<ProfilePage />} path="/profile" />
              <Route element={<SecurityPage />} path="/security" />
              <Route element={<Navigate replace to="/profile" />} path="*" />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout
