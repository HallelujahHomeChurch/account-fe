import { Button, Card, Skeleton, useToast } from '@hallelujahhomechurch/ui'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { NewsletterPreference } from '../lib/api'

export function NotificationsPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const toast = useToast()
  const [preference, setPreference] = useState<NewsletterPreference | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadPreference = useCallback(async () => {
    setIsLoading(true)
    setError('')
    if (!auth.api.getNewsletterPreference) {
      setPreference({ status: 'not_subscribed' })
      setIsLoading(false)
      return
    }
    try {
      setPreference(await auth.api.getNewsletterPreference())
    } catch {
      setPreference(null)
      setError(t.notificationSettings.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [auth.api, t.notificationSettings.loadFailed])

  useEffect(() => {
    void loadPreference()
  }, [loadPreference])

  async function update(subscribed: boolean) {
    if (!auth.api.updateNewsletterPreference) return
    setIsSaving(true)
    try {
      const next = await auth.api.updateNewsletterPreference(subscribed)
      setPreference(next)
      toast.add({ message: t.notificationSettings.updated, tone: 'success' })
    } catch {
      toast.add({ message: t.notificationSettings.updateFailed, tone: 'danger' })
    } finally {
      setIsSaving(false)
    }
  }

  const subscribed = preference?.status === 'subscribed'

  return (
    <section className="account-document">
      <div className="page-heading"><h1>{t.nav.notificationSettings}</h1></div>
      <Card className="panel-card settings-card">
        <Card.Header><Card.Title>{t.notificationSettings.emailTitle}</Card.Title></Card.Header>
        <Card.Content className="settings-list">
          {isLoading ? <Skeleton className="settings-list-skeleton" label={t.notificationSettings.loading} /> : error ? (
            <div className="settings-row">
              <p className="form-error" role="alert">{error}</p>
              <Button variant="secondary" onPress={() => void loadPreference()}>{t.notificationSettings.retry}</Button>
            </div>
          ) : <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.notificationSettings.newsletter}</span>
              <span className="muted-copy">{t.notificationSettings.newsletterDescription}</span>
            </div>
            <label className="preference-switch">
              <input
                aria-label={t.notificationSettings.newsletter}
                checked={subscribed}
                disabled={isSaving}
                role="switch"
                type="checkbox"
                onChange={(event) => void update(event.currentTarget.checked)}
              />
              <span aria-hidden="true" />
            </label>
          </div>}
        </Card.Content>
      </Card>
    </section>
  )
}
