import { Button, Card, Form, Input, Label, TextField } from '@heroui/react'
import { Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError } from '../lib/api'

export function ProfilePage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const profile = auth.profile

  useEffect(() => {
    if (!profile && auth.accessToken && !auth.isBootstrapping) {
      auth.refreshProfile().catch((caught: unknown) => setError(errorMessage(caught)))
    }
  }, [auth, profile])

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.updateProfile) return

    const form = new FormData(event.currentTarget)
    setError('')
    setMessage('')

    try {
      await auth.api.updateProfile({
        first_name: String(form.get('first_name') ?? ''),
        last_name: String(form.get('last_name') ?? ''),
        avatar_url: String(form.get('avatar_url') ?? ''),
      })
      await auth.refreshProfile()
      setMessage(t.profile.updated)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (auth.isBootstrapping) return <p className="inline-status">Loading account...</p>

  if (!profile) {
    return (
    <section className="document-shell">
      <div className="page-heading">
        <h1>Profile</h1>
        <p>{t.profile.signInPrompt}</p>
        <Link className="button-link" to="/login">
          {t.nav.signIn}
        </Link>
      </div>
    </section>
    )
  }

  return (
    <section className="account-document">
      <div className="page-heading">
        <p className="eyebrow">{t.profile.eyebrow}</p>
        <h1>{displayName(profile.first_name, profile.last_name, t.profile.fallbackName)}</h1>
        <p>{profile.email}</p>
      </div>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>{t.profile.personalDetails}</Card.Title>
          <Card.Description>{t.profile.personalDetailsDescription}</Card.Description>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form key={profile.id} className="form-grid" onSubmit={submitProfile}>
            <TextField defaultValue={profile.first_name ?? ''} name="first_name">
              <Label>{t.profile.firstName}</Label>
              <Input />
            </TextField>
            <TextField defaultValue={profile.last_name ?? ''} name="last_name">
              <Label>{t.profile.lastName}</Label>
              <Input />
            </TextField>
            <TextField className="span-2" defaultValue={profile.avatar_url ?? ''} name="avatar_url" type="url">
              <Label>{t.profile.avatarUrl}</Label>
              <Input />
            </TextField>
            <Button className="span-2" type="submit">
              <Save size={17} />
              {t.profile.saveChanges}
            </Button>
          </Form>
        </Card.Content>
      </Card>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>{t.profile.accountState}</Card.Title>
        </Card.Header>
        <Card.Content className="fact-list">
          <p>
            <span>{t.profile.emailVerified}</span>
            <strong>{profile.is_email_verified ? t.profile.yes : t.profile.no}</strong>
          </p>
          <p>
            <span>{t.profile.active}</span>
            <strong>{profile.is_active === false ? t.profile.no : t.profile.yes}</strong>
          </p>
          <p>
            <span>{t.profile.roles}</span>
            <strong>{profile.roles?.join(', ') || t.profile.none}</strong>
          </p>
        </Card.Content>
      </Card>
    </section>
  )
}

function displayName(firstName: string | undefined, lastName: string | undefined, fallback: string) {
  return [firstName, lastName].filter(Boolean).join(' ') || fallback
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
