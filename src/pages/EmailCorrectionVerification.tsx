import { Button } from '@hallelujahhomechurch/ui'
import { LanguageSelector } from '../components/LanguageSelector'
import { emailCorrectionMessages, type EmailCorrectionLocale } from '../features/email-correction/messages'
import '../features/email-correction/styles.css'

export type VerificationView = 'ready' | 'verifying' | 'verified' | 'already_verified' | 'missing_token' | 'expired' | 'used' | 'cancelled' | 'superseded' | 'invalidated' | 'invalid' | 'unavailable' | 'disabled'

// Token capture and transport belong to the route controller, outside this view.
export function EmailCorrectionVerification({ locale, view, onVerify, onReturn }: { locale: EmailCorrectionLocale; view: VerificationView; onVerify: () => void; onReturn: () => void }) {
  const t = emailCorrectionMessages[locale]
  const success = view === 'verified' || view === 'already_verified'
  const ready = view === 'ready' || view === 'verifying' || view === 'unavailable'
  return <section className="login-shell email-correction" aria-labelledby="email-correction-verification-title">
    <div className="login-card"><div className="login-copy"><img className="login-brand-mark" src="/assets/brand/logo.png" alt="" /><h1 id="email-correction-verification-title">{t.publicTitle}</h1></div>
      <div className="login-form-panel auth-result-state correction-stack">
        <p>{t.publicHint}</p>
        {success ? <p role="status">{t.publicSuccess}</p> : null}
        {!ready && !success ? <p role="alert" className="form-error">{view === 'missing_token' ? t.missingToken : view === 'disabled' ? t.paused : t.invalidToken}</p> : null}
        {view === 'unavailable' ? <p role="alert" className="form-error">{t.serviceError}</p> : null}
        {ready ? <Button isPending={view === 'verifying'} onPress={onVerify}>{t.confirmVerify}</Button> : null}
        <Button variant="secondary" onPress={onReturn}>{t.accountSite}</Button>
      </div>
    </div><div className="login-footer"><LanguageSelector /></div>
  </section>
}
