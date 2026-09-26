import { Button, Card, Dialog, Skeleton } from '@hallelujahhomechurch/ui'
import { ChevronRight, Folder, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import type { EntitlementCode, ManagedJoinCandidate, ManagedMemberPage, ManagedResponsibility, ManagedResponsibilityCandidate, ManagedUnitFolder } from '../../lib/operations-api'
import { OrganizationNotificationDialog } from './OrganizationNotificationDialog'
import { useManagedMutation, weeklyReportCodes, weeklyReportLabels } from './organization-state'

export function OrganizationUnitPage() {
  const { unitId = '' } = useParams()
  return <UnitFolder key={unitId} unitId={unitId} />
}

function UnitFolder({ unitId }: { unitId: string }) {
  const { operationsApi } = useAuth()
  const { messages: { organizations: t } } = useLocale()
  const [folder, setFolder] = useState<ManagedUnitFolder | null>(null)
  const [members, setMembers] = useState<ManagedMemberPage | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<'forbidden' | 'failed' | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [entitlementCode, setEntitlementCode] = useState<EntitlementCode>(weeklyReportCodes[0])
  const [dialog, setDialog] = useState<'add' | 'child' | 'settings' | 'archive' | 'notification' | null>(null)
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidates, setCandidates] = useState<ManagedJoinCandidate[]>([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState(false)
  const [responsibilityQuery, setResponsibilityQuery] = useState('')
  const [responsibilityCandidates, setResponsibilityCandidates] = useState<ManagedResponsibilityCandidate[]>([])
  const [responsibilities, setResponsibilities] = useState<ManagedResponsibility[]>([])
  const [responsibilityError, setResponsibilityError] = useState(false)
  const { mutate, pending, error } = useManagedMutation()
  const refresh = () => setRevision(value => value + 1)

  useEffect(() => {
    if (query.trim() === search) return
    const timer = window.setTimeout(() => { setSearch(query.trim()); setPage(1); setSelected([]) }, 250)
    return () => window.clearTimeout(timer)
  }, [query, search])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setLoadError(null); setSelected([])
    void (async () => {
      try {
        const nextFolder = await operationsApi.getManagedUnit(unitId, includeArchived, controller.signal)
        const nextMembers = nextFolder.unit.status === 'archived' ? { items: [], page: 1 } : await operationsApi.listManagedMembers(unitId, search, page, controller.signal)
        if (!controller.signal.aborted) { setFolder(nextFolder); setMembers(nextMembers) }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setFolder(null); setMembers(null)
          setLoadError(reason instanceof Error && 'status' in reason && reason.status === 403 ? 'forbidden' : 'failed')
        }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [includeArchived, operationsApi, page, search, unitId, revision])

  useEffect(() => {
    setCandidates([]); setCandidateError(false)
    if (dialog !== 'add' || [...candidateQuery.trim()].length < 2) { setCandidateLoading(false); return }
    const controller = new AbortController()
    setCandidateLoading(true)
    const timer = window.setTimeout(() => {
      void operationsApi.searchManagedCandidates(unitId, candidateQuery.trim(), controller.signal)
        .then(value => { if (!controller.signal.aborted) setCandidates(value) })
        .catch(() => { if (!controller.signal.aborted) setCandidateError(true) })
        .finally(() => { if (!controller.signal.aborted) setCandidateLoading(false) })
    }, 250)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [candidateQuery, dialog, operationsApi, unitId])

  useEffect(() => {
    if (dialog !== 'settings' || !folder?.actions.manageResponsibilities) return
    const controller = new AbortController()
    setResponsibilityError(false)
    void operationsApi.listManagedResponsibilities(unitId, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResponsibilities(value) })
      .catch(() => { if (!controller.signal.aborted) setResponsibilityError(true) })
    return () => controller.abort()
  }, [dialog, folder?.actions.manageResponsibilities, operationsApi, revision, unitId])

  useEffect(() => {
    setResponsibilityCandidates([])
    if (dialog !== 'settings' || !folder?.actions.manageResponsibilities || [...responsibilityQuery.trim()].length < 2) return
    const controller = new AbortController()
    setResponsibilityError(false)
    const timer = window.setTimeout(() => {
      void operationsApi.listResponsibilityCandidates(unitId, responsibilityQuery.trim(), controller.signal)
        .then(value => { if (!controller.signal.aborted) setResponsibilityCandidates(value) })
        .catch(() => { if (!controller.signal.aborted) setResponsibilityError(true) })
    }, 250)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [dialog, folder?.actions.manageResponsibilities, operationsApi, responsibilityQuery, unitId])

  async function run(signature: unknown, execute: (key: string) => Promise<unknown>, done?: () => void) {
    if (await mutate(JSON.stringify(signature), execute)) { done?.(); refresh() }
  }
  const errorText = error === 'forbidden' ? t.forbidden : error === 'conflict' ? t.conflict : t.requestFailed
  const mutationError = error ? <p className="form-error" role="alert">{errorText}</p> : null
  if (!folder && loading) return <Skeleton className="account-page-skeleton" label={t.loading} />
  if (!folder) return <section className="account-document"><p className="form-error" role="alert">{loadError === 'forbidden' ? t.forbidden : t.loadFailed}</p><Button onPress={refresh}>{t.retry}</Button></section>
  const archived = folder.unit.status === 'archived'
  const childKinds = folder.unit.kind === 'church' ? ['family', 'fellowship'] as const : folder.unit.kind === 'family' ? ['small_group'] as const : []
  const canSelect = folder.actions.manageEntitlements && !archived
  const close = (open: boolean) => { if (!open && !pending) setDialog(null) }

  return <section className="account-document organization-page">
    <nav aria-label={t.title} className="organization-breadcrumb">
      <Link to="/organizations">{t.roots}</Link>
      {folder.breadcrumb.map(item => <span key={item.id}><ChevronRight size={14} aria-hidden="true" /><Link to={'/organizations/' + item.id}>{item.name}</Link></span>)}
      <span aria-current="page"><ChevronRight size={14} aria-hidden="true" />{folder.unit.name}</span>
    </nav>
    <div className="organization-heading">
      <div className="page-heading"><div className="organization-eyebrow">{t[folder.unit.kind]}{archived ? <span className="organization-badge">{t.archived}</span> : null}</div><h1>{folder.unit.name}</h1><p>{folder.unit.email || t.description}</p></div>
      <div className="organization-actions">
        {folder.actions.editUnit ? <Button variant="secondary" isDisabled={loading} onPress={() => setDialog('settings')}>{t.settings}</Button> : null}
        {folder.actions.restore ? <Button isDisabled={pending || loading} onPress={() => void run(['restore', folder.unit.version], key => operationsApi.setManagedUnitStatus(unitId, folder.unit.version, 'restore', key))}>{t.restore}</Button> : null}
        {folder.actions.sendNotifications ? <Button isDisabled={loading} onPress={() => setDialog('notification')}>{t.notifications}</Button> : null}
      </div>
    </div>
    {!dialog ? mutationError : null}
    <Card className="panel-card organization-directory">
      <Card.Header>
        <div className="organization-section-heading"><Card.Title>{t.directory}</Card.Title><div className="organization-actions">
          {folder.actions.createChild && childKinds.length ? <Button size="sm" variant="secondary" isDisabled={loading || pending} onPress={() => setDialog('child')}>{t.createChild}</Button> : null}
          {folder.actions.manageMembers ? <Button size="sm" isDisabled={loading || pending} onPress={() => setDialog('add')}>{t.addMember}</Button> : null}
        </div></div>
        <p className="muted-copy">{t.scopeHint}</p>
      </Card.Header>
      <Card.Content>
        <div className="organization-section-heading organization-toolbar">
          <input className="organization-input" type="search" aria-label={t.searchMembers} placeholder={t.searchMembers} value={query} disabled={archived} onChange={event => setQuery(event.target.value)} />
          <label className="organization-checkbox"><input checked={includeArchived} type="checkbox" onChange={event => setIncludeArchived(event.target.checked)} />{t.showArchived}</label>
        </div>
        {selected.length ? <div className="organization-batch" aria-label={t.entitlements}>
          <span>{t.selectedCount} {selected.length} / 50</span>
          <select className="organization-input" aria-label={t.entitlements} value={entitlementCode} disabled={pending || loading} onChange={event => setEntitlementCode(event.target.value as EntitlementCode)}>{weeklyReportCodes.map((code, index) => <option key={code} value={code}>{weeklyReportLabels[index]}</option>)}</select>
          {(['grant', 'revoke'] as const).map(operation => <Button key={operation} size="sm" variant={operation === 'grant' ? 'primary' : 'secondary'} isDisabled={pending || loading} onPress={() => void run([operation, selected, entitlementCode], key => operationsApi.applyManagedEntitlements(unitId, selected, entitlementCode, operation, key), () => setSelected([]))}>{operation === 'grant' ? t.grant : t.remove}</Button>)}
          <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setSelected([])}>{t.clear}</Button>
        </div> : null}
        <div className="organization-table-scroll" aria-busy={loading}>
          <table className="organization-table">
            <thead><tr>{canSelect ? <th className="organization-selection"><span className="sr-only">{t.select}</span></th> : null}<th>{t.name}</th><th>{t.kind}</th><th>{t.email}</th></tr></thead>
            <tbody>
              {folder.children.map(child => <tr className="organization-folder-row" key={child.id}>
                {canSelect ? <td /> : null}
                <td><Link className="organization-row-link" to={'/organizations/' + child.id}><Folder size={18} aria-hidden="true" /><span>{child.name}{child.status === 'archived' ? <small className="organization-badge">{t.archived}</small> : null}</span><ChevronRight size={16} aria-hidden="true" /></Link></td>
                <td>{t[child.kind]}</td><td className="organization-email">{child.email || '—'}</td>
              </tr>)}
              {members?.items.map(member => <tr key={member.memberId}>
                {canSelect ? <td><input aria-label={t.select + ' ' + (member.displayName || member.email)} checked={selected.includes(member.memberId)} disabled={pending || loading || (!selected.includes(member.memberId) && selected.length >= 50)} type="checkbox" onChange={event => setSelected(current => event.target.checked ? [...current, member.memberId] : current.filter(id => id !== member.memberId))} /></td> : null}
                <td><Link className="organization-row-link" to={'/organizations/' + unitId + '/members/' + member.memberId}><UsersRound size={18} aria-hidden="true" /><span>{member.displayName || member.email}</span></Link></td><td>{t.members}</td><td className="organization-email">{member.email}</td>
              </tr>)}
              {!members?.items.length ? <tr><td colSpan={canSelect ? 4 : 3} className="organization-empty">{search ? t.noResults : t.noMembers}</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="organization-section-heading organization-pagination">
          <span className="muted-copy" role="status">{loading ? t.refreshing : t.members + ' · ' + page}</span>
          <div className="organization-actions"><Button size="sm" isDisabled={page === 1 || loading || pending} variant="secondary" onPress={() => setPage(value => value - 1)}>{t.previous}</Button><Button size="sm" isDisabled={!members?.nextPage || loading || pending} variant="secondary" onPress={() => setPage(value => value + 1)}>{t.next}</Button></div>
        </div>
      </Card.Content>
    </Card>
    <Dialog isOpen={dialog === 'add'} onOpenChange={close} title={t.addMember} closeLabel={t.cancel}>
      <div className="organization-dialog-stack">{mutationError}<p className="muted-copy">{t.admissionHint}</p>
        <label>{t.searchAccounts}<input className="organization-input" type="search" maxLength={200} disabled={pending} value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} /></label>
        <p className="muted-copy" role="status">{candidateLoading ? t.refreshing : [...candidateQuery.trim()].length < 2 ? t.searchHint : !candidates.length && !candidateError ? t.noResults : ''}</p>
        {candidateError ? <p className="form-error" role="alert">{t.loadFailed}</p> : null}
        <ul className="organization-list">{candidates.map(candidate => <li key={candidate.account.accountUserId}><span>{candidate.account.displayName || candidate.account.email}<small>{candidate.account.email}</small></span><Button isDisabled={pending || candidate.state !== 'available'} size="sm" onPress={() => void run(['admit', candidate.account.accountUserId], key => operationsApi.admitManagedMember(unitId, candidate.account.accountUserId, key), () => { setCandidateQuery(''); setDialog(null) })}>{candidate.state === 'available' ? t.addMember : t.alreadyJoined}</Button></li>)}</ul>
      </div>
    </Dialog>
    <Dialog isOpen={dialog === 'child'} onOpenChange={close} title={t.createChild} closeLabel={t.cancel}>
      {mutationError}{dialog === 'child' ? <UnitForm kinds={childKinds} labels={t} pending={pending} onSubmit={(kind, name, email) => void run(['child', kind, name, email], key => operationsApi.createManagedChild(unitId, { kind, name, email: email || undefined }, key), () => setDialog(null))} /> : null}
    </Dialog>
    <Dialog isOpen={dialog === 'settings'} onOpenChange={close} title={t.settings} closeLabel={t.cancel}>
      <div className="organization-dialog-stack">{mutationError}
        {dialog === 'settings' ? <UnitForm labels={t} pending={pending} name={folder.unit.name} email={folder.unit.email} onSubmit={(_kind, name, email) => void run(['edit', folder.unit.version, name, email], key => operationsApi.updateManagedUnit(unitId, folder.unit.version, { name, email }, key))} /> : null}
        {folder.actions.manageResponsibilities ? <section className="organization-dialog-stack"><h3>{t.responsibilities}</h3>
          <label>{t.searchMembers}<input className="organization-input" type="search" value={responsibilityQuery} disabled={pending} maxLength={200} onChange={event => setResponsibilityQuery(event.target.value)} /></label>
          <p className="muted-copy">{t.searchHint}</p>
          {responsibilityError ? <p className="form-error" role="alert">{t.loadFailed}</p> : null}
          <ul className="organization-list">
            {responsibilityCandidates.filter(candidate => !responsibilities.some(value => value.memberId === candidate.memberId)).map(candidate => <li key={candidate.memberId}><span>{candidate.displayName}<small>{candidate.email}</small></span><Button size="sm" isDisabled={pending} onPress={() => void run(['assign', candidate.memberId], key => operationsApi.assignManagedResponsibility(unitId, candidate.memberId, key), () => setResponsibilityQuery(''))}>{t.assign}</Button></li>)}
            {responsibilities.map(value => <li key={value.id}><span>{value.displayName}<small>{value.email}</small></span><Button size="sm" variant="secondary" isDisabled={pending} onPress={() => void run(['revoke', value.id, value.version], key => operationsApi.revokeManagedResponsibility(unitId, value.id, value.version, key))}>{t.revoke}</Button></li>)}
          </ul>
        </section> : null}
        {folder.actions.archive ? <div className="organization-danger-zone"><Button variant="secondary" isDisabled={pending} onPress={() => setDialog('archive')}>{t.archive}</Button></div> : null}
      </div>
    </Dialog>
    <Dialog isOpen={dialog === 'archive'} onOpenChange={close} title={t.archive} closeLabel={t.cancel}>
      <div className="organization-dialog-stack">{mutationError}<p>{t.archiveConfirm}</p><div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={() => setDialog('settings')}>{t.cancel}</Button><Button isDisabled={pending} onPress={() => void run(['archive', folder.unit.version], key => operationsApi.setManagedUnitStatus(unitId, folder.unit.version, 'archive', key), () => setDialog(null))}>{t.archive}</Button></div></div>
    </Dialog>
    {dialog === 'notification' ? <OrganizationNotificationDialog isOpen unitId={unitId} onOpenChange={open => { if (!open) setDialog(null) }} /> : null}
  </section>
}

function UnitForm({ kinds, labels, pending, name: initialName = '', email: initialEmail = '', onSubmit }: {
  kinds?: readonly ('family' | 'small_group' | 'fellowship')[]; labels: Record<string, string>; pending: boolean; name?: string; email?: string
  onSubmit: (kind: 'family' | 'small_group' | 'fellowship', name: string, email: string) => void
}) {
  const [kind, setKind] = useState(kinds?.[0] ?? 'family')
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  return <form className="organization-dialog-stack" onSubmit={event => { event.preventDefault(); if (name.trim()) onSubmit(kind, name.trim(), email.trim()) }}>
    <fieldset disabled={pending} className="organization-dialog-stack">
      {kinds ? <label>{labels.kind}<select className="organization-input" value={kind} onChange={event => setKind(event.target.value as typeof kind)}>{kinds.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label> : null}
      <label>{labels.name}<input className="organization-input" required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>{labels.email}<input className="organization-input" type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <Button type="submit" isDisabled={pending || !name.trim()}>{labels.save}</Button>
    </fieldset>
  </form>
}
