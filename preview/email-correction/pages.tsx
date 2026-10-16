import { createContext, useContext, useState, type ReactNode } from 'react'
import { Button, Select } from '@hallelujahhomechurch/ui'
import { DataRequestsPage, type CorrectionAction, type CorrectionView } from '../../src/pages/DataRequestsPage'
import { EmailCorrectionVerification, type VerificationView } from '../../src/pages/EmailCorrectionVerification'
import { useLocale } from '../../src/i18n/locale-context'
import { locales } from '../../src/i18n/locales'

const states = ['form', 'reauth', 'oauth_only', 'mfa', 'reauth_failed', 'intent_expired', 'checking', 'pending_verification', 'link_expired', 'pending_approval', 'completed', 'cancelled', 'expired', 'invalidated', 'superseded', 'unauthorized', 'unavailable', 'conflict', 'unverified', 'no_reviewer', 'load_error', 'loading', 'replacement_failed'] as const
const verifyStates: VerificationView[] = ['ready', 'verifying', 'verified', 'already_verified', 'missing_token', 'expired', 'used', 'cancelled', 'superseded', 'invalidated', 'invalid', 'unavailable', 'disabled']
const params = new URLSearchParams(location.search)
const publicPreview = params.get('surface') === 'verify'
const initial = params.get('state') ?? (publicPreview ? 'ready' : 'form')
const PreviewContext = createContext<{
  state: string; setState: (state: string) => void; long: boolean; enabled: boolean; busy: boolean
}>({ state: initial, setState: () => {}, long: false, enabled: true, busy: false })

export function PreviewFixtureProvider({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useLocale()
  const [state, setState] = useState(initial)
  const [long, setLong] = useState(params.get('long') === '1')
  const [enabled, setEnabled] = useState(params.get('disabled') !== '1')
  const [busy, setBusy] = useState(false)
  return <PreviewContext value={{ state, setState, long, enabled, busy }}>
    <aside className="fixture-controls" aria-label="Fixture preview controls">
      <strong>Local fixtures · {publicPreview ? 'Public verification' : 'Account'}</strong>
      <Select label="State" selectedKey={state} items={(publicPreview ? verifyStates : states).map(id => ({ id, label: id }))} onSelectionChange={setState} />
      <Select label="Locale" selectedKey={locale} items={locales.map(id => ({ id, label: id }))} onSelectionChange={value => setLocale(value as typeof locale)} />
      <Select label="Theme" defaultSelectedKey={params.get('theme') ?? 'light'} items={['light', 'dark'].map(id => ({ id, label: id }))} onSelectionChange={theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme }} />
      <Button variant="secondary" onPress={() => setLong(!long)}>Long content: {long ? 'on' : 'off'}</Button>
      <Button variant="secondary" onPress={() => setEnabled(!enabled)}>Enabled: {enabled ? 'on' : 'off'}</Button>
      <Button variant="secondary" onPress={() => setBusy(!busy)}>Busy: {busy ? 'on' : 'off'}</Button>
      <a href={`/__email-correction-preview?surface=${publicPreview ? 'account' : 'verify'}&locale=${locale}`}>{publicPreview ? 'Account form' : 'Public verification'}</a>
    </aside>{children}
  </PreviewContext>
}

export function ProfilePage() {
  const { locale } = useLocale()
  const { state, setState, long, enabled, busy } = useContext(PreviewContext)
  const [email, setEmail] = useState('grace.new@example.test')
  const [replacing, setReplacing] = useState(false)
  const [notice, setNotice] = useState<'queued' | undefined>()
  const current = long ? 'grace.very-long.current-account-address+church-office@example-with-a-very-long-subdomain.example.test' : 'grace.current@example.test'
  const target = long ? 'grace.very-long.corrected-account-address+church-office@example-with-a-very-long-subdomain.example.test' : email
  const view = state === 'unavailable' || state === 'conflict' ? 'pending_approval' : state === 'reauth_failed' || state === 'oauth_only' || state === 'replacement_failed' ? 'reauth' : state as CorrectionView
  function action(action: CorrectionAction) {
    setNotice(undefined)
    if (action === 'next') setState('reauth')
    else if (action === 'back') setState('form')
    else if (action === 'password' || action === 'provider') setState('mfa')
    else if (action === 'mfa') { setState('pending_verification'); setReplacing(false) }
    else if (action === 'resend') { setNotice('queued'); setState('pending_verification') }
    else if (action === 'replace' || action === 'new') { setReplacing(action === 'replace'); setState('form') }
    else if (action === 'cancel') setState('cancelled')
    else if (action === 'current') setState('pending_approval')
    else if (action === 'retry') setState('pending_approval')
    else if (action === 'signin') setState('completed')
    else if (action === 'profile') setState('form')
  }
  return <DataRequestsPage locale={locale} view={view} currentEmail={view === 'completed' ? target : current} newEmail={view === 'intent_expired' ? '' : target} expiresAt="2026-10-23T08:30:00Z" enabled={enabled} eligible={!['unverified', 'no_reviewer'].includes(state)} passwordAvailable={state !== 'oauth_only'} providers={['Google', 'LINE', 'Microsoft']} requiresMfa replacing={replacing || state === 'replacement_failed'} busy={busy} error={state === 'unavailable' ? 'unavailable' : state === 'conflict' ? 'conflict' : state === 'reauth_failed' || state === 'replacement_failed' ? 'reauth' : undefined} notice={notice} onEmailChange={value => { setEmail(value); if (state === 'intent_expired') setState('form') }} onAction={action} />
}
export function VerifyEmailPage() {
  const { locale } = useLocale()
  const { state, setState } = useContext(PreviewContext)
  return <EmailCorrectionVerification locale={locale} view={state as VerificationView} onVerify={() => setState('verified')} onReturn={() => { location.href = '/__email-correction-preview' }} />
}
