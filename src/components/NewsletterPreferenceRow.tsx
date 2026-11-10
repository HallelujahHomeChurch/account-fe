import { Button, Skeleton, Switch, useToast } from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { NewsletterPreference } from '../lib/api'

export function NewsletterPreferenceRow() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const toast = useToast()
  const [preference, setPreference] = useState<NewsletterPreference | null>(null)
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)

  const [revision, setRevision] = useState(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(false)
    const load = async () => {
      try {
        const value = await auth.api.getNewsletterPreference?.() ?? { status: 'not_subscribed' as const }
        if (active) { setPreference(value); setUncertain(false) }
      } catch {
        if (active) { setPreference(null); setError(true) }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [auth.api, revision])

  async function update(subscribed: boolean) {
    if (isSaving || uncertain || !auth.api.updateNewsletterPreference) return
    setIsSaving(true)
    try {
      const next = await auth.api.updateNewsletterPreference(subscribed)
      if (!alive.current) return
      setPreference(next)
      if (!next.handoffState || next.handoffState === 'completed') {
        toast.add({ message: t.notificationSettings.updated, tone: 'success' })
      }
    } catch {
      if (!alive.current) return
      setUncertain(true)
      toast.add({ message: t.notificationSettings.updateFailed, tone: 'danger' })
    } finally {
      if (alive.current) setIsSaving(false)
    }
  }

  const subscribed = preference?.status === 'subscribed' || preference?.status === 'pending'
  const handoff = preference?.handoffState
  const renewal = handoff === 'needs-renewal' || handoff === 'superseded'
  const handoffMessage = uncertain ? t.notificationSettings.updateUnknown : handoff === 'pending' ? t.notificationSettings.handoffPending : handoff === 'needs-renewal' ? t.notificationSettings.needsRenewal : handoff === 'superseded' ? t.notificationSettings.superseded : undefined

  return (
    <div id="email-notifications" tabIndex={-1} aria-label={t.notificationSettings.emailTitle} className="settings-row newsletter-preference-row">
      {isLoading ? <Skeleton className="settings-list-skeleton" label={t.notificationSettings.loading} /> : error ? (
        <><p className="form-error" role="alert">{t.notificationSettings.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.notificationSettings.retry}</Button></>
      ) : <div className="newsletter-preference-control">
        <Switch
          className="settings-row-switch"
          description={t.notificationSettings.newsletterDescription}
          isDisabled={isSaving || uncertain || !auth.api.updateNewsletterPreference}
          isSelected={subscribed}
          label={t.notificationSettings.emailTitle}
          onChange={(selected) => void update(selected)}
        />
        {handoffMessage ? <p role="status" className="muted-copy">{handoffMessage}</p> : preference?.status === 'pending' ? <span role="status" className="muted-copy">{t.notificationSettings.pending}</span> : null}
        {handoff === 'pending' && !subscribed ? <Button variant="secondary" isDisabled={isSaving || uncertain || !auth.api.updateNewsletterPreference} onPress={() => void update(false)}>{t.notificationSettings.unsubscribe}</Button> : null}
        {(handoff === 'pending' || uncertain) ? <Button variant="secondary" isDisabled={isSaving} onPress={() => setRevision(value => value + 1)}>{t.notificationSettings.checkStatus}</Button> : null}
        {renewal && preference?.status !== 'subscribed' ? <Button variant="secondary" isDisabled={isSaving || uncertain || !auth.api.updateNewsletterPreference} onPress={() => void update(true)}>{t.notificationSettings.renewConsent}</Button> : null}
      </div>}
    </div>
  )
}
