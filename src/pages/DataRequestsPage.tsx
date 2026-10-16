import { Button, Card, FieldError, Form, Input, Label, Modal, OTP, REGEXP_ONLY_DIGITS, Select, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { correctionCatalog } from '../features/email-correction/catalog'
import { emailCorrectionMessages, type EmailCorrectionLocale } from '../features/email-correction/messages'
import '../features/email-correction/styles.css'

export type CorrectionView = 'loading' | 'form' | 'reauth' | 'mfa' | 'checking' | 'pending_verification' | 'link_expired' | 'pending_approval' | 'completed' | 'cancelled' | 'expired' | 'invalidated' | 'superseded' | 'unauthorized' | 'unverified' | 'no_reviewer' | 'load_error' | 'intent_expired'
export type CorrectionAction = 'next' | 'back' | 'password' | 'mfa' | 'provider' | 'resend' | 'replace' | 'cancel' | 'new' | 'retry' | 'profile' | 'signin' | 'verify_current' | 'current'
export type DataRequestsPageProps = {
  locale: EmailCorrectionLocale
  view: CorrectionView
  currentEmail: string
  newEmail: string
  expiresAt?: string
  enabled?: boolean
  eligible?: boolean
  passwordAvailable?: boolean
  providers?: string[]
  requiresMfa?: boolean
  replacing?: boolean
  busy?: boolean
  error?: 'unavailable' | 'conflict' | 'reauth' | 'email'
  notice?: 'queued'
  onEmailChange: (value: string) => void
  onAction: (action: CorrectionAction, value?: string) => void
}

export function DataRequestsPage({ locale, view, currentEmail, newEmail, expiresAt, enabled = true, eligible = true, passwordAvailable = true, providers = [], requiresMfa = false, replacing = false, busy = false, error, notice, onEmailChange, onAction }: DataRequestsPageProps) {
  const t = emailCorrectionMessages[locale]
  const [cancelOpen, setCancelOpen] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current !== view && ['form', 'reauth', 'mfa'].includes(view)) heading.current?.focus()
    previousView.current = view
  }, [view])
  const item = correctionCatalog[0]
  const fields = { currentEmail, newEmail }
  const editing = view === 'form' || view === 'intent_expired'
  const identity = view === 'reauth' || view === 'mfa'
  const pending = ['pending_verification', 'link_expired', 'pending_approval'].includes(view)
  const terminal = ['cancelled', 'expired', 'invalidated', 'superseded'].includes(view)
  const sameEmail = newEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()
  const errorText = error === 'unavailable' ? t.serviceError : error === 'conflict' ? t.conflict : error === 'reauth' ? t.reauthFailed : error === 'email' ? t.unavailableEmail : ''
  const title = view === 'link_expired' || view === 'pending_verification' ? t.pendingVerification : view === 'pending_approval' ? t.approvalStep : view === 'completed' ? t.completed : terminal ? t[view as 'cancelled' | 'expired' | 'invalidated' | 'superseded'] : t.emailChange

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || !eligible || busy) return
    if (editing) {
      setEmailError(sameEmail)
      if (sameEmail) {
        const form = event.currentTarget
        // Mouse press focus settles after submit; focus the rendered validation error next frame.
        requestAnimationFrame(() => form.querySelector<HTMLInputElement>('input[aria-invalid="true"]:not([readonly])')?.focus())
        return
      }
      onAction('next')
    } else {
      const data = new FormData(event.currentTarget)
      onAction(view === 'mfa' ? 'mfa' : 'password', String(data.get(view === 'mfa' ? 'code' : 'password') ?? ''))
    }
  }

  return <section className="account-document email-correction" aria-labelledby="correction-title">
    <div className="page-heading"><h1 id="correction-title" ref={heading} tabIndex={-1}>{identity ? t.identity : t.title}</h1><p>{identity ? t.identityHint : t.intro}</p></div>
    {!enabled ? <p className="form-notice" role="status">{t.paused}</p> : null}
    {errorText ? <div role="alert"><p className="form-error">{errorText}</p>{error === 'unavailable' || error === 'conflict' ? <Button variant="secondary" onPress={() => onAction('retry')}>{t.retry}</Button> : null}</div> : null}
    {notice ? <p className="form-notice" role="status">{t.queued}</p> : null}
    {view === 'loading' ? <Skeleton className="account-page-skeleton" label={t.loading} /> : null}
    {view === 'load_error' ? <div role="alert"><p className="form-error">{t.loadError}</p><Button onPress={() => onAction('retry')}>{t.retry}</Button></div> : null}
    {view === 'unauthorized' ? <Card className="panel-card settings-card"><Card.Content><p role="status">{t.unauthorized}</p><Button onPress={() => onAction('signin')}>{t.signIn}</Button></Card.Content></Card> : null}
    {view === 'unverified' || view === 'no_reviewer' ? <Card className="panel-card settings-card"><Card.Content><p role="status">{view === 'unverified' ? t.unverified : t.noReviewer}</p>{view === 'unverified' ? <Button onPress={() => onAction('verify_current')}>{t.verifyStep}</Button> : null}</Card.Content></Card> : null}
    {editing || identity ? <Card className="panel-card settings-card"><Card.Content>
      {view === 'intent_expired' ? <p className="form-error" role="alert">{t.intentExpired}</p> : null}
      {replacing ? <p className="form-notice">{t.replacementHint}</p> : null}
      <Form className="form-stack" onSubmit={submitForm}>
        {editing ? <>
          <Select label={t.item} selectedKey={item.kind} items={correctionCatalog.map(definition => ({ id: definition.kind, label: t[definition.labelKey] }))} />
          {item.fields.map(field => <TextField key={field.key} name={field.key} type={field.type} isReadOnly={field.readOnly} isRequired={field.required} value={fields[field.key]} onChange={field.readOnly ? undefined : value => { onEmailChange(value); if (emailError) setEmailError(false) }} isInvalid={!field.readOnly && (emailError || error === 'email')}>
            <Label>{t[field.labelKey]}</Label><Input dir="ltr" autoComplete={field.readOnly ? 'off' : 'email'} autoCapitalize="none" spellCheck={false} aria-describedby={field.readOnly ? undefined : 'correction-consequence'} />
            <FieldError>{emailError ? t.sameEmail : error === 'email' ? t.unavailableEmail : t.invalidEmail}</FieldError>
          </TextField>)}
          <p id="correction-consequence" className="muted">{t.signOutHint}</p>
          <Button type="submit" isDisabled={!enabled || !eligible} isPending={busy}>{t.next}</Button>
        </> : <>
          <dl className="correction-summary"><div><dt>{t.currentEmail}</dt><dd dir="ltr">{currentEmail}</dd></div><div><dt>{t.newEmail}</dt><dd dir="ltr">{newEmail}</dd></div></dl>
          <p>{t.signOutHint}</p>
          {view === 'mfa' ? <OTP label={t.mfa} name="code" maxLength={6} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" required /> : passwordAvailable ? <TextField name="password" type="password" isRequired><Label>{t.password}</Label><Input autoComplete="current-password" /><FieldError /></TextField> : null}
          {view === 'mfa' || passwordAvailable ? <Button type="submit" isPending={busy} isDisabled={!enabled || !eligible}>{view !== 'mfa' && requiresMfa ? t.continue : t.submit}</Button> : null}
          {view === 'reauth' ? providers.map(provider => <Button key={provider} variant="secondary" isDisabled={busy || !enabled || !eligible} onPress={() => onAction('provider', provider)}>{t.provider.replace('{provider}', provider)}</Button>) : null}
          <Button variant="ghost" isDisabled={busy} onPress={() => onAction('back')}>{t.back}</Button>
        </>}
      </Form>
    </Card.Content></Card> : null}
    {view === 'checking' ? <Card className="panel-card settings-card"><Card.Content><p role="status">{t.checking}</p><Skeleton label={t.checking} /></Card.Content></Card> : null}
    {pending || terminal || view === 'completed' ? <Card className="panel-card settings-card">
      <Card.Header><Card.Title>{title}</Card.Title></Card.Header><Card.Content className="correction-stack">
        {pending || view === 'completed' ? <ol className="correction-progress" aria-label={t.title}><li aria-current={view !== 'pending_approval' && view !== 'completed' ? 'step' : undefined}>{t.verifyStep}</li><li aria-current={view === 'pending_approval' ? 'step' : undefined}>{t.approvalStep}</li><li aria-current={view === 'completed' ? 'step' : undefined}>{t.completeStep}</li></ol> : null}
        {pending || view === 'completed' ? <dl className="correction-summary"><div><dt>{view === 'completed' ? t.currentEmail : t.newEmail}</dt><dd dir="ltr">{view === 'completed' ? currentEmail : newEmail}</dd></div>{pending && expiresAt ? <div><dt>{t.expires}</dt><dd><time dateTime={expiresAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'long' }).format(new Date(expiresAt))}</time></dd></div> : null}</dl> : null}
        <p role="status">{view === 'pending_verification' ? t.verifyHint : view === 'link_expired' ? t.linkExpired : view === 'pending_approval' ? t.approvalHint : view === 'completed' ? t.completedHint : view === 'superseded' ? t.superseded : t.unchanged}</p>
        <div className="correction-actions">
          {(view === 'pending_verification' || view === 'link_expired') && enabled ? <Button isPending={busy} onPress={() => onAction('resend')}>{t.resend}</Button> : null}
          {pending && enabled ? <Button variant="secondary" isDisabled={busy} onPress={() => onAction('replace')}>{t.replace}</Button> : null}
          {pending ? <Button variant="ghost" isDisabled={busy} onPress={() => setCancelOpen(true)}>{t.cancel}</Button> : null}
          {terminal && enabled ? <Button onPress={() => onAction(view === 'superseded' ? 'current' : 'new')}>{view === 'superseded' ? t.viewCurrent : t.newRequest}</Button> : null}
          {view === 'completed' ? <><Button onPress={() => onAction('profile')}>{t.profile}</Button>{enabled && eligible ? <Button variant="secondary" onPress={() => onAction('new')}>{t.newRequest}</Button> : null}</> : null}
        </div>
      </Card.Content>
    </Card> : null}
    <Modal isOpen={cancelOpen} onOpenChange={setCancelOpen}><Modal.Backdrop><Modal.Container><Modal.Dialog><Modal.Header><Modal.Heading>{t.cancelTitle}</Modal.Heading></Modal.Header><Modal.Body><p>{t.cancelHint}</p></Modal.Body><Modal.Footer><Button variant="secondary" onPress={() => setCancelOpen(false)}>{t.keep}</Button><Button variant="danger" isPending={busy} onPress={() => { setCancelOpen(false); onAction('cancel') }}>{t.cancel}</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
  </section>
}
