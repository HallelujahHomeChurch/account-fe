import { AccountMenu, Button, Drawer } from '@hhc/ui'
import { Menu, ShieldCheck, UserRound } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/auth-context'
import { isAuthRoutePath } from './auth/auth-routes'
import { useLocale } from './i18n/locale-context'
import { accountGreetingName } from './lib/account-display'
import { readRuntimeConfig } from './lib/redirects'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SecurityPage } from './pages/SecurityPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

function Layout() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const location = useLocation()
  const isAuthRoute = isAuthRoutePath(location.pathname)
  const publicSiteUrl = readRuntimeConfig().publicSiteUrl

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
          <div className="sidebar-legal-links">
            <a
              href={`${publicSiteUrl}/${locale}/privacy-policy`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.nav.privacy}
            </a>
            <span aria-hidden="true">/</span>
            <a
              href={`${publicSiteUrl}/${locale}/terms-of-use`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t.nav.terms}
            </a>
          </div>
        </aside>
        <div className="account-content">
          <header className="account-header">
            <Drawer
              closeLabel={t.nav.closeNavigation}
              placement="left"
              title={t.nav.accountNavigation}
              trigger={
                <Button
                  aria-label={t.nav.openNavigation}
                  className="mobile-navigation-trigger"
                  variant="ghost"
                >
                  <Menu size={21} aria-hidden="true" />
                </Button>
              }
            >
              {(close) => (
                <div className="mobile-navigation-body">
                  <Link
                    className="brand mobile-navigation-brand"
                    to="/profile"
                    onClick={close}
                  >
                    <img className="brand-mark" src="/assets/brand/logo.png" alt="" />
                    <span>{t.site.accountName}</span>
                  </Link>
                  <nav
                    className="nav-links mobile-navigation-links"
                    aria-label={t.nav.accountNavigation}
                  >
                    <Link
                      aria-current={location.pathname === '/profile' ? 'page' : undefined}
                      to="/profile"
                      onClick={close}
                    >
                      <UserRound size={17} />
                      {t.nav.personalInfo}
                    </Link>
                    <Link
                      aria-current={location.pathname === '/security' ? 'page' : undefined}
                      to="/security"
                      onClick={close}
                    >
                      <ShieldCheck size={17} />
                      {t.nav.security}
                    </Link>
                  </nav>
                  <div className="sidebar-legal-links mobile-navigation-legal">
                    <a
                      href={`${publicSiteUrl}/${locale}/privacy-policy`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {t.nav.privacy}
                    </a>
                    <span aria-hidden="true">/</span>
                    <a
                      href={`${publicSiteUrl}/${locale}/terms-of-use`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {t.nav.terms}
                    </a>
                  </div>
                </div>
              )}
            </Drawer>
            <Link className="mobile-shell-brand" to="/profile">
              <img className="brand-mark" src="/assets/brand/logo.png" alt="" />
              <span>{t.site.accountName}</span>
            </Link>
            <AccountMenu
              labels={{
                greeting: `Hi ${accountGreetingName(auth.profile)}`,
                menu: t.nav.accountMenu,
                signOut: t.nav.signOut,
              }}
              user={{
                avatarUrl: auth.profile.avatar_url,
                email: auth.profile.email,
                name: accountGreetingName(auth.profile),
              }}
              onSignOut={() => void auth.logout()}
            />
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
