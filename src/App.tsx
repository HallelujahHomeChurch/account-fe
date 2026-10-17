import { CorrectionRoute } from './features/email-correction/CorrectionRoute'
import { emailCorrectionMessages } from './features/email-correction/messages'
import { AccountMenu, BrandLoadingScreen, Button, Menu, Skeleton, Toast, ToastProvider } from '@hallelujahhomechurch/ui'
import { CalendarDays, Ellipsis, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, matchPath, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

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
import { AccountHeaderSearch } from './components/AccountHeaderSearch'
import { useMobileLayout } from './components/useMobileLayout'
import { useScrollChrome } from './components/useScrollChrome'
import { memberDetailsMessages } from './i18n/member-details'
import type { AccountFeatureSearchItem } from './lib/account-feature-search'
import { AccountSectionFocus } from './components/AccountSectionFocus'
import { AnalyticsBoundary } from './components/AnalyticsBoundary'
import { LegalReviewPage } from './pages/LegalReviewPage'
import { ProfilePage } from './pages/ProfilePage'
import { MemberDetailsPage } from './pages/MemberDetailsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RegisterPage } from './pages/RegisterPage'
import { RegistrationPendingPage } from './pages/RegistrationPendingPage'
import { SecurityPage } from './pages/SecurityPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { NativeAuthCompletePage } from './pages/NativeAuthCompletePage'
import { PolicyAcceptancePage } from './pages/PolicyAcceptancePage'
import { MyResourceReservationsPage } from './pages/MyResourceReservationsPage'
import { ResourceListPage } from './pages/ResourceListPage'
import { ResourceReservationPage } from './pages/ResourceReservationPage'
import { useAuthCapabilitiesState } from './components/SocialAuthOptions'
import { LineBrowserNotice } from './components/LineBrowserNotice'
import { OrganizationMemberPage } from './pages/organizations/OrganizationMemberPage'
import { OrganizationRootsPage } from './pages/organizations/OrganizationRootsPage'
import { OrganizationUnitPage, type OrganizationSearchStatus } from './pages/organizations/OrganizationUnitPage'

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
    ...(capabilities?.emailCorrectionEnabled ? [{ icon: UserRound, label: emailCorrectionMessages[locale].title, path: '/data-requests' }] : []),
    ...(auth.navigation?.sources.resources?.ids.includes('resources') ? [{ icon: CalendarDays, label: t.nav.resourceReservations, path: '/resources' }] : []),
  ]

  const mobile = useMobileLayout()
  const scopeKey = `${owner ?? ''}:${verified}:${location.pathname}:${locale}`
  const currentScope = useRef(scopeKey)
  currentScope.current = scopeKey
  const [searchState, setSearchState] = useState({ key: '', value: '' })
  const searchQuery = searchState.key === scopeKey ? searchState.value : ''
  const [searchExpanded, setSearchExpanded] = useState({ key: '', open: false })
  const searchOpen = searchExpanded.key === scopeKey && searchExpanded.open
  const [availability, setAvailability] = useState({ key: '', unitId: '', available: false })
  const unitId = matchPath({ path: '/organizations/:unitId', end: true }, location.pathname)?.params.unitId
  const onSearchAvailabilityChange = useCallback((status: OrganizationSearchStatus) => {
    if (currentScope.current === scopeKey) setAvailability({ key: scopeKey, ...status })
  }, [scopeKey])
  const { visible: chromeVisible } = useScrollChrome({ blocked: searchOpen, resetKey: scopeKey })
  const [standalone] = useState(() => /iPhone|iPod/i.test(navigator.userAgent) && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true))
  const featureItems: AccountFeatureSearchItem[] = verified ? [
    ...[
      ['avatar', t.profile.avatar], ['nickname', t.nickname.label], ['language', t.profile.language],
      ['appearance', t.profile.appearance], ['email-notifications', t.notificationSettings.emailTitle],
    ].map(([id, label]) => ({ id, label, category: t.nav.personalInfo, keywords: [], to: `/profile#${id}` })),
    ...[
      ['password', t.security.password], ['linked-accounts', t.security.signInMethods], ['mfa', t.security.authenticatorApp], ['devices', t.nav.devices],
    ].map(([id, label]) => ({ id, label, category: t.nav.security, keywords: id === 'mfa' ? ['MFA', '2FA'] : [], to: `/security#${id}` })),
    ...(capabilities?.emailCorrectionEnabled ? [{ id: 'data-requests', label: emailCorrectionMessages[locale].title, category: t.search.more, keywords: [emailCorrectionMessages[locale].requestEmailChange], to: '/data-requests' }] : []),
    ...(managedAccess === 'allowed' ? [{ id: 'organizations', label: t.nav.organizationManagement, category: t.nav.organizationManagement, keywords: [], to: '/organizations' }] : []),
    ...(auth.navigation?.sources.resources?.ids.includes('resources') ? [{ id: 'resources', label: t.nav.resourceReservations, category: t.search.more, keywords: [], to: '/resources' }] : []),
    ...(memberAllowed ? [{ id: 'member-details', label: memberDetailsMessages[locale].title, category: t.nav.personalInfo, keywords: [], to: '/profile/member-details' }] : []),
  ] : []
  const active = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  const moreItems = navigation.filter(item => item.path === '/data-requests' || item.path === '/resources')

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
    return <Navigate replace to={location.pathname === '/data-requests' ? '/login?return_to=%2Fdata-requests&email_correction=1' : loginPath(`${location.pathname}${location.search}${location.hash}`)} />
  }

  if (verified && hasLineLinkAutoContinue()) {
    return <Navigate replace to="/line/bind" />
  }

  const accountMenu = (
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
  )
  const legalLinks = <nav className="account-legal-links" aria-label={`${t.nav.privacy} / ${t.nav.terms}`}>
    <a href={`${publicSiteUrl}/${locale}/privacy-policy`} rel="noopener noreferrer" target="_blank">{t.nav.privacy}</a>
    <span aria-hidden="true">/</span>
    <a href={`${publicSiteUrl}/${locale}/terms-of-use`} rel="noopener noreferrer" target="_blank">{t.nav.terms}</a>
  </nav>

  return (
    <div className="app-shell account-app" data-iphone-standalone={standalone || undefined}>
      <div className="account-topbar" data-mobile-hidden={!chromeVisible}>
        <header className="account-header" data-search-open={searchOpen}>
          <Link className="mobile-shell-brand" to="/profile">
            <img className="brand-mark" src="/assets/brand/logo.png" alt="" />
            <span>{t.site.accountName}</span>
          </Link>
          <AccountHeaderSearch key={scopeKey} mode={unitId ? 'members' : 'features'} value={searchQuery}
            items={featureItems} onChange={value => setSearchState({ key: scopeKey, value })}
            onExpandedChange={open => setSearchExpanded({ key: scopeKey, open })}
            isDisabled={!verified || Boolean(unitId && (availability.key !== scopeKey || availability.unitId !== unitId || !availability.available))} />
          {!mobile ? accountMenu : null}
          {auth.logoutError ? <div className="auth-error-toast"><Toast tone="danger">{auth.logoutError}</Toast></div> : null}
        </header>
      </div>
      <div className="account-layout">
        {!mobile ? <aside className="account-sidebar" aria-label={t.nav.accountSections}>
          <nav className="nav-links" aria-label={t.nav.accountNavigation}>
            {navigation.map(({ icon: Icon, label, path }) => <Link key={path} aria-current={active(path) ? 'page' : undefined} to={path}><Icon size={17} />{label}</Link>)}
          </nav>
        </aside> : null}
        <div className="account-content">
          <LineBrowserNotice />
          <main className="main-panel">
            <AccountSectionFocus />
            {resourceLookupFailed && !isResourceRoute ? <p className="form-error" role="alert">
              {t.resources.loadFailed} <Link to="/resources">{t.nav.resourceReservations}</Link>
            </p> : null}
            {!verified ? <><Skeleton className="account-page-skeleton" label={t.profile.loading} />
              {auth.status === 'unavailable' ? <div role="alert"><p className="form-error">{auth.bootstrapError}</p><Button onPress={() => void auth.retrySession()}>{t.security.retry}</Button></div> : null}
            </> : hasPostLoginReturnTo() ? <PostLoginContinuation /> : <Routes>
              <Route element={<ProfilePage key={owner} memberDetailsAvailable={memberAllowed} />} path="/profile" />
              <Route element={memberAllowed ? <MemberDetailsPage key={auth.profile?.id} /> : managedAccess === 'loading' || memberAuthorizationPending || !capabilities && !capabilitiesError ? <Skeleton className="account-page-skeleton" label={t.profile.loading} /> : <Navigate replace to="/profile" />} path="/profile/member-details" />
              <Route element={<LegalReviewPage key={`${auth.profile?.id}:${locale}`} />} path="/legal" />
              <Route element={<SecurityPage key={owner} />} path="/security" />
              <Route element={<Navigate replace to="/security#devices" />} path="/devices" />
              <Route element={<Navigate replace to="/profile#email-notifications" />} path="/notifications" />
              <Route element={<CorrectionRoute key={auth.profile?.id} />} path="/data-requests" />
              <Route element={<ResourceListPage />} path="/resources" />
              <Route element={<MyResourceReservationsPage />} path="/resources/reservations" />
              <Route element={<ResourceReservationPage />} path="/resources/:resourceKey" />
              <Route element={managedAccess === 'allowed' ? <Outlet /> : managedAccess === 'denied' ? <Navigate replace to="/profile" /> : managedAccess === 'failed' ? <section className="account-document"><p className="form-error" role="alert">{t.organizations.loadFailed}</p><Button onPress={() => setAccessRevision(value => value + 1)}>{t.organizations.retry}</Button></section> : <Skeleton className="account-page-skeleton" label={t.organizations.loading} />}>
                <Route element={<OrganizationRootsPage />} path="/organizations" />
                <Route element={<OrganizationUnitPage key={scopeKey} searchQuery={searchQuery} onSearchAvailabilityChange={onSearchAvailabilityChange} />} path="/organizations/:unitId" />
                <Route element={<OrganizationMemberPage />} path="/organizations/:unitId/members/:memberId" />
              </Route>
              <Route element={<Navigate replace to="/profile" />} path="*" />
            </Routes>}

          </main>
        </div>
        {!mobile ? <div className="account-sidebar-footer">{legalLinks}</div> : null}
        <footer className="account-footer">
          <div className="account-footer-copy"><span>© 2026 哈利路亞家教會. All rights reserved.</span>{mobile ? legalLinks : null}</div>
        </footer>
      </div>
      {mobile ? <nav className="account-mobile-tabs" aria-label={t.nav.accountNavigation} data-mobile-hidden={!chromeVisible}>
        {navigation.filter(item => ['/profile', '/security', '/organizations'].includes(item.path)).map(({ icon: Icon, label, path }) => <Link key={path} to={path} aria-current={active(path) ? 'page' : undefined} className="account-mobile-tab" data-active={active(path) || undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
        {moreItems.length ? <Menu label={t.search.more} items={moreItems.map(item => ({ id: item.path, label: item.label }))}
          onAction={id => { if (moreItems.some(item => item.path === id)) navigate(id) }}
          trigger={<Button variant="ghost" className="account-mobile-tab" aria-label={t.search.more} data-active={moreItems.some(item => active(item.path)) || undefined}><Ellipsis aria-hidden="true" /><span>{t.search.more}</span></Button>} /> :
          <Button variant="ghost" className="account-mobile-tab" aria-label={t.search.more} aria-describedby="account-more-unavailable" isDisabled><Ellipsis aria-hidden="true" /><span>{t.search.more}</span><span className="sr-only" id="account-more-unavailable">{t.search.emptyMore}</span></Button>}
        <div className="account-mobile-avatar">{accountMenu}</div>
      </nav> : null}
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
