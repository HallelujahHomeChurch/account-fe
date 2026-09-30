import { Button, Card, Form, Input, Label, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Pencil, ShieldOff, UserRoundX } from 'lucide-react'

import { useAuth } from '../auth/auth-context'
import { loginPath } from '../auth/auth-routes'
import { useLocale } from '../i18n/locale-context'
import { dsrDetails } from '../i18n/dsr-details'
import { ApiError, type DSRRequest, type DSRRequestType, type DSRScopeTarget, type DSRCreateDetails } from '../lib/api'

const owners = ['account', 'operations', 'engagement', 'notification', 'asset', 'website_manual', 'website_watermark'] as const
type Details = { description: string; current_value: string; requested_value: string }

export function DataRequestsPage() {
  const auth = useAuth()
  const { locale, messages: t } = useLocale()
  const detailsText = dsrDetails[locale]
  const ownerLabels = { ...t.dataRequests.owners, operations: detailsText.operations, website_watermark: detailsText.watermark }
  const navigate = useNavigate()
  const [requests, setRequests] = useState<DSRRequest[] | null>(null)
  const [erasure, setErasure] = useState<DSRRequest | null>(null)
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState('')
  const [showRestriction, setShowRestriction] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [now, setNow] = useState(Date.now)

  function resetErasure(next: DSRRequest | null) {
    setErasure(next)
    setEmail('')
    setConfirmed(false)
  }

  useEffect(() => {
    let active = true
    auth.api.listDSRRequests?.().then((value) => {
      if (active) {
        setRequests(value)
        resetErasure(value.find((request) => request.request_type === 'erasure' && request.status === 'submitted') ?? null)
      }
    }).catch(() => {
      if (active) { setRequests([]); setError(t.dataRequests.loadFailed) }
    })
    return () => { active = false }
  }, [auth.api, t.dataRequests.loadFailed, refreshRevision])

  const hasPending = requests?.some((request) => ['submitted', 'in_review', 'processing', 'action_required'].includes(request.status)) === true
  useEffect(() => {
    if (!hasPending || busy || !auth.api.listDSRRequests) return
    let active = true
    let pending = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => { if (active && document.visibilityState === 'visible') timer = setTimeout(() => void refresh(), 30_000) }
    async function refresh() {
      if (!active || pending || document.visibilityState !== 'visible') return
      pending = true
      try {
        const value = await auth.api.listDSRRequests!()
        if (active) {
          setRequests(value)
          setErasure((current) => current ? value.find((request) => request.id === current.id && request.status === 'submitted') ?? null : null)
        }
      } catch { if (active) setError(t.dataRequests.loadFailed) }
      finally { pending = false; schedule() }
    }
    const visibilityChanged = () => { clearTimeout(timer); if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', visibilityChanged)
    schedule()
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visibilityChanged) }
  }, [auth.api, hasPending, busy, t.dataRequests.loadFailed])

  useEffect(() => {
    const deadlines = requests?.flatMap((request) => request.export_expires_at && Date.parse(request.export_expires_at) > now ? [Date.parse(request.export_expires_at)] : []) ?? []
    if (!deadlines.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, Math.min(...deadlines) - Date.now() + 1)))
    return () => clearTimeout(timer)
  }, [requests, now])

  function handleError(caught: unknown) {
    if (caught instanceof ApiError && caught.code === 'ACC_DSR_REAUTH_REQUIRED') {
      navigate(loginPath('/data-requests'))
      return
    }
    setError(caught instanceof ApiError && caught.status === 409 ? detailsText.conflict : t.dataRequests.requestFailed)
  }

  function reconcile(next: DSRRequest) {
    setRequests((current) => current?.map((item) => item.id === next.id ? next : item) ?? [next])
    if (erasure?.id === next.id) {
      if (next.request_type === 'erasure' && next.status === 'submitted') setErasure(next)
      else resetErasure(null)
    }
  }

  async function create(type: DSRRequestType, details?: DSRCreateDetails) {
    if (!auth.api.createDSRRequest) return
    setBusy(true); setError('')
    try {
      const input = details ?? (scope.trim() ? { description: scope.trim() } : undefined)
      const next = input ? await auth.api.createDSRRequest(type, input) : await auth.api.createDSRRequest(type)
      setShowCorrection(false)
      setShowRestriction(false)
      setScope('')
      setRequests((current) => [next, ...(current ?? [])])
      if (type === 'erasure') resetErasure(next)
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  async function supplement(request: DSRRequest, details: Details, version: number) {
    if (!auth.api.supplementDSRRequest) return
    setBusy(true); setError('')
    try { reconcile(await auth.api.supplementDSRRequest(request.id, { version, ...details })) }
    catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  async function confirmErasure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!erasure || !auth.api.confirmDSRErasure) return
    setBusy(true); setError('')
    try {
      const next = await auth.api.confirmDSRErasure(erasure.id, erasure.version, email.trim())
      reconcile(next)
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  async function cancel(request: DSRRequest) {
    if (!auth.api.cancelDSRRequest) return
    setBusy(true); setError('')
    try {
      const next = await auth.api.cancelDSRRequest(request.id, request.version)
      reconcile(next)
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  async function download(request: DSRRequest) {
    if (!auth.api.issueDSRDownload || !auth.api.redeemDSRDownload) return
    setBusy(true); setError('')
    try {
      const { download_url } = await auth.api.issueDSRDownload(request.id)
      const blob = await auth.api.redeemDSRDownload(download_url)
      const url = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url; anchor.download = 'account-data.zip'; anchor.click()
      } finally { URL.revokeObjectURL(url) }
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
  }

  if (requests === null) return <Skeleton className="account-page-skeleton" label={t.dataRequests.loading} />

  const emailMatches = email.trim() === auth.profile?.email
  return <section className="account-document">
    <div className="page-heading"><h1>{t.dataRequests.title}</h1><p>{t.dataRequests.description}</p></div>
    {error ? <div><p className="form-error" role="alert">{error}</p><Button isPending={busy} variant="secondary" onPress={() => { setError(''); setRefreshRevision((value) => value + 1) }}>{detailsText.refresh}</Button></div> : null}
    <section aria-labelledby="dsr-new-request" className="dsr-request-operations">
      <h2 id="dsr-new-request">{t.dataRequests.newRequest}</h2>
      <TextField name="request_scope" value={scope} onChange={setScope}><Label>{detailsText.scope}</Label><Input maxLength={4000} /></TextField>
      <div className="dsr-operation-grid">
        <article className="dsr-operation-card"><Download aria-hidden="true" /><div><h3>{t.dataRequests.requestExport}</h3><p>{t.dataRequests.exportDescription}</p></div><Button isPending={busy} onPress={() => void create('access_export')}>{t.dataRequests.requestExport}</Button></article>
        <article className="dsr-operation-card"><ShieldOff aria-hidden="true" /><div><h3>{t.dataRequests.restrictProcessing}</h3><p>{t.dataRequests.restrictDescription}</p></div><Button isPending={busy} variant="secondary" onPress={() => setShowRestriction(true)}>{t.dataRequests.restrictProcessing}</Button></article>
        <article className="dsr-operation-card"><Pencil aria-hidden="true" /><div><h3>{detailsText.correction}</h3><p>{detailsText.correctionHint}</p></div><Button isPending={busy} variant="secondary" onPress={() => setShowCorrection(true)}>{detailsText.correction}</Button></article>
        <article className="dsr-operation-card is-danger"><UserRoundX aria-hidden="true" /><div><h3>{t.dataRequests.startErasure}</h3><p>{t.dataRequests.erasureDescription}</p></div><Button isPending={busy} variant="danger" onPress={() => void create('erasure')}>{t.dataRequests.startErasure}</Button></article>
      </div>
    </section>
    {showRestriction ? <Card className="panel-card"><Card.Header><Card.Title>{t.dataRequests.restrictProcessing}</Card.Title></Card.Header><Card.Content><RestrictionScopeForm busy={busy} onSubmit={(targets) => create('restrict_processing', { ...(scope.trim() ? { description: scope.trim() } : {}), scope_targets: targets, scope_confirmed: true })} /></Card.Content></Card> : null}
    {showCorrection ? <Card className="panel-card"><Card.Header><Card.Title>{detailsText.correction}</Card.Title></Card.Header><Card.Content><RequestDetailsForm correction busy={busy} onSubmit={(details) => create('correction', details)} /></Card.Content></Card> : null}
    {erasure ? <Card className="panel-card"><Card.Header><Card.Title>{t.dataRequests.confirmErasureTitle}</Card.Title></Card.Header>
      <Card.Content><Form className="form-stack" onSubmit={confirmErasure}>
        <TextField isRequired name="confirmation_email" value={email} onChange={setEmail}><Label>{t.dataRequests.currentEmail}</Label><Input autoComplete="email" /></TextField>
        <label className="auth-consent"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span><strong>{t.dataRequests.erasureAcknowledgement}</strong></span></label>
        <Button isDisabled={!emailMatches || !confirmed} isPending={busy} type="submit" variant="danger">{t.dataRequests.confirmErasure}</Button>
      </Form></Card.Content>
    </Card> : null}
    <section aria-labelledby="dsr-request-history" className="dsr-request-history"><h2 id="dsr-request-history">{t.dataRequests.requestHistory}</h2><div aria-live="polite" className="dsr-request-list">
      {requests.length === 0 ? <p className="dsr-empty-state">{t.dataRequests.noRequests}</p> : null}
      {requests.map((request) => <Card className="panel-card" key={request.id}>
        <Card.Header><Card.Title>{t.dataRequests.types[request.request_type]}</Card.Title><span className="status-pill">{t.dataRequests.statuses[request.status]}</span></Card.Header>
        <Card.Content>
          <p>{detailsText.submitted}: <time dateTime={request.submitted_at}>{new Date(request.submitted_at).toLocaleString(locale)}</time></p>
          {request.scope_targets?.map((target) => <p key={target}>{detailsText.restrictions[target] ?? `${detailsText.scope}: ${target}`}</p>)}
          {request.description ? <p>{request.description}</p> : null}
          {request.current_value ? <p>{detailsText.current}: {request.current_value}</p> : null}
          {request.requested_value ? <p>{detailsText.requested}: {request.requested_value}</p> : null}
          {canConfirmLegacyRestriction(request) ? <RestrictionScopeForm key={request.id} request={request} busy={busy} onSubmit={async (targets, version) => { if (!auth.api.supplementDSRRequest) return; setBusy(true); setError(''); try { reconcile(await auth.api.supplementDSRRequest(request.id, { version, description: request.description || request.information_requested || detailsText.scope, current_value: '', requested_value: '', scope_targets: targets, scope_confirmed: true })) } catch (caught) { handleError(caught) } finally { setBusy(false) } }} /> : null}
          {request.information_requested && !canConfirmLegacyRestriction(request) && !['completed', 'rejected', 'cancelled'].includes(request.status) ? <section aria-label={detailsText.additional}><p className="form-notice">{request.information_requested}</p><RequestDetailsForm key={request.id} request={request} correction={request.request_type === 'correction'} busy={busy} onSubmit={(details, version) => supplement(request, details, version ?? request.version)} /></section> : null}
          {request.status === 'action_required' ? <p className="form-notice">{t.dataRequests.actionRequired}</p> : null}
          {request.executions?.length ? <ol className="dsr-owner-progress" aria-label={t.dataRequests.ownerProgress}>
            {owners.flatMap((owner) => { const execution = request.executions?.find((item) => item.owner === owner); return execution ? [<li key={owner}><span>{ownerLabels[owner]}</span><strong>{t.dataRequests.executionStatuses[execution.status]}</strong></li>] : [] })}
          </ol> : null}
          {request.executions?.filter((execution) => execution.result_summary.public_response).map((execution) => <p key={execution.owner}><strong>{ownerLabels[execution.owner]}: </strong><span>{execution.result_summary.public_response}</span></p>)}
          {request.export_expires_at ? <p>{detailsText.deadline}: <time dateTime={request.export_expires_at}>{new Date(request.export_expires_at).toLocaleString(locale)}</time></p> : null}
          {request.request_type === 'access_export' && request.status === 'completed' && exportUnavailable(request, now) ? <p className="form-notice">{detailsText.expired}</p> : null}
          <div className="dsr-request-actions">
            {request.request_type === 'access_export' && request.status === 'completed' ? <Button isDisabled={exportUnavailable(request, now)} isPending={busy} onPress={() => void download(request)}>{t.dataRequests.download}</Button> : null}
            {request.request_type === 'access_export' && request.status === 'completed' && exportUnavailable(request, now) ? <Button isPending={busy} onPress={() => void create('access_export', { description: request.description })}>{detailsText.requestAgain}</Button> : null}
            {['submitted', 'in_review'].includes(request.status) ? <Button isPending={busy} variant="ghost" onPress={() => void cancel(request)}>{t.dataRequests.cancel}</Button> : null}
          </div>
        </Card.Content>
      </Card>)}
    </div></section>
  </section>
}

function RequestDetailsForm({ request, correction, busy, onSubmit }: { request?: DSRRequest; correction: boolean; busy: boolean; onSubmit: (details: Details, version?: number) => Promise<void> }) {
  const { locale } = useLocale()
  const text = dsrDetails[locale]
  const [version, setVersion] = useState(request?.version)
  const [description, setDescription] = useState(request?.description ?? '')
  const [current, setCurrent] = useState(request?.current_value ?? '')
  const [requested, setRequested] = useState(request?.requested_value ?? '')
  const valid = Boolean(description.trim() && (!correction || (current.trim() && requested.trim())))
  return <Form className="form-stack dsr-details-form" onSubmit={(event) => {
    event.preventDefault()
    if (valid && !busy) void onSubmit({ description: description.trim(), current_value: current.trim(), requested_value: requested.trim() }, version)
  }}>
    <label className="hhc-field">{request ? text.additional : text.location}<textarea required maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    {correction ? <>
      <label className="hhc-field">{text.current}<textarea required maxLength={4000} rows={3} value={current} onChange={(event) => setCurrent(event.target.value)} /></label>
      <label className="hhc-field">{text.requested}<textarea required maxLength={4000} rows={3} value={requested} onChange={(event) => setRequested(event.target.value)} /></label>
    </> : null}
    {request && version !== request.version ? <div><p className="form-notice">{text.conflict}</p><Button variant="secondary" onPress={() => setVersion(request.version)}>{text.refresh}</Button></div> : null}
    <Button type="submit" isDisabled={!valid} isPending={busy}>{request ? text.sendAdditional : text.submitCorrection}</Button>
  </Form>
}

function exportUnavailable(request: DSRRequest, now: number) {
  return !request.export_expires_at || Date.parse(request.export_expires_at) <= now
}

function RestrictionScopeForm({request,busy,onSubmit}:{request?:DSRRequest;busy:boolean;onSubmit:(targets:DSRScopeTarget[],version:number)=>Promise<void>}) {
 const {locale,messages:t}=useLocale()
 const text=dsrDetails[locale]
 const [targets,setTargets]=useState<DSRScopeTarget[]>([])
 const [confirmed,setConfirmed]=useState(false)
 const [version,setVersion]=useState(request?.version ?? 0)
 return <Form className="form-stack" onSubmit={(event)=>{event.preventDefault();if(targets.length && confirmed) void onSubmit(targets,version)}}><fieldset><legend>{t.dataRequests.restrictProcessing}</legend>{(Object.keys(text.restrictions) as DSRScopeTarget[]).map((target)=><label className="auth-consent" key={target}><input type="checkbox" checked={targets.includes(target)} onChange={(event)=>{setConfirmed(false);setTargets((current)=>event.target.checked?[...current,target]:current.filter(value=>value!==target))}}/><span>{text.restrictions[target]}</span></label>)}</fieldset><label className="auth-consent"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/><span>{text.restrictAcknowledgement}</span></label><>{request && version!==request.version ? <div><p role="status">{text.conflict}</p><Button variant="secondary" onPress={()=>{setTargets([]);setConfirmed(false);setVersion(request.version)}}>{text.refresh}</Button></div>:null}</><Button type="submit" isPending={busy} isDisabled={!targets.length||!confirmed||(request && version!==request.version)}>{text.restrictConfirm}</Button></Form>
}

function canConfirmLegacyRestriction(request: DSRRequest) {
 return request.request_type === 'restrict_processing' && request.plan_version !== 1 && Boolean(request.information_requested) && !['completed','rejected','cancelled'].includes(request.status) && request.executions?.every(execution => (execution.attempt_count === 0 && !execution.started_at && ['pending','manual'].includes(execution.status)) || (execution.attempt_count === 1 && execution.status === 'failed' && execution.last_error_code === 'DSR_SCOPE_CONFIRMATION_REQUIRED' && execution.result_summary.reason_codes?.length === 1 && execution.result_summary.reason_codes[0] === 'DSR_SCOPE_CONFIRMATION_REQUIRED')) === true
}
