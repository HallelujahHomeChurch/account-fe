import { Button, Skeleton } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { serviceMessages } from '../../i18n/service'
import type { ServiceNotice } from '../../lib/member-service-api'
import './service.css'
export function ServiceNotices() {
  const { serviceApi } = useAuth()
  const { locale } = useLocale()
  const t = serviceMessages[locale]
  const navigate = useNavigate()
  const [items, setItems] = useState<ServiceNotice[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [next, setNext] = useState<string | undefined>()
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setPending(true)
    setError(false)
    void serviceApi
      .listNotices(cursor, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        setItems((current) =>
          cursor
            ? [
                ...new Map(
                  [...current, ...page].map((item) => [item.id, item]),
                ).values(),
              ]
            : page,
        )
        const last = page.at(-1)?.id
        setNext(page.length === 100 && last !== cursor ? last : undefined)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [serviceApi, cursor, revision])
  function open(item: ServiceNotice) {
    // Read receipts must not delay navigation or navigate after the user leaves.
    void serviceApi.readNotice(item.id).catch(() => {})
    navigate(`/service/assignments/${item.assignmentId}`)
  }
  return (
    <section className="account-document member-service">
      <Link to="/service">{t.title}</Link>
      <header className="member-service-heading">
        <h1>{t.notices}</h1>
      </header>
      {error ? (
        <div>
          <p role="alert">{t.failed}</p>
          <Button onPress={() => setRevision((v) => v + 1)}>{t.retry}</Button>
        </div>
      ) : null}
      {pending && !items.length ? <Skeleton label={t.loading} /> : null}
      {!pending && !error && !items.length ? (
        <p className="member-service-empty">{t.noNotices}</p>
      ) : null}
      <ul className="member-service-inbox">
        {items.map((item) => (
          <li key={item.id}>
            <Button variant="ghost" onPress={() => void open(item)}>
              <span>
                {item.readAt ? '' : '● '}
                {['request', 'open-request'].includes(item.kind)
                  ? t.invitation
                  : t.title}
              </span>
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(locale)}
              </time>
            </Button>
          </li>
        ))}
      </ul>
      {next ? (
        <Button
          variant="secondary"
          isDisabled={pending}
          onPress={() => setCursor(next)}
        >
          {t.loadMore}
        </Button>
      ) : null}
    </section>
  )
}
