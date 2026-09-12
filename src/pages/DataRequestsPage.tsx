import { Button, Card, Form, Input, Label, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, ShieldOff, UserRoundX } from 'lucide-react'

import { useAuth } from '../auth/auth-context'
import { loginPath } from '../auth/auth-routes'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type DSRRequest, type DSRRequestType } from '../lib/api'

const owners = ['account', 'engagement', 'notification', 'asset', 'website_manual'] as const

export function DataRequestsPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<DSRRequest[] | null>(null)
  const [erasure, setErasure] = useState<DSRRequest | null>(null)
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
  }, [auth.api, t.dataRequests.loadFailed])

  function handleError(caught: unknown) {
    if (caught instanceof ApiError && caught.code === 'ACC_DSR_REAUTH_REQUIRED') {
      navigate(loginPath('/data-requests'))
      return
    }
    setError(t.dataRequests.requestFailed)
  }

  function reconcile(next: DSRRequest) {
    setRequests((current) => current?.map((item) => item.id === next.id ? next : item) ?? [next])
    if (erasure?.id === next.id) {
      if (next.request_type === 'erasure' && next.status === 'submitted') setErasure(next)
      else resetErasure(null)
    }
  }

  async function create(type: DSRRequestType) {
    if (!auth.api.createDSRRequest) return
    setBusy(true); setError('')
    try {
      const next = await auth.api.createDSRRequest(type)
      setRequests((current) => [next, ...(current ?? [])])
      if (type === 'erasure') resetErasure(next)
    } catch (caught) { handleError(caught) } finally { setBusy(false) }
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
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <section aria-labelledby="dsr-new-request" className="dsr-request-operations">
      <h2 id="dsr-new-request">{t.dataRequests.newRequest}</h2>
      <div className="dsr-operation-grid">
        <article className="dsr-operation-card"><Download aria-hidden="true" /><div><h3>{t.dataRequests.requestExport}</h3><p>{t.dataRequests.exportDescription}</p></div><Button isPending={busy} onPress={() => void create('access_export')}>{t.dataRequests.requestExport}</Button></article>
        <article className="dsr-operation-card"><ShieldOff aria-hidden="true" /><div><h3>{t.dataRequests.restrictProcessing}</h3><p>{t.dataRequests.restrictDescription}</p></div><Button isPending={busy} variant="secondary" onPress={() => void create('restrict_processing')}>{t.dataRequests.restrictProcessing}</Button></article>
        <article className="dsr-operation-card is-danger"><UserRoundX aria-hidden="true" /><div><h3>{t.dataRequests.startErasure}</h3><p>{t.dataRequests.erasureDescription}</p></div><Button isPending={busy} variant="danger" onPress={() => void create('erasure')}>{t.dataRequests.startErasure}</Button></article>
      </div>
    </section>
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
          {request.status === 'action_required' ? <p className="form-notice">{t.dataRequests.actionRequired}</p> : null}
          {request.executions?.length ? <ol className="dsr-owner-progress" aria-label={t.dataRequests.ownerProgress}>
            {owners.flatMap((owner) => { const execution = request.executions?.find((item) => item.owner === owner); return execution ? [<li key={owner}><span>{t.dataRequests.owners[owner]}</span><strong>{t.dataRequests.executionStatuses[execution.status]}</strong></li>] : [] })}
          </ol> : null}
          <div className="dsr-request-actions">
            {request.request_type === 'access_export' && request.status === 'completed' ? <Button isPending={busy} onPress={() => void download(request)}>{t.dataRequests.download}</Button> : null}
            {['submitted', 'in_review'].includes(request.status) ? <Button isPending={busy} variant="ghost" onPress={() => void cancel(request)}>{t.dataRequests.cancel}</Button> : null}
          </div>
        </Card.Content>
      </Card>)}
    </div></section>
  </section>
}
