import { useNavigate, useSearchParams } from 'react-router-dom'
import { legalContinuation } from '../lib/legal-continuation'
import { Button } from '@hallelujahhomechurch/ui'
import type {
  LegalAcceptanceEvidence,
  LegalChallenge,
  LegalHistoryEntry,
  LegalStatus,
} from '@hallelujahhomechurch/account-client'
import { flushSync } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { LegalDocuments } from '../components/LegalDocuments'
import { LegalAcceptance } from '../components/LegalAcceptance'
import { useLocale } from '../i18n/locale-context'
import { legalReviewLabels } from '../i18n/legal-messages'

export function LegalReviewPage() {
  const { api, profile } = useAuth()
  const navigate = useNavigate()
  const [parameters] = useSearchParams()
  const continuation = legalContinuation(parameters.get('return_to'))
  const { locale, messages: t } = useLocale()
  const copy = legalReviewLabels[locale]
  const [status, setStatus] = useState<LegalStatus | null>(null)
  const [challenge, setChallenge] = useState<LegalChallenge | null>(null)
  const [history, setHistory] = useState<LegalAcceptanceEvidence[]>([])
  const [entry, setEntry] = useState<LegalHistoryEntry | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)
  const [revision, setRevision] = useState(0)
  const requestSequence = useRef(0)
  useEffect(() => {
    let active = true
    requestSequence.current++
    setStatus(null)
    setChallenge(null)
    setHistory([])
    setEntry(null)
    setAccepted(false)
    setError(false)
    if (!api.legal) {
      setError(true)
      return
    }
    const legal = api.legal
    Promise.all([legal.status(locale), legal.history()])
      .then(async ([next, records]) => {
        if (!active) return
        setStatus(next)
        setHistory(records)
        if (next.manifest) {
          const value = await legal.challenge(locale)
          if (active) setChallenge(value)
        }
      })
      .catch(() => {
        if (active) {
          setChallenge(null)
          setError(true)
        }
      })
    return () => {
      active = false
    }
  }, [api, profile?.id, locale, revision])
  useEffect(() => {
    const clear = () =>
      flushSync(() => {
        requestSequence.current++
        setChallenge(null)
        setHistory([])
        setEntry(null)
        setAccepted(false)
        setStatus(null)
      })
    const restore = () => setRevision((value) => value + 1)
    window.addEventListener('pagehide', clear)
    window.addEventListener('pageshow', restore)
    window.addEventListener('focus', restore)
    return () => {
      window.removeEventListener('pagehide', clear)
      window.removeEventListener('pageshow', restore)
      window.removeEventListener('focus', restore)
    }
  }, [])
  async function confirm() {
    if (!accepted || !challenge || !api.legal || pending) return
    setPending(true)
    setError(false)
    try {
      await api.legal.confirm(challenge.challenge, true)
      setRevision((value) => value + 1)
      if (continuation) {
        if (continuation.startsWith('/'))
          navigate(continuation, { replace: true })
        else window.location.replace(continuation)
      }
    } catch {
      setAccepted(false)
      setChallenge(null)
      setError(true)
    } finally {
      setPending(false)
    }
  }
  async function view(id: string) {
    const sequence = ++requestSequence.current
    setEntry(null)
    setError(false)
    try {
      const value = await api.legal?.historyEntry(id)
      if (value && sequence === requestSequence.current) setEntry(value)
    } catch {
      if (sequence === requestSequence.current) setError(true)
    }
  }
  return (
    <section className="account-document">
      <h1>
        {t.nav.privacy} / {t.nav.terms}
      </h1>
      {error ? (
        <div role="alert">
          <p>{t.legalAcceptance.loadFailed}</p>
          <Button onPress={() => setRevision((value) => value + 1)}>
            {t.legalAcceptance.retry}
          </Button>
        </div>
      ) : null}
      {!status && !error ? <p role="status">{t.profile.loading}</p> : null}
      {challenge ? <LegalDocuments snapshot={challenge.snapshot} /> : null}
      {status?.required && challenge ? (
        <>
          <LegalAcceptance checked={accepted} onChange={setAccepted} />
          <Button
            isDisabled={!accepted || pending}
            isPending={pending}
            onPress={confirm}
          >
            {t.policyAcceptance.continue}
          </Button>
        </>
      ) : null}
      {status?.manifest && !status.required ? (
        <p role="status">{copy.done}</p>
      ) : null}
      <h2>{copy.history}</h2>
      <ul>
        {history.map((record) => (
          <li key={record.id}>
            <time dateTime={record.accepted_at}>
              {new Date(record.accepted_at).toLocaleString(locale)}
            </time>{' '}
            <Button variant="secondary" onPress={() => view(record.id)}>
              {copy.view}
            </Button>
          </li>
        ))}
      </ul>
      {entry ? (
        entry.evidenceAvailable && entry.snapshot ? (
          <LegalDocuments snapshot={entry.snapshot} />
        ) : (
          <p>{copy.missing}</p>
        )
      ) : null}
    </section>
  )
}
