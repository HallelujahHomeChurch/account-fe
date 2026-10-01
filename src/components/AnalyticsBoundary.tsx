import {
  analyticsMessages,
  createAnalyticsController,
  getAnalyticsChoiceCookie,
  readAnalyticsChoice,
  type AnalyticsChoice,
  type SafeAnalyticsEvent,
} from '@hallelujahhomechurch/preferences'
import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { useLocale } from '../i18n/locale-context'
import { pendingLoginAnalyticsKey } from '../lib/analytics-events'
import { accountAnalyticsRoute } from '../lib/analytics-route'

export function AnalyticsBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { locale } = useLocale()
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID ?? ''
  const enabled =
    /^G-[A-Z0-9]{5,20}$/.test(id) &&
    window.location.hostname === 'account.alive.org.tw'
  const route = accountAnalyticsRoute(
    location.pathname,
    location.search,
    location.hash,
  )
  const controller = useRef<ReturnType<
    typeof createAnalyticsController
  > | null>(null)
  const consumeLogin = useCallback(() => {
    if (!route || readAnalyticsChoice(document.cookie) !== 'granted') return
    try {
      const pending = sessionStorage.getItem(pendingLoginAnalyticsKey)
      if (pending === null) return
      sessionStorage.removeItem(pendingLoginAnalyticsKey)
      const age = Date.now() - Number(pending)
      if (Number.isFinite(age) && age >= 0 && age <= 60000)
        controller.current?.track('login_completed')
    } catch {
      /* Optional analytics must not interrupt login. */
    }
  }, [route])
  const [started, setStarted] = useState(false)
  const [choice, setChoice] = useState(() =>
    readAnalyticsChoice(document.cookie),
  )
  useLayoutEffect(() => {
    if (!enabled) return
    const value = createAnalyticsController({
      measurementId: id,
      host: window.location.hostname,
      readChoice: () => readAnalyticsChoice(document.cookie),
    })
    controller.current = value
    return () => {
      value.dispose()
      controller.current = null
    }
  }, [enabled, id])
  useLayoutEffect(() => {
    if (!controller.current) return
    const reload = !route && controller.current.requiresDocumentNavigation()
    controller.current.sync(route)
    setStarted(controller.current.requiresDocumentNavigation())
    consumeLogin()
    if (reload)
      window.location.replace(
        `${location.pathname}${location.search}${location.hash}`,
      )
  }, [route, location.pathname, location.search, location.hash, consumeLogin])
  useEffect(() => {
    if (!enabled) return
    const sync = () => {
      setChoice(readAnalyticsChoice(document.cookie))
      controller.current?.sync(route)
      setStarted(controller.current?.requiresDocumentNavigation() ?? false)
    }
    const visible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const track = (event: Event) => {
      const name = (event as CustomEvent<SafeAnalyticsEvent>).detail
      if (name === 'login_completed' || name === 'profile_saved')
        controller.current?.track(name)
    }
    window.addEventListener('hhc:login-completed', consumeLogin)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('hhc:analytics-choice', sync)
    window.addEventListener('hhc:analytics-event', track)
    return () => {
      window.removeEventListener('hhc:login-completed', consumeLogin)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('hhc:analytics-choice', sync)
      window.removeEventListener('hhc:analytics-event', track)
    }
  }, [enabled, route, consumeLogin])
  function choose(next: Exclude<AnalyticsChoice, 'unknown'>) {
    document.cookie = getAnalyticsChoiceCookie(next)
    setChoice(next)
    controller.current?.sync(route)
    setStarted(controller.current?.requiresDocumentNavigation() ?? false)
    window.dispatchEvent(new Event('hhc:analytics-choice'))
  }
  if (enabled && !route && started) return null
  const copy = analyticsMessages[locale]
  return (
    <>
      {children}
      {enabled ? (
        <details
          className="analytics-preferences"
          key={choice === 'unknown' ? 'unknown' : 'chosen'}
          open={choice === 'unknown' ? true : undefined}
        >
          <summary>{copy.title}</summary>
          <p>{copy.description}</p>
          <button type="button" onClick={() => choose('granted')}>
            {copy.allow}
          </button>{' '}
          <button type="button" onClick={() => choose('denied')}>
            {copy.deny}
          </button>
        </details>
      ) : null}
    </>
  )
}
