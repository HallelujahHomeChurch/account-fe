import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { DataRequestsPage } from '../../pages/DataRequestsPage'
import { CorrectionController } from './controller'

export function CorrectionRoute() {
  const { api, profile, navigateExternal } = useAuth()
  const { locale } = useLocale()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const intent = params.get('intent') ?? undefined
  const client = api.dataRequests
  const controller = useMemo(() => client && profile?.id ? new CorrectionController(client, { currentEmail: profile.email, eligible: profile.is_active === true && profile.is_email_verified === true }, url => url.startsWith('/') ? navigate(url) : navigateExternal(url)) : null, [client, profile?.id, profile?.email, profile?.is_active, profile?.is_email_verified, navigate, navigateExternal])
  return controller ? <ConnectedCorrection key={profile?.id} controller={controller} locale={locale} intent={intent} /> : <Navigate replace to="/profile" />
}
function ConnectedCorrection({ controller, locale, intent }: { controller: CorrectionController; locale: ReturnType<typeof useLocale>['locale']; intent?: string }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => { void controller.load(intent); return () => controller.dispose() }, [controller, intent])
  useEffect(() => {
    if (!['pending_verification', 'link_expired', 'pending_approval'].includes(state.view)) return
    let lastRefresh = Date.now()
    const refresh = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefresh >= 30000) { lastRefresh = Date.now(); void controller.refresh() } }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [controller, state.view])
  return <DataRequestsPage {...state} locale={locale} onEmailChange={value => controller.edit(value)} onAction={(action, value) => void controller.action(action, value)} />
}
