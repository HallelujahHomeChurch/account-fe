import type { createAccountDataRequestsClient, CorrectionCatalog, EmailCorrectionRequest, EmailReauthView, EmailCorrectionSubmitInput } from '@hallelujahhomechurch/account-client'
import type { CorrectionAction, DataRequestsPageProps } from '../../pages/DataRequestsPage'
export type CorrectionClient = ReturnType<typeof createAccountDataRequestsClient>
type State = Omit<DataRequestsPageProps, 'locale' | 'onEmailChange' | 'onAction'> & { catalog?: CorrectionCatalog }
type Failure = { status?: number; code?: string; retryAfter?: string | null }
export class CorrectionController {
  private state: State
  private listeners = new Set<() => void>()
  private request: EmailCorrectionRequest | null = null
  private intent: EmailReauthView | null = null
  private pending: EmailCorrectionSubmitInput | null = null
  private nonce: string | null = null
  private sequence = 0
  private timer?: ReturnType<typeof setTimeout>
  private retryAt = 0
  private active = true
  private operation = false
  private api: CorrectionClient
  private account: { eligible: boolean; currentEmail: string }
  private redirect: (url: string) => void
  constructor(api: CorrectionClient, account: { eligible: boolean; currentEmail: string }, redirect: (url: string) => void) {
    this.api = api; this.account = account; this.redirect = redirect
    this.state = { view: 'loading', currentEmail: account.currentEmail, newEmail: '', enabled: false, eligible: account.eligible }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private patch(value: Partial<State>) { if (this.active) { this.state = { ...this.state, ...value }; this.listeners.forEach(listener => listener()) } }
  dispose() { this.active = false; ++this.sequence; clearTimeout(this.timer); this.intent = null; this.pending = null; this.nonce = null }
  private clearIntent() { clearTimeout(this.timer); this.intent = null; this.pending = null }
  private fail(error: unknown) {
    const e = error as Failure
    if (e.status === 429) {
      const delay = Number(e.retryAfter)
      this.retryAt = Number.isFinite(delay) && e.retryAfter ? Date.now() + Math.max(0, delay) * 1000 : Math.max(Date.now() + 30000, Date.parse(e.retryAfter ?? '') || 0)
    }
    if (e.status === 401) { this.clearIntent(); this.nonce = null; this.request = null; this.patch({ view: 'unauthorized', newEmail: '', currentEmail: '', error: undefined }); return }
    if (e.code === 'ACC_REAUTH_EXPIRED') { if (!this.nonce) ++this.sequence; this.clearIntent(); this.patch({ view: this.nonce ? 'checking' : 'intent_expired', newEmail: '', error: this.nonce ? 'unavailable' : undefined }); return }
    if (e.code === 'ACC_CORRECTION_DISABLED') { this.clearIntent(); this.patch({ enabled: false, error: undefined }); if (this.request) this.accept(this.request); return }
    if (e.code === 'ACC_CORRECTION_TARGET_UNAVAILABLE' || e.code === 'ACC_CORRECTION_INVALID') { this.clearIntent(); this.nonce = null; this.patch({ view: 'form', error: 'email' }); return }
    if (e.code === 'ACC_CORRECTION_REVIEWER_UNAVAILABLE') { this.patch({ view: 'no_reviewer' }); return }
    this.patch({ error: e.code === 'ACC_REAUTH_FACTOR_INVALID' || e.code === 'ACC_REAUTH_MFA_REQUIRED' ? 'reauth' : e.code === 'ACC_CORRECTION_TARGET_UNAVAILABLE' || e.code === 'ACC_CORRECTION_INVALID' ? 'email' : e.status === 409 ? 'conflict' : 'unavailable', ...(this.state.view === 'loading' ? { view: 'load_error' as const } : {}) })
  }
  private accept(next: EmailCorrectionRequest) {
    if (this.request?.id === next.id && this.request.requestVersion > next.requestVersion) return
    this.request = next
    const linkExpired = next.status === 'pending_verification' && next.verificationExpiresAt && Date.parse(next.verificationExpiresAt) <= Date.parse(next.serverTime)
    this.patch({ view: linkExpired ? 'link_expired' : next.status, currentEmail: next.currentEmail ?? this.account.currentEmail, newEmail: next.newEmail ?? '', expiresAt: next.expiresAt, error: undefined, replacing: false, allowedActions: next.allowedActions })
  }
  private async acceptIntent(next: EmailReauthView) {
    if (!this.active) return
    if (this.intent?.intentId === next.intentId && this.intent.requestVersion > next.requestVersion) return
    this.intent = next
    clearTimeout(this.timer)
    const ttl = Date.parse(next.expiresAt) - Date.parse(next.serverTime)
    if (ttl <= 0) { this.fail({ code: 'ACC_REAUTH_EXPIRED' }); return }
    this.timer = setTimeout(() => this.fail({ code: 'ACC_REAUTH_EXPIRED' }), Math.min(ttl, 2147483647))
    this.patch({ currentEmail: next.currentEmail, newEmail: next.newEmail, view: next.status === 'mfa_required' ? 'mfa' : 'reauth', passwordAvailable: next.allowedActions.includes('password') && next.methods.includes('password'), providers: next.allowedActions.includes('oauth') ? next.methods.filter(method => method !== 'password') : [], requiresMfa: next.mfaRequired, error: next.errorCode === 'ACC_SERVICE_UNAVAILABLE' ? 'unavailable' : next.errorCode ? 'reauth' : undefined })
    if (next.status === 'disabled') { this.fail({ code: 'ACC_CORRECTION_DISABLED' }); return }
    if (next.status === 'ready' && next.allowedActions.includes('submit')) {
      this.pending = { kind: 'email_change', newEmail: next.newEmail, proof: next.proof, submissionNonce: next.submissionNonce }
      this.nonce = next.submissionNonce
      await this.submit()
    }
  }
  async load(intentId?: string) {
    this.active = true
    const seq = ++this.sequence
    this.operation = true; this.patch({ busy: true })
    try {
      const [capability, current] = await Promise.all([this.api.capability(), this.api.current()])
      if (seq !== this.sequence || !this.active) return
      const enabled = capability.dataRequests.emailCorrection.enabled
      this.patch({ enabled, error: undefined })
      if (current.request) this.accept(current.request)
      if (!enabled) { if (!current.request) this.redirect('/profile'); return }
      const catalog = await this.api.catalog()
      if (seq !== this.sequence || !this.active) return
      this.patch({ catalog, currentEmail: catalog.currentEmail, eligible: this.account.eligible && catalog.eligibility.status === 'eligible' && catalog.allowedActions.includes('reauth') })
      if (intentId && /^[A-Za-z0-9_-]{43}=$/.test(intentId)) { const restored = await this.api.restoreReauth(intentId); if (seq === this.sequence) await this.acceptIntent(restored); return }
      if (!current.request) this.patch({ view: this.state.eligible ? 'form' : catalog.eligibility.status === 'ineligible' && catalog.eligibility.errorCode === 'ACC_CORRECTION_EMAIL_UNVERIFIED' ? 'unverified' : 'no_reviewer' })
    } catch (error) { if (seq === this.sequence) this.fail(error) }
    finally { if (seq === this.sequence || this.state.view === 'intent_expired') { this.operation = false; this.patch({ busy: false }) } }
  }
  edit(value: string) { if (!this.intent && !this.operation) this.patch({ newEmail: value, error: undefined }) }
  async refresh() {
    if (this.operation || !this.active || this.state.view === 'unauthorized' || Date.now() < this.retryAt) return
    this.operation = true
    const seq = ++this.sequence
    try { const [current, capability] = await Promise.all([this.api.current(), this.api.capability()]); if (seq === this.sequence) { this.patch({ enabled: capability.dataRequests.emailCorrection.enabled }); if (current.request) this.accept(current.request) } }
    catch (error) { if (seq === this.sequence) this.fail(error) }
    finally { this.operation = false }
  }
  private async reconcile(resubmit: boolean) {
    if (!this.nonce) return
    this.patch({ view: 'checking' })
    try { this.accept(await this.api.submission(this.nonce)); this.clearIntent(); this.nonce = null; this.patch({ notice: 'queued' }) }
    catch (error) {
      if ((error as Failure).status === 404 && !this.pending) { this.nonce = null; this.patch({ view: 'intent_expired', newEmail: '', error: undefined }); return }
      if ((error as Failure).status === 404 && resubmit && this.pending) { await this.submit(); return }
      this.fail(error)
    }
  }
  private async submit() {
    if (!this.pending || !this.state.enabled) return
    this.patch({ view: 'checking' })
    try { this.accept(await this.api.submit(this.pending)); this.clearIntent(); this.nonce = null; this.patch({ notice: 'queued' }) }
    catch (error) {
      const e = error as Failure
      if (!e.status || e.status >= 500 || e.status === 409 && !['ACC_CORRECTION_TARGET_UNAVAILABLE', 'ACC_REAUTH_EXPIRED'].includes(e.code ?? '')) await this.reconcile(false)
      else this.fail(error)
    }
  }
  async action(action: CorrectionAction, value?: string) {
    if (this.operation || !this.active || Date.now() < this.retryAt) return
    if (action === 'profile' || action === 'verify_current' || action === 'signin') { this.clearIntent(); this.redirect(action === 'profile' ? '/profile' : action === 'verify_current' ? '/verify-email' : '/login?return_to=%2Fdata-requests&email_correction=1'); return }
    if (action === 'current') { if (this.request) this.accept(this.request); else await this.load(); return }
    if (action === 'retry') {
      if (!this.nonce && !this.intent) { await this.load(); return }
      this.operation = true; this.patch({ busy: true })
      const seq = ++this.sequence
      try { if (this.nonce) await this.reconcile(true); else if (this.intent) { const next = await this.api.restoreReauth(this.intent.intentId); if (seq === this.sequence) await this.acceptIntent(next) } }
      catch (error) { if (seq === this.sequence) this.fail(error) }
      finally { this.operation = false; this.patch({ busy: false }) }
      return
    }
    if (action !== 'cancel' && action !== 'back' && (!this.state.enabled || !this.state.eligible)) return
    this.operation = true; const seq = ++this.sequence; this.patch({ busy: true, error: undefined, notice: undefined })
    try {
      if (action === 'replace' || action === 'new') { this.clearIntent(); this.patch({ view: 'form', newEmail: '', replacing: action === 'replace' }) }
      if (action === 'next') { const next = await this.api.createReauth({ kind: 'email_change', newEmail: this.state.newEmail }); if (seq === this.sequence) await this.acceptIntent(next) }
      if (action === 'back') { if (this.intent) await this.api.cancelReauth(this.intent.intentId); this.clearIntent(); this.patch({ view: 'form' }) }
      if (action === 'password' && this.intent?.allowedActions.includes('password')) { const next = await this.api.password(this.intent.intentId, { password: value ?? '' }); if (seq === this.sequence) await this.acceptIntent(next) }
      if (action === 'mfa' && this.intent?.allowedActions.includes('mfa')) { const next = await this.api.mfa(this.intent.intentId, { code: value ?? '' }); if (seq === this.sequence) await this.acceptIntent(next) }
      if (action === 'provider' && this.intent?.allowedActions.includes('oauth') && (value === 'google' || value === 'line' || value === 'microsoft')) {
        const next = await this.api.oauth(this.intent.intentId, { provider: value })
        if (seq !== this.sequence) return
        const url = new URL(next.authorizationUrl)
        const hosts = { google: 'accounts.google.com', line: 'access.line.me', microsoft: 'login.microsoftonline.com' }
        if (url.protocol !== 'https:' || url.hostname !== hosts[value] || url.port || url.username || url.password) throw new Error('Invalid authorization destination')
        this.redirect(url.href)
      }
      if (action === 'cancel' && this.request?.allowedActions.includes('cancel')) this.accept(await this.api.cancel(this.request.id, { requestVersion: this.request.requestVersion }))
      if (action === 'resend' && this.request?.allowedActions.includes('resend_verification')) { this.accept(await this.api.resendVerification(this.request.id, { requestVersion: this.request.requestVersion })); this.patch({ notice: 'queued' }) }
    } catch (error) { if (seq === this.sequence) this.fail(error) }
    finally { this.operation = false; this.patch({ busy: false }) }
  }
}
