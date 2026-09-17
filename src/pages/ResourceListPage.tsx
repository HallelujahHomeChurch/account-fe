import { Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { ReservableResource } from '../lib/operations-api'

export function ResourceListPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [resources, setResources] = useState<ReservableResource[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try { setResources(await auth.operationsApi.listMyResources()) }
    catch { setError(true); setResources([]) }
  }, [auth.operationsApi])

  useEffect(() => { void load() }, [load])

  if (resources === null) return <Skeleton className="account-page-skeleton" label={t.resources.loading} />

  return <section className="account-document">
    <div className="page-heading"><h1>{t.resources.title}</h1><p>{t.resources.description}</p></div>
    <p><Link to="/resources/reservations">{t.resources.myReservations}</Link></p>
    {error ? <Card className="panel-card"><Card.Content><p className="form-error" role="alert">{t.resources.loadFailed}</p><Button variant="secondary" onPress={() => void load()}>{t.resources.retry}</Button></Card.Content></Card> : null}
    {!error && resources.length === 0 ? <Card className="panel-card"><Card.Content><p className="muted-copy">{t.resources.noResources}</p></Card.Content></Card> : null}
    <div className="resource-card-grid">
      {resources.map((resource) => <Card className="panel-card" key={resource.id}>
        <Card.Header><Card.Title>{resource.name}</Card.Title></Card.Header>
        <Card.Content><p className="muted-copy">{resource.timezone}</p><Link to={`/resources/${resource.key}`} state={{ resource }}>{t.resources.chooseResource}</Link></Card.Content>
      </Card>)}
    </div>
  </section>
}
