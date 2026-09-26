import { Button, Card, Dialog, Skeleton } from '@hallelujahhomechurch/ui'
import { ChevronRight, Folder } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { OperationsApiError, type ManagedMemberView, type ManagedUnitFolder } from '../../lib/operations-api'
import { useManagedMutation, weeklyReportCodes, weeklyReportLabels } from './organization-state'

type Affiliation = ManagedMemberView['affiliations'][number]

export function OrganizationMemberPage() {
  const { unitId = '', memberId = '' } = useParams()
  return <MemberDetail key={unitId + ':' + memberId} unitId={unitId} memberId={memberId} />
}

function MemberDetail({ unitId, memberId }: { unitId: string; memberId: string }) {
  const { operationsApi } = useAuth()
  const { messages: { organizations: t } } = useLocale()
  const navigate = useNavigate()
  const [member, setMember] = useState<ManagedMemberView | null>(null)
  const [folder, setFolder] = useState<ManagedUnitFolder | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [endAffiliation, setEndAffiliation] = useState<Affiliation | null>(null)
  const [moveAffiliation, setMoveAffiliation] = useState<Affiliation | null>(null)
  const { mutate, pending, error } = useManagedMutation()

  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void Promise.all([
      operationsApi.getManagedMember(unitId, memberId, controller.signal),
      operationsApi.getManagedUnit(unitId, false, controller.signal),
    ]).then(([nextMember, nextFolder]) => {
      if (!controller.signal.aborted) { setMember(nextMember); setFolder(nextFolder) }
    }).catch(() => { if (!controller.signal.aborted) { setMember(null); setLoadError(true) } })
    return () => controller.abort()
  }, [memberId, operationsApi, revision, unitId])

  async function remove(affiliation: Affiliation, end = false) {
    let confirmationRequired = false
    const completed = await mutate(JSON.stringify(['remove', affiliation.id, affiliation.version, end]), async key => {
      try { await operationsApi.removeManagedAffiliation(unitId, memberId, affiliation.id, affiliation.version, end, key) }
      catch (reason) {
        if (!end && reason instanceof OperationsApiError && reason.code === 'last_binding_requires_membership_end') {
          confirmationRequired = true
          setEndAffiliation(affiliation)
        } else throw reason
      }
    })
    if (completed && !confirmationRequired) navigate('/organizations/' + unitId)
  }

  const errorText = error === 'forbidden' ? t.forbidden : error === 'conflict' ? t.conflict : t.requestFailed
  const mutationError = error ? <p className="form-error" role="alert">{errorText}</p> : null
  if (!member || !folder) return loadError
    ? <section className="account-document"><Link to={'/organizations/' + unitId}>{t.back}</Link><p className="form-error" role="alert">{t.loadFailed}</p><Button onPress={() => setRevision(value => value + 1)}>{t.retry}</Button></section>
    : <Skeleton className="account-page-skeleton" label={t.loading} />

  return <section className="account-document organization-page">
    <nav className="organization-breadcrumb" aria-label={t.title}><Link to="/organizations">{t.title}</Link><ChevronRight size={14} aria-hidden="true" /><Link to={'/organizations/' + unitId}>{folder.unit.name}</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{member.displayName || member.email}</span></nav>
    <div className="page-heading"><h1>{member.displayName || member.email}</h1><p>{member.email}</p></div>
    {!endAffiliation && !moveAffiliation ? mutationError : null}
    <Card className="panel-card"><Card.Header><Card.Title>{t.affiliations}</Card.Title></Card.Header><Card.Content>
      <ul className="organization-list">{member.affiliations.map(affiliation => <li key={affiliation.id}>
        <span className="organization-row-link"><Folder size={18} aria-hidden="true" /><span>{affiliation.name}<small>{t[affiliation.kind]}</small></span></span>
        {member.actions.manageMembers ? <div className="organization-actions">
          {folder.children.length || affiliation.orgUnitId !== unitId ? <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setMoveAffiliation(affiliation)}>{t.move}</Button> : null}
          <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => void remove(affiliation)}>{t.removeAffiliation}</Button>
        </div> : null}
      </li>)}</ul>
    </Card.Content></Card>
    <Card className="panel-card"><Card.Header><Card.Title>{t.entitlements}</Card.Title></Card.Header><Card.Content>
      <ul className="organization-list">{weeklyReportCodes.map((code, index) => {
        const granted = member.entitlementCodes.includes(code)
        return <li key={code}><span>{weeklyReportLabels[index]}<small>{t.entitlements}</small></span>
          {member.actions.manageEntitlements ? <Button size="sm" isDisabled={pending} variant={granted ? 'secondary' : 'primary'} onPress={async () => {
            if (await mutate(JSON.stringify(['entitlement', code, granted]), key => operationsApi.applyManagedEntitlements(unitId, [memberId], code, granted ? 'revoke' : 'grant', key))) setRevision(value => value + 1)
          }}>{granted ? t.remove : t.grant}</Button> : <span>{granted ? t.active : '—'}</span>}
        </li>
      })}</ul>
    </Card.Content></Card>
    <Dialog isOpen={Boolean(endAffiliation)} onOpenChange={open => { if (!open && !pending) setEndAffiliation(null) }} title={t.removeAffiliation} closeLabel={t.cancel}>
      <div className="organization-dialog-stack">{mutationError}<p>{t.endMembership}</p><div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={() => setEndAffiliation(null)}>{t.cancel}</Button><Button isDisabled={pending} onPress={() => { if (endAffiliation) void remove(endAffiliation, true) }}>{t.removeAffiliation}</Button></div></div>
    </Dialog>
    {moveAffiliation ? <MoveDialog root={folder} affiliation={moveAffiliation} pending={pending} error={mutationError} onClose={() => { if (!pending) setMoveAffiliation(null) }} onMove={async targetId => {
      if (await mutate(JSON.stringify(['move', moveAffiliation.id, moveAffiliation.version, targetId]), key => operationsApi.moveManagedAffiliation(unitId, memberId, moveAffiliation.id, targetId, moveAffiliation.version, key))) { setMoveAffiliation(null); setRevision(value => value + 1) }
    }} /> : null}
  </section>
}

