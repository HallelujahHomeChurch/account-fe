import { Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import type { ManagedUnit } from '../../lib/operations-api'

export function OrganizationRootsPage() {
  const { operationsApi } = useAuth()
  const { messages: t } = useLocale()
  const [roots, setRoots] = useState<ManagedUnit[] | null>(null)
  const [status, setStatus] = useState<'ok' | 'forbidden' | 'error'>('ok')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setRoots(null); setStatus('ok')
    void operationsApi.listManagedRoots(controller.signal)
      .then(value => { if (!controller.signal.aborted) setRoots(value) })
      .catch(error => { if (!controller.signal.aborted) { setRoots([]); setStatus(error instanceof Error && 'status' in error && error.status === 403 ? 'forbidden' : 'error') } })
    return () => controller.abort()
  }, [operationsApi, revision])

  if (roots === null) return <Skeleton className="account-page-skeleton" label={t.organizations.loading} />
  return <section className="account-document organization-page organization-roots-page">
    <div className="page-heading"><h1>{t.organizations.roots}</h1><p>{t.organizations.chooseUnit}</p></div>
    {status !== 'ok' ? <Card className="panel-card"><Card.Content><p className="form-error" role="alert">{status === 'forbidden' ? t.organizations.forbidden : t.organizations.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.organizations.retry}</Button></Card.Content></Card> : null}
    {status === 'ok' ? roots.length ? <ul className="organization-unit-list" aria-label={t.organizations.roots}>
      {roots.map(unit => <li key={unit.id}>
        <Link to={'/organizations/' + unit.id} aria-label={t.organizations.manage + ' ' + unit.name}>
          <span className="organization-unit-name">{unit.name}</span>
          <span className="organization-unit-enter" aria-hidden="true">{t.organizations.manage}<ChevronRight size={18} /></span>
        </Link>
      </li>)}
    </ul> : <p role="status" className="organization-unit-empty">{t.organizations.empty}</p> : null}
  </section>
}
