import { Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { OperationsApiError, type ResourceReservation } from '../lib/operations-api'

export function MyResourceReservationsPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [reservations, setReservations] = useState<ResourceReservation[] | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try { setReservations(await auth.operationsApi.listMyReservations()) }
    catch { setError(t.resources.loadFailed); setReservations([]) }
  }, [auth.operationsApi, t.resources.loadFailed])

  useEffect(() => { void load() }, [load])

  async function cancel(reservation: ResourceReservation) {
    setPending(reservation.id); setError('')
    try {
      const next = await auth.operationsApi.cancelReservation(reservation.id, reservation.version)
      setReservations((items) => items?.map((item) => item.id === next.id ? next : item) ?? [])
    } catch (caught) {
      if (caught instanceof OperationsApiError && caught.status === 412) {
        setError(t.resources.stale)
        try { setReservations(await auth.operationsApi.listMyReservations()) } catch { /* keep the stale error */ }
      }
      else setError(t.resources.cancelFailed)
    } finally { setPending(null) }
  }

  if (reservations === null) return <Skeleton className="account-page-skeleton" label={t.resources.loading} />

  return <section className="account-document">
    <p><Link to="/resources">{t.resources.title}</Link></p>
    <div className="page-heading"><h1>{t.resources.reservationHistory}</h1></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {reservations.length === 0 ? <Card className="panel-card"><Card.Content><p className="muted-copy">{t.resources.noReservations}</p></Card.Content></Card> : null}
    <div className="resource-card-grid">{reservations.map((reservation) => <Card className="panel-card" key={reservation.id}>
      <Card.Header><Card.Title>{reservation.purpose}</Card.Title><span className="status-pill">{t.resources.statuses[reservation.status]}</span></Card.Header>
      <Card.Content><p><time dateTime={reservation.startsAt}>{new Date(reservation.startsAt).toLocaleString()}</time> — <time dateTime={reservation.endsAt}>{new Date(reservation.endsAt).toLocaleString()}</time></p>
        {['requested', 'approved'].includes(reservation.status) ? <Button isPending={pending === reservation.id} variant="ghost" onPress={() => void cancel(reservation)}>{t.resources.cancel}</Button> : null}
      </Card.Content>
    </Card>)}</div>
  </section>
}