function MoveDialog({ root, affiliation, pending, error, onClose, onMove }: {
  root: ManagedUnitFolder; affiliation: Affiliation; pending: boolean; error: React.ReactNode; onClose: () => void; onMove: (id: string) => Promise<void>
}) {
  const { operationsApi } = useAuth()
  const { messages: { organizations: t } } = useLocale()
  const [targetId, setTargetId] = useState(root.unit.id)
  const [target, setTarget] = useState<ManagedUnitFolder | null>(root)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setTarget(null); setFailed(false)
    void operationsApi.getManagedUnit(targetId, false, controller.signal)
      .then(value => { if (!controller.signal.aborted) setTarget(value) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [operationsApi, retry, targetId])
  return <Dialog isOpen onOpenChange={open => { if (!open) onClose() }} title={t.chooseTarget} closeLabel={t.cancel}>
    <div className="organization-dialog-stack">{error}
      {failed ? <><p className="form-error" role="alert">{t.loadFailed}</p><Button onPress={() => setRetry(value => value + 1)}>{t.retry}</Button></> : null}
      {target ? <>
        <nav className="organization-breadcrumb" aria-label={t.moveTarget}>
          {target.unit.id !== root.unit.id ? <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setTargetId(target.unit.parentId || root.unit.id)}>{t.back}</Button> : null}
          <strong>{target.unit.name}</strong>
        </nav>
        <ul className="organization-list">{target.children.filter(child => child.status === 'active').map(child => <li key={child.id}><span className="organization-row-link"><Folder size={18} aria-hidden="true" />{child.name}</span><Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setTargetId(child.id)}>{t.view}</Button></li>)}</ul>
        <Button isDisabled={pending || target.unit.id === affiliation.orgUnitId} onPress={() => void onMove(target.unit.id)}>{t.moveTarget} · {target.unit.name}</Button>
      </> : !failed ? <Skeleton label={t.loading} /> : null}
    </div>
  </Dialog>
}
