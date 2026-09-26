import { Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { ChevronRight, Folder } from 'lucide-react'
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
  return <section className="account-document organization-page">
    <div className="page-heading"><h1>{t.organizations.roots}</h1><p>{t.organizations.description}</p></div>
    {status !== 'ok' ? <Card className="panel-card"><Card.Content><p className="form-error" role="alert">{status === 'forbidden' ? t.organizations.forbidden : t.organizations.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.organizations.retry}</Button></Card.Content></Card> : null}
    {status === 'ok' && !roots.length ? <p className="muted-copy">{t.organizations.empty}</p> : null}
    <div className="organization-root-grid">{roots.map(unit => <Card className="panel-card" key={unit.id}><Card.Header><div className="organization-eyebrow"><Folder size={20} aria-hidden="true" />{t.organizations[unit.kind]}</div><Card.Title>{unit.name}</Card.Title></Card.Header><Card.Content><Link className="organization-row-link" to={'/organizations/' + unit.id}><span>{t.organizations.view}</span><ChevronRight size={18} aria-hidden="true" /></Link></Card.Content></Card>)}</div>
  </section>
}
