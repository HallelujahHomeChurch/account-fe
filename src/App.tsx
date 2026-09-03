import { AccountMenu, BrandLoadingScreen, Button, Drawer, Toast, ToastProvider } from '@hallelujahhomechurch/ui'
import { Bell, FileArchive, Menu, MonitorSmartphone, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from './auth/auth-context'
import { consumePostLoginReturnTo, hasPostLoginReturnTo, isAuthRoutePath, loginPath } from './auth/auth-routes'
import { useLocale } from './i18n/locale-context'
import { accountGreetingName } from './lib/account-display'
import { hasLineLinkAutoContinue } from './lib/line-link-intent'
import { readRuntimeConfig } from './lib/redirects'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { LineBindingPage } from './pages/LineBindingPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { OAuthLinkPage } from './pages/OAuthLinkPage'
import { OAuthOnboardingPage } from './pages/OAuthOnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RegisterPage } from './pages/RegisterPage'
import { SecurityPage } from './pages/SecurityPage'
import { DevicesPage } from './pages/DevicesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { NativeAuthCompletePage } from './pages/NativeAuthCompletePage'
import { PolicyAcceptancePage } from './pages/PolicyAcceptancePage'
import { DataRequestsPage } from './pages/DataRequestsPage'
import { useAuthCapabilitiesState } from './components/SocialAuthOptions'

function LayoutContent() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const location = useLocation()
  const isAuthRoute = isAuthRoutePath(location.pathname)
  const publicSiteUrl = readRuntimeConfig().publicSiteUrl
  const { capabilities, error: capabilitiesError } = useAuthCapabilitiesState(!isAuthRoute)
  const dsrEnabled = capabilities?.dsr?.enabled === true
  const navigation = [
    { icon: UserRound, label: t.nav.personalInfo, path: '/profile' },
    { icon: ShieldCheck, label: t.nav.security, path: '/security' },
    { icon: MonitorSmartphone, label: t.nav.devices, path: '/devices' },
    { icon: Bell, label: t.nav.notificationSettings, path: '/notifications' },
    ...(dsrEnabled ? [{ icon: FileArchive, label: t.nav.dataRequests, path: '/data-requests' }] : []),
  ]

  if (isAuthRoute) {
    return (
      <div className="app-shell">
        <main className="auth-main-panel">
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<RegisterPage />} path="/register" />
            <Route element={<ForgotPasswordPage />} path="/forgot-password" />
            <Route element={<ResetPasswordPage />} path="/reset-password" />
            <Route element={<VerifyEmailPage />} path="/verify-email" />
            <Route element={<NativeAuthCompletePage />} path="/native-auth-complete" />
            <Route element={<OAuthCallbackPage />} path="/oauth/callback" />
            <Route element={<OAuthLinkPage />} path="/oauth/link" />
            <Route element={<OAuthOnboardingPage />} path="/oauth/onboarding" />
            <Route element={<PolicyAcceptancePage />} path="/policy/acceptance" />
            <Route element={<LineBindingPage />} path="/line/bind" />
            <Route element={<Navigate replace to="/profile" />} path="*" />
          </Routes>
        </main>
      </div>
    )
  }

  if (auth.isBootstrapping) {
    return <BrandLoadingScreen label={t.profile.loading} />
  }

  if (auth.status === 'unavailable' && !auth.profile) {
    return (
      <div className="app-shell">
        <main className="auth-main-panel">
          <div role="alert">
            <p className="form-error">{auth.bootstrapError}</p>
            <Button onPress={() => void auth.retrySession()} variant="secondary">
              {t.security.retry}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!auth.profile) {
    return <Navigate replace to={loginPath(`${location.pathname}${location.search}${location.hash}`)} />
  }

  if (hasLineLinkAutoContinue()) {
    return <Navigate replace to="/line/bind" />
  }

  if (hasPostLoginReturnTo()) return <PostLoginContinuation />

  return (
    <div className="app-shell">
      <div className="account-layout">
        <aside className="account-sidebar" aria-label={t.nav.accountSections}>
          <Link className="brand" to="/profile">
            <img className="brand-mark" src="/assets/brand/logo.png" alt="" />
            <span>{t.site.accountName}</span>
          </Link>
          <nav className="nav-links" aria-label={t.nav.accountNavigation}>
            {navigation.map(({ icon: Icon, label, path }) => (
              <Link
                key={path}
                aria-current={location.pathname === path ? 'page' : undefined}
                to={path}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
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
                    {navigation.map(({ icon: Icon, label, path }) => (
                      <Link
                        key={path}
                        aria-current={location.pathname === path ? 'page' : undefined}
                        to={path}
                        onClick={close}
                      >
                        <Icon size={17} />
                        {label}
                      </Link>
                    ))}
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
                manageAccount: t.nav.churchSite,
                signOut: t.nav.signOut,
              }}
              manageAccountHref={`${publicSiteUrl}/${locale}`}
              user={{
                avatarUrl: auth.profile.avatar_url,
                email: auth.profile.email,
                name: accountGreetingName(auth.profile),
              }}
              onSignOut={() => void auth.logout()}
            />
            {auth.logoutError ? (
              <div className="auth-error-toast">
                <Toast tone="danger">{auth.logoutError}</Toast>
              </div>
            ) : null}
          </header>
          <main className="main-panel">
            <Routes>
              <Route element={<ProfilePage />} path="/profile" />
              <Route element={<SecurityPage />} path="/security" />
              <Route element={<DevicesPage />} path="/devices" />
              <Route element={<NotificationsPage />} path="/notifications" />
              <Route
                element={dsrEnabled
                  ? <DataRequestsPage />
                  : !capabilities && !capabilitiesError
                    ? <BrandLoadingScreen label={t.dataRequests.loading} />
                    : <Navigate replace to="/profile" />}
                path="/data-requests"
              />
              <Route element={<Navigate replace to="/profile" />} path="*" />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

function PostLoginContinuation() {
  const navigate = useNavigate()
  const handled = useRef(false)
  const { messages: t } = useLocale()
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    navigate(consumePostLoginReturnTo(), { replace: true })
  }, [navigate])
  return <BrandLoadingScreen label={t.profile.loading} />
}

export default function Layout() {
  const { messages: t } = useLocale()
  return (
    <ToastProvider dismissLabel={t.site.dismissNotification} regionLabel={t.site.notifications}>
      <LayoutContent />
    </ToastProvider>
  )
}
