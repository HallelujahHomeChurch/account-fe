import { Button, Card, Dialog, Skeleton, Switch } from '@hallelujahhomechurch/ui'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { OperationsApiError, type ManagedMemberView, type ManagedUnitFolder } from '../../lib/operations-api'
import { useManagedMutation, managedEntitlementCodes, managedEntitlementLabels } from './organization-state'

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
  const [loadError, setLoadError] = useState<'forbidden' | 'failed' | null>(null)
  const [revision, setRevision] = useState(0)
  const [refreshRequired, setRefreshRequired] = useState(false)
  const [endAffiliation, setEndAffiliation] = useState<Affiliation | null>(null)
  const { mutate, pending, error } = useManagedMutation()

  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)
    void Promise.all([
      operationsApi.getManagedMember(unitId, memberId, controller.signal),
      operationsApi.getManagedUnit(unitId, false, controller.signal),
    ]).then(([nextMember, nextFolder]) => {
      if (!controller.signal.aborted) { setMember(nextMember); setFolder(nextFolder); setRefreshRequired(false) }
    }).catch(reason => {
      if (!controller.signal.aborted) {
        setMember(null)
        setLoadError(reason instanceof OperationsApiError && reason.status === 403 ? 'forbidden' : 'failed')
      }
    })
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
    ? <section className="account-document"><Link to={'/organizations/' + unitId}>{t.back}</Link><p className="form-error" role="alert">{loadError === 'forbidden' ? t.memberForbidden : t.loadFailed}</p>{loadError !== 'forbidden' ? <Button onPress={() => setRevision(value => value + 1)}>{t.retry}</Button> : null}</section>
    : <Skeleton className="account-page-skeleton" label={t.loading} />

  const currentAffiliation = member.affiliations.find(affiliation => affiliation.orgUnitId === unitId)
  return <section className="account-document organization-page">
    <nav className="organization-breadcrumb" aria-label={t.title}><Link to="/organizations">{t.title}</Link><ChevronRight size={14} aria-hidden="true" /><Link to={'/organizations/' + unitId}>{folder.unit.name}</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{member.displayName || member.email}</span></nav>
    <div className="organization-heading"><div className="page-heading"><h1>{member.displayName || member.email}</h1><p>{member.email}</p></div>
      {member.actions.manageMembers && currentAffiliation ? <div className="organization-actions"><Button variant="secondary" isDisabled={pending || refreshRequired} onPress={() => void remove(currentAffiliation)}>{t.removeAffiliation}</Button></div> : null}
    </div>
    {!endAffiliation ? mutationError : null}
    {refreshRequired && !pending ? <><p className="form-error" role="alert">{t.loadFailed}</p><Button onPress={() => setRevision(value => value + 1)}>{t.retry}</Button></> : null}
    <Card className="panel-card organization-entitlement-card"><Card.Header><Card.Title>{t.entitlements}</Card.Title></Card.Header><Card.Content>
      <ul className="organization-list">{managedEntitlementCodes.map((code, index) => {
        const granted = member.entitlementCodes.includes(code)
        const grantable = member.grantableEntitlementCodes?.includes(code) ?? false
        return <li key={code}><Switch label={index === 3 ? t.video : managedEntitlementLabels[index]} isSelected={granted}
          isDisabled={pending || refreshRequired || !member.actions.manageEntitlements || (!granted && !grantable)}
          onChange={selected => void mutate(JSON.stringify(['entitlement', code, granted]), async key => {
            await operationsApi.applyManagedEntitlements(unitId, [memberId], code, selected ? 'grant' : 'revoke', key)
            setRefreshRequired(true)
            try {
              setMember(await operationsApi.getManagedMember(unitId, memberId))
              setRefreshRequired(false)
            } catch { setLoadError('failed') }
          })} /></li>
      })}</ul>
    </Card.Content></Card>
    <Dialog isOpen={Boolean(endAffiliation)} onOpenChange={open => { if (!open && !pending) setEndAffiliation(null) }} title={t.removeAffiliation} closeLabel={t.cancel}>
      <div className="organization-dialog-stack">{mutationError}<p>{t.endMembership}</p><div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={() => setEndAffiliation(null)}>{t.cancel}</Button><Button isDisabled={pending} onPress={() => { if (endAffiliation) void remove(endAffiliation, true) }}>{t.removeAffiliation}</Button></div></div>
    </Dialog>
  </section>
}
