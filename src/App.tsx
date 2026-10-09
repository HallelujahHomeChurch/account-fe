import { AccountMenu, BrandLoadingScreen, Button, Drawer, Skeleton, Toast, ToastProvider } from '@hallelujahhomechurch/ui'
import { Bell, CalendarDays, FileArchive, Menu, MonitorSmartphone, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { canAccessAdmin } from '@hallelujahhomechurch/account-client/admin-access'

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
import { AnalyticsBoundary } from './components/AnalyticsBoundary'
import { LegalReviewPage } from './pages/LegalReviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { MemberDetailsPage } from './pages/MemberDetailsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RegisterPage } from './pages/RegisterPage'
import { RegistrationPendingPage } from './pages/RegistrationPendingPage'
import { SecurityPage } from './pages/SecurityPage'
import { DevicesPage } from './pages/DevicesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { NativeAuthCompletePage } from './pages/NativeAuthCompletePage'
import { PolicyAcceptancePage } from './pages/PolicyAcceptancePage'
import { DataRequestsPage } from './pages/DataRequestsPage'
import { MyResourceReservationsPage } from './pages/MyResourceReservationsPage'
import { ResourceListPage } from './pages/ResourceListPage'
import { ResourceReservationPage } from './pages/ResourceReservationPage'
import { useAuthCapabilitiesState } from './components/SocialAuthOptions'
import { StatementStrip } from './components/StatementStrip'
import { LineBrowserNotice } from './components/LineBrowserNotice'
import { OrganizationMemberPage } from './pages/organizations/OrganizationMemberPage'
import { OrganizationRootsPage } from './pages/organizations/OrganizationRootsPage'
import { OrganizationUnitPage } from './pages/organizations/OrganizationUnitPage'

