import { Button, Dialog } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'

import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import type { UnitNotificationPage, UnitNotificationPreview } from '../../lib/unit-notifications-api'
import { useManagedMutation } from './organization-state'

export function OrganizationNotificationDialog({ unitId, isOpen, onOpenChange }: { unitId: string; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { unitNotificationsApi } = useAuth()
  const { messages: { organizations: t }, locale } = useLocale()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState<UnitNotificationPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [history, setHistory] = useState<UnitNotificationPage | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [sent, setSent] = useState(false)
  const { mutate, pending, error } = useManagedMutation()
  const valid = Boolean(subject.trim() && body.trim()) && [...subject.trim()].length <= 120 && new TextEncoder().encode(body).length <= 20000

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setLoadError(false); setHistory(null)
    void unitNotificationsApi.list(unitId, page, 10, controller.signal)
      .then(value => { if (!controller.signal.aborted) setHistory(value) })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => controller.abort()
  }, [isOpen, page, revision, unitId, unitNotificationsApi])

  async function previewAudience() {
    setPreviewing(true); setLoadError(false); setSent(false)
    try { setPreview(await unitNotificationsApi.preview(unitId)) }
    catch { setPreview(null); setLoadError(true) }
    finally { setPreviewing(false) }
  }
  async function send() {
    if (!valid || !preview) return
    if (await mutate(JSON.stringify([unitId, subject.trim(), body]), key => unitNotificationsApi.submit(unitId, subject.trim(), body, key))) {
      setSubject(''); setBody(''); setPreview(null); setSent(true); setPage(1); setRevision(value => value + 1)
    }
  }
  const channelStatus = (status: string) => {
    if (['draft', 'scheduled', 'queued', 'paused'].includes(status)) return t.queued
    if (['processing', 'running', 'sending'].includes(status)) return t.processing
    if (status === 'completed') return t.completed
    return t.failed
  }

  return <Dialog isOpen={isOpen} onOpenChange={open => { if (!pending && !previewing) onOpenChange(open) }} title={t.notifications} closeLabel={t.cancel}>
    <div className="organization-dialog-stack">
      <p className="muted-copy">{t.notificationHint}</p>
      {loadError || error ? <p className="form-error" role="alert">{error === 'forbidden' ? t.forbidden : error === 'conflict' ? t.conflict : t.requestFailed}</p> : null}
      {sent ? <p className="organization-success" role="status">{t.sent}</p> : null}
      <fieldset disabled={pending || previewing} className="organization-dialog-stack">
        <label>{t.subject}<input className="organization-input" value={subject} onChange={event => { setSubject(event.target.value); setPreview(null); setSent(false) }} /></label>
        <label>{t.body}<textarea className="organization-input" rows={6} value={body} onChange={event => { setBody(event.target.value); setPreview(null); setSent(false) }} /></label>
        <p className="muted-copy">{t.subjectLimit}</p>
      </fieldset>
      {preview ? <section className="organization-confirmation">
        <p>{t.sendConfirm}</p>
        <dl className="organization-counts"><div><dt>{t.audience}</dt><dd>{preview.audienceAccounts}</dd></div><div><dt>{t.emailRecipients}</dt><dd>{preview.emailRecipients}</dd></div><div><dt>{t.webPushDevices}</dt><dd>{preview.webPushDevices}</dd></div></dl>
      </section> : null}
      <div className="organization-actions">
        <Button variant="secondary" isDisabled={!valid || pending || previewing} onPress={() => void previewAudience()}>{previewing ? t.refreshing : t.preview}</Button>
        <Button isDisabled={!preview || !valid || pending || previewing} onPress={() => void send()}>{pending ? t.sending : t.send}</Button>
      </div>
      <div className="organization-section-heading organization-danger-zone"><h3>{t.history}</h3><Button size="sm" variant="secondary" isDisabled={pending} onPress={() => setRevision(value => value + 1)}>{t.retry}</Button></div>
      <p className="muted-copy">{t.deliveryHint}</p>
      {!history && !loadError ? <p role="status">{t.refreshing}</p> : null}
      {history?.items.length === 0 ? <p className="muted-copy">{t.emptyHistory}</p> : null}
      <ul className="organization-history">{history?.items.map(item => <li key={item.id}>
        <details><summary><strong>{item.subject}</strong><small>{new Date(item.createdAt).toLocaleString(locale)} · {t.audience} {item.audienceAccountCount}</small></summary>
          <p className="organization-message-body">{item.body}</p>
          <ul className="organization-list">{item.channels.map(channel => <li key={channel.channel}><span>{channel.channel === 'email' ? t.emailRecipients : t.webPushDevices}</span><span>{channelStatus(channel.status)} · {channel.recipientCount}</span></li>)}</ul>
        </details>
      </li>)}</ul>
      {history && (page > 1 || history.total > history.perPage) ? <div className="organization-actions"><Button size="sm" variant="secondary" isDisabled={page === 1 || pending} onPress={() => setPage(value => value - 1)}>{t.previous}</Button><span>{page}</span><Button size="sm" variant="secondary" isDisabled={page * history.perPage >= history.total || pending} onPress={() => setPage(value => value + 1)}>{t.next}</Button></div> : null}
    </div>
  </Dialog>
}
