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
        if (active) setPreference(value)
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
    if (!auth.api.updateNewsletterPreference) return
    setIsSaving(true)
    try {
      const next = await auth.api.updateNewsletterPreference(subscribed)
      if (!alive.current) return
      setPreference(next)
      toast.add({ message: t.notificationSettings.updated, tone: 'success' })
    } catch {
      if (!alive.current) return
      toast.add({ message: t.notificationSettings.updateFailed, tone: 'danger' })
    } finally {
      if (alive.current) setIsSaving(false)
    }
  }

  const subscribed = preference?.status === 'subscribed' || preference?.status === 'pending'

  return (
    <div id="email-notifications" tabIndex={-1} aria-label={t.notificationSettings.emailTitle} className="settings-row newsletter-preference-row">
      {isLoading ? <Skeleton className="settings-list-skeleton" label={t.notificationSettings.loading} /> : error ? (
        <><p className="form-error" role="alert">{t.notificationSettings.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.notificationSettings.retry}</Button></>
      ) : <div className="newsletter-preference-control">
        <Switch
          className="settings-row-switch"
          description={t.notificationSettings.newsletterDescription}
          isDisabled={isSaving || !auth.api.updateNewsletterPreference}
          isSelected={subscribed}
          label={t.notificationSettings.emailTitle}
          onChange={(selected) => void update(selected)}
        />
        {preference?.status === 'pending' ? <span role="status" className="muted-copy">{t.notificationSettings.pending}</span> : null}
      </div>}
    </div>
  )
}
