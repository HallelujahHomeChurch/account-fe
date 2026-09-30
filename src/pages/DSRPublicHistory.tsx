import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { dsrDetails } from '../i18n/dsr-details'
import { ApiError, type DSRRequest } from '../lib/api'

export function DSRPublicHistory({ request, onRefresh }: { request: DSRRequest; onRefresh: () => void }) {
  const { api } = useAuth()
  const { locale } = useLocale()
  const text = dsrDetails[locale]
  const [older, setOlder] = useState<NonNullable<DSRRequest['public_history']>>([])
  const [cursor, setCursor] = useState(request.public_history_next_cursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function load() {
    if (!cursor || !api.listDSRPublicHistory || loading || stale) return
    setLoading(true)
    setError('')
    try {
      const page = await api.listDSRPublicHistory(request.id, request.version, cursor)
      if (!active.current) return
      if (page.case_version !== request.version) { setStale(true); setError(text.conflict); return }
      setOlder((current) => [...page.events, ...current])
      setCursor(page.next_cursor)
    } catch (caught) {
      if (!active.current) return
      const changed = caught instanceof ApiError && (caught.status === 409 || caught.status === 404)
      setStale(changed)
      setError(changed ? text.conflict : text.historyLoadFailed)
    } finally { if (active.current) setLoading(false) }
  }

  const events = [...older, ...(request.public_history ?? [])]
  if (!events.length) return null
  return <details className="dsr-public-history"><summary>{text.publicHistory}</summary>
    <ol>{events.map((event, index) => <li key={`${event.case_version}:${index}`}>
      <p><strong>{event.public_supplement ? text.reply : text.question}</strong> · <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale)}</time></p>
      {event.public_message ? <p>{event.public_message}</p> : null}
      {event.public_supplement ? <><p>{event.public_supplement.description}</p><p>{text.current}: {event.public_supplement.current_value}</p><p>{text.requested}: {event.public_supplement.requested_value}</p></> : null}
    </li>)}</ol>
    {error ? <p role="alert">{error}</p> : null}
    {stale ? <Button onPress={onRefresh}>{text.refresh}</Button> : cursor && api.listDSRPublicHistory ? <Button onPress={() => void load()} isDisabled={loading}>{loading ? text.historyLoading : text.loadEarlier}</Button> : request.public_history_has_more && !request.public_history_next_cursor ? <p>{text.earlierHistory}</p> : null}
  </details>
}