function LayoutContent() {
  const auth = useAuth()
  const verified = auth.status === 'authenticated' && auth.profile !== null && !auth.isBootstrapping
  const navigate = useNavigate()
  const { locale, messages: t } = useLocale()
  const location = useLocation()
  useEffect(() => {
    const required = () => { if (location.pathname === '/resources' || location.pathname.startsWith('/resources/')) navigate(`/legal?return_to=${encodeURIComponent(location.pathname)}`) }
    window.addEventListener('hhc:legal-required', required)
    return () => window.removeEventListener('hhc:legal-required', required)
  }, [location.pathname, navigate])
  const isAuthRoute = isAuthRoutePath(location.pathname)
  const isResourceRoute = location.pathname === '/resources' || location.pathname.startsWith('/resources/')
  const publicSiteUrl = readRuntimeConfig().publicSiteUrl
  const { capabilities, error: capabilitiesError } = useAuthCapabilitiesState(!isAuthRoute)
  const dsrEnabled = capabilities?.dsr?.enabled === true
  const [resourceLookupFailed, setResourceLookupFailed] = useState(false)
  const [managedAccessResult, setManagedAccess] = useState<{ owner?: string; status: 'loading' | 'allowed' | 'denied' | 'failed' }>({ status: 'loading' })
  const [accessRevision, setAccessRevision] = useState(0)
  const [memberAccess, setMemberAccess] = useState<{ owner: string; allowed: boolean }>({ owner: '', allowed: false })
  const owner = verified ? auth.profile?.id : undefined
  const managedAccess = owner && managedAccessResult.owner === owner ? managedAccessResult.status : 'loading'
  const [memberTransportAccess, setMemberTransportAccess] = useState<{ owner: string; allowed: boolean }>({ owner: '', allowed: false })
  const memberEligible = memberAccess.owner === owner && memberAccess.allowed
  const memberAllowed = capabilities?.memberDetailsEnabled === true && memberEligible && memberTransportAccess.owner === owner && memberTransportAccess.allowed
  const memberAuthorizationPending = capabilities?.memberDetailsEnabled === true && memberEligible && memberTransportAccess.owner !== owner

  useEffect(() => {
    setMemberTransportAccess({ owner: '', allowed: false })
    if (!owner || !memberEligible || capabilities?.memberDetailsEnabled !== true) return
    let active = true
    const controller = new AbortController()
    const check = async () => {
      let allowed = false
      try { allowed = (await auth.api.memberTransportFetch?.('/member-details/transport-key', { method: 'GET', signal: controller.signal, cache: 'no-store' }))?.ok === true } catch { allowed = false }
      if (active) setMemberTransportAccess({ owner, allowed })
    }
    void check()
    return () => { active = false; controller.abort() }
  }, [auth.api, capabilities?.memberDetailsEnabled, owner, memberEligible])

  useEffect(() => {
    setResourceLookupFailed(false)
    if (isAuthRoute || !verified || !auth.profile) return
    let active = true
    const remember = auth.presentation.capture(auth.profile.id)
    auth.operationsApi.listMyResources()
      .then((resources) => { if (active) remember('resources', resources.length > 0 ? ['resources'] : []) })
      .catch(() => { if (active) setResourceLookupFailed(true) })
    return () => { active = false }
  }, [auth.operationsApi, auth.presentation, auth.profile, isAuthRoute, isResourceRoute, verified])

  useEffect(() => {
    setManagedAccess({ owner, status: 'loading' })
    setMemberAccess({ owner: '', allowed: false })
    if (isAuthRoute || !owner || !auth.operationsApi.getMyAccess) return
    let active = true
    const controller = new AbortController()
    const remember = auth.presentation.capture(owner)
    const check = () => auth.operationsApi.getMyAccess(controller.signal)
      .then((access) => { if (active && remember('operations', access.churchMembership && access.responsibilities.length > 0 ? ['organizations'] : [])) { setManagedAccess({ owner, status: access.churchMembership && access.responsibilities.length > 0 ? 'allowed' : 'denied' }); setMemberAccess({ owner, allowed: access.memberDetailsEligible === true }) } })
      .catch(() => { if (active) setManagedAccess({ owner, status: 'failed' }) })
    void check()
    window.addEventListener('focus', check)
    return () => { active = false; controller.abort(); window.removeEventListener('focus', check) }
  }, [auth.operationsApi, auth.presentation, owner, isAuthRoute, accessRevision])

  const navigation = [
    { icon: UserRound, label: t.nav.personalInfo, path: '/profile' },
    { icon: ShieldCheck, label: t.nav.security, path: '/security' },
    ...(auth.navigation?.sources.operations?.ids.includes('organizations') ? [{ icon: UsersRound, label: t.nav.organizationManagement, path: '/organizations' }] : []),
    { icon: MonitorSmartphone, label: t.nav.devices, path: '/devices' },
    { icon: Bell, label: t.nav.notificationSettings, path: '/notifications' },
    ...(auth.navigation?.sources.resources?.ids.includes('resources') ? [{ icon: CalendarDays, label: t.nav.resourceReservations, path: '/resources' }] : []),
    ...(dsrEnabled ? [{ icon: FileArchive, label: t.nav.dataRequests, path: '/data-requests' }] : []),
  ]

  if (isAuthRoute) {
    return (
      <div className="app-shell">
        <LineBrowserNotice />
        <main className="auth-main-panel">
          <Routes>
            <Route element={<LoginPage />} path="/login" />
            <Route element={<RegisterPage />} path="/register" />
            <Route element={<RegistrationPendingPage />} path="/register/check-email" />
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

  const cachedShell = auth.navigation?.sources.account?.ids.includes('shell') === true
  if (auth.isBootstrapping && !cachedShell) {
    return <BrandLoadingScreen label={t.profile.loading} />
  }

  if (auth.status === 'unavailable' && !cachedShell) {
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

  if (!auth.profile && !cachedShell) {
    return <Navigate replace to={loginPath(`${location.pathname}${location.search}${location.hash}`)} />
  }

  if (verified && hasLineLinkAutoContinue()) {
    return <Navigate replace to="/line/bind" />
  }

  return (
    <div className="app-shell">
      <div className="account-topbar">
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
                        aria-current={location.pathname === path || location.pathname.startsWith(`${path}/`) ? 'page' : undefined}
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
                greeting: verified && auth.profile ? `Hi ${accountGreetingName(auth.profile, t.profile.fallbackName)}` : t.nav.accountMenu,
                menu: t.nav.accountMenu,
                signOut: t.nav.signOut,
              }}
              links={[
                { id: 'official-site', label: t.nav.churchSite, href: `${publicSiteUrl}/${locale}` },
                { id: 'projection', label: t.nav.projectionSystem, href: 'https://client.alive.org.tw/', newWindow: { label: t.nav.projectionWindowLabel, blockedMessage: t.nav.projectionPopupBlocked } },
                ...(verified && managedAccess === 'allowed' ? [{ id: 'organizations', label: t.nav.menuOrganizations, href: '/organizations' }] : []),
                ...(verified && canAccessAdmin(auth.profile?.permissions ?? [])
                  ? [{ id: 'admin', label: t.nav.adminManagement, href: 'https://admin.alive.org.tw/' }]
                  : []),
              ]}
              user={{
                avatarUrl: verified ? auth.profile?.avatar_url : '/assets/brand/account-placeholder.svg',
                email: verified ? auth.profile?.email ?? '' : '',
                name: verified && auth.profile ? accountGreetingName(auth.profile, t.profile.fallbackName) : '',
              }}
              onSignOut={() => void auth.logout()}
            />
            {auth.logoutError ? (
              <div className="auth-error-toast">
                <Toast tone="danger">{auth.logoutError}</Toast>
              </div>
            ) : null}
          </header>
          <StatementStrip />
      </div>
      <div className="account-layout">
        <aside className="account-sidebar" aria-label={t.nav.accountSections}>
          <nav className="nav-links" aria-label={t.nav.accountNavigation}>
            {navigation.map(({ icon: Icon, label, path }) => (
              <Link
                key={path}
                aria-current={location.pathname === path || location.pathname.startsWith(`${path}/`) ? 'page' : undefined}
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
          <LineBrowserNotice />
          <main className="main-panel">
            {resourceLookupFailed && !isResourceRoute ? <p className="form-error" role="alert">
              {t.resources.loadFailed} <Link to="/resources">{t.nav.resourceReservations}</Link>
            </p> : null}
            {!verified ? <><Skeleton className="account-page-skeleton" label={t.profile.loading} />
              {auth.status === 'unavailable' ? <div role="alert"><p className="form-error">{auth.bootstrapError}</p><Button onPress={() => void auth.retrySession()}>{t.security.retry}</Button></div> : null}
            </> : hasPostLoginReturnTo() ? <PostLoginContinuation /> : <Routes>
              <Route element={<ProfilePage memberDetailsAvailable={memberAllowed} />} path="/profile" />
              <Route element={memberAllowed ? <MemberDetailsPage key={auth.profile?.id} /> : managedAccess === 'loading' || memberAuthorizationPending || !capabilities && !capabilitiesError ? <Skeleton className="account-page-skeleton" label={t.profile.loading} /> : <Navigate replace to="/profile" />} path="/profile/member-details" />
              <Route element={<LegalReviewPage key={`${auth.profile?.id}:${locale}`} />} path="/legal" />
              <Route element={<SecurityPage />} path="/security" />
              <Route element={<DevicesPage />} path="/devices" />
              <Route element={<NotificationsPage />} path="/notifications" />
              <Route
                element={dsrEnabled
                  ? <DataRequestsPage />
                  : !capabilities && !capabilitiesError
                    ? <Skeleton className="account-page-skeleton" label={t.dataRequests.loading} />
                    : <Navigate replace to="/profile" />}
                path="/data-requests"
              />
              <Route element={<ResourceListPage />} path="/resources" />
              <Route element={<MyResourceReservationsPage />} path="/resources/reservations" />
              <Route element={<ResourceReservationPage />} path="/resources/:resourceKey" />
              <Route element={managedAccess === 'allowed' ? <Outlet /> : managedAccess === 'denied' ? <Navigate replace to="/profile" /> : managedAccess === 'failed' ? <section className="account-document"><p className="form-error" role="alert">{t.organizations.loadFailed}</p><Button onPress={() => setAccessRevision(value => value + 1)}>{t.organizations.retry}</Button></section> : <Skeleton className="account-page-skeleton" label={t.organizations.loading} />}>
                <Route element={<OrganizationRootsPage />} path="/organizations" />
                <Route element={<OrganizationUnitPage />} path="/organizations/:unitId" />
                <Route element={<OrganizationMemberPage />} path="/organizations/:unitId/members/:memberId" />
              </Route>
              <Route element={<Navigate replace to="/profile" />} path="*" />
            </Routes>}
          </main>
        </div>
      </div>
    </div>
  )
}

export function PostLoginContinuation() {
  const navigate = useNavigate()
  const handled = useRef(false)
  const { messages: t } = useLocale()
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    navigate(consumePostLoginReturnTo(), { replace: true })
  }, [navigate])
  return <Skeleton className="account-page-skeleton" label={t.profile.loading} />
}

export default function Layout() {
  const { messages: t } = useLocale()
  return (
    <ToastProvider dismissLabel={t.site.dismissNotification} regionLabel={t.site.notifications}>
      <AnalyticsBoundary><LayoutContent /></AnalyticsBoundary>
    </ToastProvider>
  )
}
