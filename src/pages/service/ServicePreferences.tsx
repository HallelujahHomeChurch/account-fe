import { BrowserServicePushControl } from './BrowserServicePushControl'
import { DirtyNavigationGuard } from '../../components/DirtyNavigationGuard'
import { memberDetailsMessages } from '../../i18n/member-details'
import { Button, Select, Skeleton, Switch } from '@hallelujahhomechurch/ui'
import { useContext, useEffect, useRef, useState } from 'react'
import { Link, UNSAFE_DataRouterContext } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { serviceMessages } from '../../i18n/service'
import { OperationsApiError } from '../../lib/operations-api'
import type { ServicePreference } from '../../lib/member-service-api'
import './service.css'
export function ServicePreferences() {
  const { serviceApi } = useAuth()
  const { locale } = useLocale()
  const t = serviceMessages[locale]
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  const [baseline, setBaseline] = useState<ServicePreference | null>(null)
  const [pref, setPref] = useState<ServicePreference | null>(null)
  const [error, setError] = useState<'load' | 'save' | 'stale' | null>(null)
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty =
    pref !== null &&
    baseline !== null &&
    JSON.stringify(pref) !== JSON.stringify(baseline)
  const leaveMessage = memberDetailsMessages[locale].leave
  useEffect(() => {
    if (!dirty) return
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [dirty])
  function reload() {
    if (!dirty || window.confirm(leaveMessage)) setRevision((v) => v + 1)
  }
  const submitting = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setPref(null)
    setError(null)
    void serviceApi
      .getPreference(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setPref(next)
          setBaseline(next)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('load')
      })
    return () => controller.abort()
  }, [serviceApi, revision])
  async function save() {
    if (!pref || submitting.current || error === 'stale') return
    submitting.current = true
    setPending(true)
    setSaved(false)
    setError(null)
    try {
      const next = await serviceApi.updatePreference(pref)
      if (alive.current) {
        setPref(next)
        setBaseline(next)
        setSaved(true)
      }
    } catch (caught) {
      if (alive.current)
        setError(
          caught instanceof OperationsApiError && caught.status === 412
            ? 'stale'
            : 'save',
        )
    } finally {
      submitting.current = false
      if (alive.current) setPending(false)
    }
  }
  const zones = [
    ...new Set([
      pref?.timeZone ?? 'Asia/Taipei',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      'UTC',
      ...(Intl.supportedValuesOf?.('timeZone') ?? []),
    ]),
  ]
  return (
    <section className="account-document member-service">
      {dataRouter ? (
        <DirtyNavigationGuard dirty={dirty} message={leaveMessage} />
      ) : null}
      <Link to="/service">{t.title}</Link>
      <header className="member-service-heading">
        <h1>{t.preferences}</h1>
      </header>
      {error ? (
        <div>
          <p role="alert" className="form-error">
            {error === 'stale'
              ? t.prefStale
              : error === 'save'
                ? t.prefFailed
                : t.failed}
          </p>
          {error !== 'save' ? (
            <Button variant="secondary" onPress={reload}>
              {t.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!pref && !error ? <Skeleton label={t.loading} /> : null}
      <BrowserServicePushControl />
      {pref ? (
        <form
          className="member-service-detail"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <fieldset
            disabled={pending || error === 'stale'}
            className="member-service-settings"
          >
            <Switch
              label={t.reminder}
              isSelected={pref.enabled}
              onChange={(enabled) => {
                setPref({ ...pref, enabled })
                setSaved(false)
              }}
            />
            <Select
              label={t.days}
              selectedKey={String(pref.leadDays)}
              items={Array.from({ length: 8 }, (_, n) => ({
                id: String(n),
                label: String(n),
              }))}
              isDisabled={pending || error === 'stale' || !pref.enabled}
              onSelectionChange={(value) => {
                setPref({ ...pref, leadDays: Number(value) })
                setSaved(false)
              }}
            />
            <label>
              {t.time}
              <input
                className="organization-input"
                type="time"
                required
                value={pref.localTime}
                disabled={!pref.enabled}
                onChange={(e) => {
                  setPref({ ...pref, localTime: e.target.value })
                  setSaved(false)
                }}
              />
            </label>
            <Select
              label={t.zone}
              selectedKey={pref.timeZone}
              items={zones.map((id) => ({ id, label: id }))}
              isDisabled={pending || error === 'stale' || !pref.enabled}
              onSelectionChange={(timeZone) => {
                setPref({ ...pref, timeZone })
                setSaved(false)
              }}
            />
            <Button
              type="submit"
              isPending={pending}
              isDisabled={pending || error === 'stale'}
            >
              {t.save}
            </Button>
          </fieldset>
          {saved ? <p role="status">{t.saved}</p> : null}
        </form>
      ) : null}
    </section>
  )
}
