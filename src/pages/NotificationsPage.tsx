import { Card, Skeleton, useToast } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import type { NewsletterPreference } from '../lib/api'

export function NotificationsPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const toast = useToast()
  const [preference, setPreference] = useState<NewsletterPreference | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!auth.api.getNewsletterPreference) {
      setPreference({ status: 'not_subscribed' })
      return
    }
    auth.api.getNewsletterPreference()
      .then(setPreference)
      .catch(() => setError(t.notificationSettings.loadFailed))
  }, [auth.api, t.notificationSettings.loadFailed])

  async function update(subscribed: boolean) {
    if (!auth.api.updateNewsletterPreference) return
    setIsSaving(true)
    setError('')
    try {
      const next = await auth.api.updateNewsletterPreference(subscribed)
      setPreference(next)
      toast.add({ message: t.notificationSettings.updated, tone: 'success' })
    } catch {
      setError(t.notificationSettings.updateFailed)
    } finally {
      setIsSaving(false)
    }
  }

  if (!preference && !error) {
    return <Skeleton className="account-page-skeleton" label={t.notificationSettings.loading} />
  }

  const subscribed = preference?.status === 'subscribed'

  return (
    <section className="account-document">
      <div className="page-heading"><h1>{t.nav.notificationSettings}</h1></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Card className="panel-card settings-card">
        <Card.Header><Card.Title>{t.notificationSettings.emailTitle}</Card.Title></Card.Header>
        <Card.Content className="settings-list">
          <div className="settings-row">
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
          </div>
        </Card.Content>
      </Card>
    </section>
  )
}
