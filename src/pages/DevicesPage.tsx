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
  const currentDevice = sortedDevices.find((device) => device.is_current)
  const otherDevices = sortedDevices.filter((device) => !device.is_current)

  async function signOut(device: Device) {
    setError('')
    try {
      await auth.api.logoutDevice?.(device.id)
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

  function renderDevice(device: Device) {
    const generatedName = `${device.browser} on ${device.os}`
    const hasCustomName = Boolean(device.display_name && device.display_name !== generatedName)
    const friendlyPlatform = formatPlatform(device.os)
    const platform = formatPlatformDetail(device.os)
    const deviceName = hasCustomName ? device.display_name : `${device.browser} · ${friendlyPlatform}`
    const platformDetail = hasCustomName
      ? `${device.browser} · ${platform}`
      : friendlyPlatform === device.os ? '' : platform
    const DeviceIcon = device.device_type === 'mobile'
      ? Smartphone
      : device.device_type === 'tablet'
        ? Tablet
        : Monitor

    return (
      <div
        key={device.id}
        className={`settings-row device-row device-management-row${device.is_current ? ' is-current' : ''}${device.is_signed_in ? '' : ' is-signed-out'}`}
      >
        <span className="device-icon" aria-hidden="true">
          <DeviceIcon />
        </span>
        <div className="settings-row-copy device-row-copy">
          <div className="device-heading">
            <strong>{deviceName}</strong>
            {device.is_current ? (
              <span className="device-status is-current">{t.security.activeDevice}</span>
            ) : !device.is_signed_in ? (
              <span className="device-status is-signed-out">{t.security.signedOut}</span>
            ) : null}
          </div>
          {platformDetail ? <span className="device-platform" title={platformDetail}>{platformDetail}</span> : null}
        </div>
        <div className="device-metadata">
          <span className="device-metadata-item">
            <span className="device-metadata-label">{t.security.lastActive}</span>
            <time dateTime={device.last_active_at}>{relativeTime(device.last_active_at, locale)}</time>
          </span>
          <span className="device-metadata-item">
            <span className="device-metadata-label">{t.security.lastSignIn}</span>
            <time dateTime={device.last_login_at}>{relativeTime(device.last_login_at, locale)}</time>
          </span>
          {device.ip_address ? (
            <span className="device-metadata-item">
              <span className="device-metadata-label">{t.security.ipAddress}</span>
              <span>{device.ip_address}</span>
            </span>
          ) : null}
        </div>
        {!device.is_current && device.is_signed_in ? (
          <AlertDialog
            cancelLabel={t.security.cancel}
            confirmLabel={t.security.signOutDevice}
            description={t.security.signOutOtherDeviceDescription}
            title={formatMessage(t.security.signOutOtherDeviceTitle, { device: deviceName })}
            trigger={
              <Button
                aria-label={formatMessage(t.security.signOutDeviceLabel, { device: deviceName })}
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
  }

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.devices}</h1>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {devices === null ? (
        error ? null : (
          <Card className="panel-card settings-card">
            <Card.Content><Skeleton className="settings-list-skeleton" label={t.security.loading} /></Card.Content>
          </Card>
        )
      ) : sortedDevices.length ? (
        <div className="device-sections">
          {currentDevice ? (
            <Card className="panel-card settings-card device-section-card device-current-section">
              <Card.Header><Card.Title>{t.security.currentDevice}</Card.Title></Card.Header>
              <Card.Content isFlush className="settings-list device-section-list">{renderDevice(currentDevice)}</Card.Content>
            </Card>
          ) : null}
          {otherDevices.length ? (
            <Card className="panel-card settings-card device-section-card device-other-section">
              <Card.Header>
                <Card.Title>{t.security.otherDevices}</Card.Title>
                <span className="device-count" aria-hidden="true">{otherDevices.length}</span>
              </Card.Header>
              <Card.Content isFlush className="settings-list device-section-list">
                {otherDevices.map(renderDevice)}
              </Card.Content>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="panel-card settings-card">
          <Card.Content><p className="muted-copy">{t.security.noDevices}</p></Card.Content>
        </Card>
      )}
    </section>
  )
}

function formatPlatform(os: string) {
  if (/iphone/i.test(os)) return 'iPhone'
  if (/ipad/i.test(os)) return 'iPad'
  if (/mac os|macos/i.test(os)) return 'Mac'
  if (/android/i.test(os)) return 'Android'
  if (/windows/i.test(os)) return 'Windows'
  return os
}

function formatPlatformDetail(os: string) {
  const iosVersion = os.match(/(?:iphone )?os ([\d_]+)/i)?.[1]
  if (iosVersion) return `iOS ${iosVersion.replaceAll('_', '.')}`

  const macVersion = os.match(/mac os x ([\d_]+)/i)?.[1]
  if (macVersion) return `macOS ${macVersion.replaceAll('_', '.')}`

  return os
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
