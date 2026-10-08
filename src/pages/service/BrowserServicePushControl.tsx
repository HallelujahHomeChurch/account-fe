import { Button, Switch } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { servicePushMessages } from '../../i18n/service-push'
import {
  disableBrowserServicePush,
  enableBrowserServicePush,
  getBrowserServicePushState,
  type BrowserServicePushState,
} from '../../lib/browser-service-push'

export function BrowserServicePushControl() {
  const { serviceApi, profile } = useAuth()
  const owner = profile?.id ?? ''
  const { locale } = useLocale()
  const t = servicePushMessages[locale]
  const [config, setConfig] = useState<{
    enabled: boolean
    publicKey?: string
  } | null>(null)
  const [state, setState] = useState<BrowserServicePushState>('off')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    pending.current = false
    setBusy(false)
    setConfig(null)
    setError(false)
    if (owner)
      void serviceApi
        .getPushConfig(abort.signal)
        .then(async (next) => {
          const status = next.enabled
            ? await getBrowserServicePushState(owner)
            : 'off'
          if (!abort.signal.aborted) {
            setConfig(next)
            setState(status)
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) setError(true)
        })
    return () => abort.abort()
  }, [serviceApi, owner, revision])
  async function update(enabled: boolean) {
    if (pending.current || !config?.enabled || !config.publicKey) return
    pending.current = true
    setBusy(true)
    setError(false)
    const signal = controller.current?.signal
    try {
      if (enabled)
        await enableBrowserServicePush(
          serviceApi,
          owner,
          config.publicKey,
          signal,
        )
      else await disableBrowserServicePush(serviceApi, owner)
      const next = await getBrowserServicePushState(owner)
      if (!signal?.aborted) setState(next)
    } catch {
      if (!signal?.aborted) {
        setError(true)
        try {
          const next = await getBrowserServicePushState(owner)
          if (!signal?.aborted) setState(next)
        } catch {
          /* Preserve the last known state for retry. */
        }
      }
    } finally {
      if (!signal?.aborted) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  if (!owner || (config && !config.enabled)) return null
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  const unsupported = state === 'unsupported'
  return (
    <section className="member-service-settings">
      <Switch
        label={t.label}
        isSelected={state === 'on'}
        isDisabled={
          !config ||
          busy ||
          unsupported ||
          state === 'denied' ||
          state === 'pending'
        }
        onChange={(enabled) => void update(enabled)}
      />
      {state === 'denied' ? (
        <p>{t.denied}</p>
      ) : unsupported ? (
        <p>{ios && !standalone ? t.install : t.unsupported}</p>
      ) : state === 'pending' ? (
        <p>{t.pending}</p>
      ) : null}
      {error || state === 'pending' ? (
        <div>
          {error ? (
            <p role="alert" className="form-error">
              {t.failed}
            </p>
          ) : null}
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() =>
              state === 'pending'
                ? void update(false)
                : setRevision((value) => value + 1)
            }
          >
            {t.retry}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
