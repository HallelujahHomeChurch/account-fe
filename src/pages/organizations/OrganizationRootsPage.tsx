import { Button, Card, DataTableFrame, Skeleton } from '@hallelujahhomechurch/ui'
import { Pencil } from 'lucide-react'
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
  return <section className="account-document organization-page organization-folder-page">
    <header className="organization-folder-header"><nav className="organization-breadcrumb" aria-label={t.organizations.title}><span aria-current="page">{t.organizations.title}</span></nav></header>
    <h1 className="sr-only">{t.organizations.title}</h1>
    {status !== 'ok' ? <Card className="panel-card"><Card.Content><p className="form-error" role="alert">{status === 'forbidden' ? t.organizations.forbidden : t.organizations.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.organizations.retry}</Button></Card.Content></Card> : null}
    {status === 'ok' ? <div className="organization-directory"><DataTableFrame>
      <table className="organization-table" aria-label={t.organizations.title}>
        <thead><tr><th>{t.organizations.name}</th><th>{t.organizations.email}</th><th>{t.organizations.kind}</th><th className="organization-row-action"><span className="sr-only">{t.organizations.view}</span></th></tr></thead>
        <tbody>{roots.map(unit => <tr className="organization-folder-row" key={unit.id}>
          <td><Link className="organization-row-link" to={'/organizations/' + unit.id}><span>{unit.name}</span></Link></td>
          <td className="organization-email">{unit.email || '—'}</td><td>{t.organizations[unit.kind]}</td>
          <td className="organization-row-action"><Link className="organization-icon-action" aria-label={t.organizations.view + ' ' + unit.name} to={'/organizations/' + unit.id}><Pencil size={16} aria-hidden="true" /></Link></td>
        </tr>)}{!roots.length ? <tr><td colSpan={4} className="organization-empty">{t.organizations.empty}</td></tr> : null}</tbody>
      </table>
    </DataTableFrame></div> : null}
  </section>
}
