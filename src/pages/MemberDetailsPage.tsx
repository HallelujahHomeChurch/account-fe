import { DirtyNavigationGuard } from '../components/DirtyNavigationGuard'
import { isSupportedCountry } from 'libphonenumber-js/min'
import { Button, Card, Form, Input, Label, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, UNSAFE_DataRouterContext } from 'react-router-dom'
import { MobileNumberField } from '../components/MobileNumberField'
import { normalizeMobile } from '../lib/mobile-number'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { memberDetailsMessages } from '../i18n/member-details'
import { isMemberCsrfFailure, isMemberDetails, MemberDetailsClient, MemberDetailsError, type MemberDetails } from '../lib/member-details'

const empty: MemberDetails = { familyName: null, givenName: null, gender: null, identityDocument: null, mobile: null }

export function MemberDetailsPage() {
 const auth = useAuth()
 const { locale } = useLocale()
 const t = memberDetailsMessages[locale]
 const dataRouter = useContext(UNSAFE_DataRouterContext)
 const [dirty, setDirty] = useState(false)
 const owner = auth.profile?.id
 const client = useMemo(() => owner && auth.api.memberTransportFetch ? new MemberDetailsClient((path, init) => auth.api.memberTransportFetch!(path, init), owner) : null, [owner, auth.api])
 const [details, setDetails] = useState<MemberDetails | null>(null)
 const [etag, setEtag] = useState<string | null>(null)
 const [state, setState] = useState<'loading' | 'ready' | 'busy' | 'recover' | 'failed' | 'denied'>('loading')
 const [error, setError] = useState<keyof typeof t | ''>('')
 const [notice, setNotice] = useState<keyof typeof t | ''>('')
 const request = useRef<AbortController | null>(null)
 const [revision, setRevision] = useState(0)

 useEffect(() => {
  if (!dirty) return
  const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
  window.addEventListener('beforeunload', leave)
  return () => window.removeEventListener('beforeunload', leave)
 }, [dirty])
 function reload() { if (!dirty || window.confirm(t.leave)) { setDirty(false); setRevision(value => value + 1) } }
 const fail = useCallback((caught: unknown, preserveDraft = false) => {
  if (caught instanceof MemberDetailsError && caught.status === 403 && !isMemberCsrfFailure(caught.code)) { setDetails(null); setEtag(null); setDirty(false); setState('denied'); return }
  if (preserveDraft && !(caught instanceof MemberDetailsError && caught.status === 401)) {
    setState(caught instanceof MemberDetailsError && (caught.uncertain || [409, 412].includes(caught.status)) ? 'recover' : 'ready')
  } else { setDetails(null); setEtag(null); setDirty(false); setState('failed') }
  setError(caught instanceof MemberDetailsError && caught.uncertain ? 'uncertain' : caught instanceof MemberDetailsError && [409, 412].includes(caught.status) ? 'conflict' : 'failed')
 }, [])

 useEffect(() => {
  const controller = new AbortController(); request.current = controller
  setDetails(null); setEtag(null); setState('loading'); setError('')
  if (!client) { setState('failed'); setError('failed'); return () => controller.abort() }
  client.load(controller.signal).then(result => {
   if (!controller.signal.aborted) { setDetails(result.details ?? empty); setEtag(result.etag); setState('ready') }
  }).catch(caught => { if (!controller.signal.aborted) fail(caught) })
  return () => { controller.abort(); request.current?.abort(); request.current = null }
 }, [client, revision, fail])

 useEffect(() => {
  let active = true
  const controller = new AbortController()
  const check = () => {
   if (document.visibilityState === 'hidden') return
   auth.operationsApi.getMyAccess(controller.signal).then(access => {
    if (active && access.memberDetailsEligible !== true) { request.current?.abort(); setDetails(null); setEtag(null); setDirty(false); setState('denied') }
   }).catch(() => { if (active && !controller.signal.aborted) { request.current?.abort(); setState(current => current === 'loading' || current === 'failed' ? 'failed' : 'recover'); setError('failed') } })
  }
  window.addEventListener('focus', check); document.addEventListener('visibilitychange', check)
  return () => { active = false; controller.abort(); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
 }, [auth.operationsApi])

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (!client || state !== 'ready') return
  const form = new FormData(event.currentTarget)
  const value = (name: string) => String(form.get(name) ?? '').trim() || null
  const country = String(form.get('mobileCountry') ?? '')
  if (!isSupportedCountry(country)) { setError('invalid'); return }
  const input = { familyName: value('familyName'), givenName: value('givenName'), gender: value('gender'), identityDocument: value('identityDocument')?.toUpperCase() ?? null, mobile: normalizeMobile(String(form.get('mobile') ?? ''), country) }
  if (!isMemberDetails(input)) { setError('invalid'); return }
  request.current?.abort(); const controller = new AbortController(); request.current = controller
  setState('busy'); setError(''); setNotice('')
  try {
   const version = await client.save(input, etag, controller.signal)
   if (!controller.signal.aborted) { setDetails(input); setEtag(version); setDirty(false); setState('ready'); setNotice('saved') }
  } catch (caught) { if (!controller.signal.aborted) fail(caught, true) }
 }
 async function remove() {
  if (!client || !etag || state !== 'ready' || !window.confirm(t.confirm)) return
  request.current?.abort(); const controller = new AbortController(); request.current = controller
  setState('busy'); setError(''); setNotice('')
  try {
   await client.remove(etag, controller.signal)
   if (!controller.signal.aborted) { setDetails(empty); setEtag(null); setDirty(false); setState('ready'); setNotice('deleted'); setRevision(value => value + 1) }
  } catch (caught) { if (!controller.signal.aborted) fail(caught, true) }
 }
 if (state === 'denied') return <Navigate replace to="/profile" />
 return <section className="account-document" data-sentry-block data-sentry-mask>
  {dataRouter ? <DirtyNavigationGuard dirty={dirty} message={t.leave} /> : null}
  <div className="page-heading"><h1>{t.title}</h1></div>
  <Link to="/profile">{t.back}</Link>
  {notice ? <p className="form-notice" role="status">{t[notice]}</p> : null}
  {error ? <p className="form-error" role="alert">{t[error]}</p> : null}
  {state === 'recover' ? <Button onPress={reload}>{t.retry}</Button> : null}
  {state === 'loading' ? <Skeleton className="account-page-skeleton" label={t.loading} /> : state === 'failed' ? <Button onPress={reload}>{t.retry}</Button> : details ? <Card className="panel-card settings-card">
   <Card.Header><Card.Title>{t.title}</Card.Title></Card.Header>
   <Card.Content><Form key={etag ?? "empty"} onSubmit={submit} autoComplete="off">
    <fieldset onChange={() => setDirty(true)} disabled={state !== 'ready'} className="member-details-fields">
     <legend className="sr-only">{t.title}</legend>
     {(['familyName', 'givenName', 'gender', 'identityDocument'] as const).map(field => field === 'gender' ? <label key={field} className="member-gender-field">{t.gender}<select name="gender" defaultValue={details.gender ?? ''}>
      <option value="">{t.unspecified}</option>
      {(['male', 'female', 'other', 'prefer_not_to_say'] as const).map(gender => <option key={gender} value={gender}>{t[gender]}</option>)}
     </select></label> : <TextField key={field} name={field} type="text" defaultValue={details[field] ?? ''} autoComplete="off">
      <Label>{t[field]}</Label><Input />
     </TextField>)}
     <MobileNumberField mobile={details.mobile} isDisabled={state !== 'ready'} onDirty={() => setDirty(true)} />
    </fieldset>
    <div className="member-details-actions"><Button type="submit" isDisabled={state !== 'ready'}>{t.save}</Button><Button variant="ghost" isDisabled={!etag || state !== 'ready'} onPress={() => void remove()}>{t.remove}</Button></div>
   </Form></Card.Content>
  </Card> : null}
 </section>
}
