import { AlertDialog, Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { Device } from '../lib/api'

export function DevicesPage() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth.accessToken || auth.isBootstrapping) return
    if (!auth.api.listDevices) {
      setDevices([])
      return
    }
    let active = true
    setError('')
    auth.api.listDevices()
      .then((result) => { if (active) setDevices(result) })
      .catch(() => { if (active) setError(t.security.devicesLoadFailed) })
    return () => { active = false }
  }, [auth.accessToken, auth.api, auth.isBootstrapping, t.security.devicesLoadFailed])

  const sortedDevices = useMemo(
    () =>
      [...(devices ?? [])].sort(
        (left, right) =>
          Number(right.is_current) - Number(left.is_current) ||
          Number(right.is_signed_in) - Number(left.is_signed_in) ||
          Date.parse(right.last_active_at) - Date.parse(left.last_active_at),
      ),
    [devices],
  )

  async function signOut(device: Device) {
    setError('')
    try {
      await auth.api.logoutDevice?.(device.id)
      if (device.is_current) {
        auth.clearLocalSession()
        return
      }
      setDevices((current) =>
        (current ?? []).map((item) =>
          item.id === device.id ? { ...item, is_signed_in: false } : item,
        ),
      )
    } catch {
      setError(t.security.deviceSignOutFailed)
    }
  }

  if (auth.isBootstrapping || !auth.profile) return <Skeleton className="account-page-skeleton" label={t.security.loading} />

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.devices}</h1>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.security.devices}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          {devices === null ? (
            error ? null : <Skeleton className="settings-list-skeleton" label={t.security.loading} />
          ) : sortedDevices.length ? (
            sortedDevices.map((device) => {
              const generatedName = `${device.browser} on ${device.os}`
              const hasCustomName = Boolean(device.display_name && device.display_name !== generatedName)
              const deviceName = hasCustomName ? device.display_name : `${device.browser} · ${device.os}`
              const DeviceIcon = device.device_type === 'mobile'
                ? Smartphone
                : device.device_type === 'tablet'
                  ? Tablet
                  : Monitor
              return (
                <div
                  key={device.id}
                  className={`settings-row device-row${device.is_signed_in ? '' : ' is-signed-out'}`}
                >
                  <span className="device-icon" aria-hidden="true">
                    <DeviceIcon />
                  </span>
                  <div className="settings-row-copy device-row-copy">
                    <div className="device-heading">
                      <strong>{deviceName}</strong>
                      {device.is_current ? (
                        <span className="device-status">{t.security.currentDevice}</span>
                      ) : device.is_signed_in ? (
                        <span className="device-status is-active">{t.security.activeDevice}</span>
                      ) : (
                        <span className="device-status is-signed-out">{t.security.signedOut}</span>
                      )}
                    </div>
                    {hasCustomName ? <span className="device-platform">{device.browser} · {device.os}</span> : null}
                    <div className="device-metadata">
                      <span className="device-metadata-item">
                        <span className="device-metadata-label">{t.security.lastActive}</span>
                        <time dateTime={device.last_active_at}>
                          {relativeTime(device.last_active_at, locale)}
                        </time>
                      </span>
                      <span className="device-metadata-item">
                        <span className="device-metadata-label">{t.security.lastSignIn}</span>
                        <time dateTime={device.last_login_at}>
                          {relativeTime(device.last_login_at, locale)}
                        </time>
                      </span>
                      {device.ip_address ? (
                        <span className="device-metadata-item">
                          <span className="device-metadata-label">{t.security.ipAddress}</span>
                          <span>{device.ip_address}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {device.is_signed_in ? (
                    <AlertDialog
                      cancelLabel={t.security.cancel}
                      confirmLabel={t.security.signOutDevice}
                      description={device.is_current
                        ? t.security.signOutCurrentDeviceDescription
                        : t.security.signOutOtherDeviceDescription}
                      title={device.is_current
                        ? t.security.signOutCurrentDeviceTitle
                        : formatMessage(t.security.signOutOtherDeviceTitle, { device: deviceName })}
                      trigger={
                        <Button
                          aria-label={formatMessage(t.security.signOutDeviceLabel, {
                            device: deviceName,
                          })}
                          variant="ghost"
                        >
                          {t.security.signOutDevice}
                        </Button>
                      }
                      onConfirm={() => signOut(device)}
                    />
                  ) : null}
                </div>
              )
            })
          ) : (
            <p className="muted-copy">{t.security.noDevices}</p>
          )}
        </Card.Content>
      </Card>
    </section>
  )
}

function relativeTime(value: string, locale: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(seconds / size),
        unit,
      )
    }
  }
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(seconds, 'second')
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  )
}
