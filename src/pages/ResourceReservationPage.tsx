import { Button, Card, Form, Input, Label, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { OperationsApiError, type ReservableResource } from '../lib/operations-api'

type ResourceState = { resource?: ReservableResource }

function localDate(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

export function ResourceReservationPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const { resourceKey = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const initialResource = (location.state as ResourceState | null)?.resource
  const [resource, setResource] = useState<ReservableResource | null>(initialResource?.key === resourceKey ? initialResource : null)
  const [startsAt, setStartsAt] = useState(() => localDate(new Date(Date.now() + 60 * 60_000)))
  const [endsAt, setEndsAt] = useState(() => localDate(new Date(Date.now() + 2 * 60 * 60_000)))
  const [purpose, setPurpose] = useState('')
  const [busyIntervals, setBusyIntervals] = useState<Array<{ startsAt: string; endsAt: string }> | null>(null)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (resource || unavailable || !resourceKey) return
    let active = true
    auth.operationsApi.listMyResources().then((resources) => {
      if (!active) return
      const next = resources.find((item) => item.key === resourceKey) ?? null
      setResource(next)
      if (!next) { setUnavailable(true); setError(t.resources.noLongerEligible) }
    }).catch(() => { if (active) setError(t.resources.loadFailed) })
    return () => { active = false }
  }, [auth.operationsApi, resource, resourceKey, t.resources.loadFailed, t.resources.noLongerEligible, unavailable])

  const loadAvailability = useCallback(async () => {
    if (!resource || !startsAt || !endsAt) return
    setError('')
    try {
      const availability = await auth.operationsApi.getAvailability(resource.key, new Date(startsAt).toISOString(), new Date(endsAt).toISOString())
      setBusyIntervals(availability.busyIntervals)
    } catch (caught) {
      setBusyIntervals(null)
      if (caught instanceof OperationsApiError && caught.status === 404) {
        setResource(null)
        setUnavailable(true)
        setError(t.resources.noLongerEligible)
      } else setError(t.resources.loadFailed)
    }
  }, [auth.operationsApi, endsAt, resource, startsAt, t.resources.loadFailed, t.resources.noLongerEligible])

  useEffect(() => { void loadAvailability() }, [loadAvailability])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resource || !purpose.trim() || !startsAt || !endsAt) return
    setSubmitting(true); setError('')
    try {
      await auth.operationsApi.createReservation({ resourceId: resource.id, purpose: purpose.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }, crypto.randomUUID())
      navigate('/resources/reservations', { replace: true })
    } catch (caught) {
      setError(caught instanceof OperationsApiError && caught.status === 403
        ? t.resources.noLongerEligible
        : caught instanceof OperationsApiError && caught.status === 409
          ? t.resources.conflict
          : t.resources.requestFailed)
    } finally { setSubmitting(false) }
  }

  if (!resource && !error) return <Skeleton className="account-page-skeleton" label={t.resources.loading} />

  return <section className="account-document">
    <p><Link to="/resources">{t.resources.title}</Link></p>
    <div className="page-heading"><h1>{resource ? `${t.resources.requestTitle}: ${resource.name}` : t.resources.requestTitle}</h1></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {resource ? <Card className="panel-card"><Card.Content><Form className="form-stack" onSubmit={submit}>
      <TextField isRequired name="purpose" value={purpose} onChange={setPurpose}><Label>{t.resources.purpose}</Label><Input /></TextField>
      <div className="form-grid">
        <TextField isRequired name="startsAt" value={startsAt} onChange={setStartsAt}><Label>{t.resources.start}</Label><Input type="datetime-local" /></TextField>
        <TextField isRequired name="endsAt" value={endsAt} onChange={setEndsAt}><Label>{t.resources.end}</Label><Input type="datetime-local" /></TextField>
      </div>
      <Button type="button" variant="secondary" onPress={() => void loadAvailability()}>{t.resources.checkAvailability}</Button>
      {busyIntervals ? <section aria-live="polite"><h2>{t.resources.availability}</h2>{busyIntervals.length ? <ul>{busyIntervals.map((item) => <li key={`${item.startsAt}-${item.endsAt}`}><time dateTime={item.startsAt}>{new Date(item.startsAt).toLocaleString()}</time> — <time dateTime={item.endsAt}>{new Date(item.endsAt).toLocaleString()}</time></li>)}</ul> : <p className="muted-copy">{t.resources.noBusyIntervals}</p>}</section> : null}
      <Button isPending={submitting} type="submit">{submitting ? t.resources.submitting : t.resources.submit}</Button>
    </Form></Card.Content></Card> : <Link to="/resources">{t.resources.retry}</Link>}
  </section>
}
