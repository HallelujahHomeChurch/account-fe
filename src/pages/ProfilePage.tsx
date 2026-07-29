import { Button, Card, Form, Input, Label, Modal, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/auth-context'
import { ProfileAvatarEditor } from '../components/ProfileAvatarEditor'
import { LanguageSelector } from '../components/LanguageSelector'
import { ThemeSelector } from '../components/ThemeSelector'
import { useLocale } from '../i18n/locale-context'
import { displayAccountName } from '../lib/account-display'
import { ApiError } from '../lib/api'

export function ProfilePage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [isNameDialogOpen, setNameDialogOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const profile = auth.profile

  useEffect(() => {
    if (!profile && auth.accessToken && !auth.isBootstrapping) {
      auth.refreshProfile().catch((caught: unknown) => setError(errorMessage(caught)))
    }
  }, [auth, profile])

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.updateProfile || !profile) return

    const form = new FormData(event.currentTarget)
    setError('')
    setMessage('')

    try {
      await auth.api.updateProfile({
        first_name: String(form.get('first_name') ?? ''),
        last_name: String(form.get('last_name') ?? ''),
      })
      await auth.refreshProfile()
      setMessage(t.profile.updated)
      setNameDialogOpen(false)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  if (auth.isBootstrapping || !profile) return <p className="inline-status">{t.profile.loading}</p>

  const name = displayAccountName(profile, t.profile.fallbackName)

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.personalInfo}</h1>
      </div>

      {message ? <p className="form-notice">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.profile.personalDetails}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          <div className="settings-row profile-avatar-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.profile.avatar}</span>
              <ProfileAvatarEditor profile={profile} />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.profile.name}</span>
              <strong>{name}</strong>
            </div>
            <Button variant="secondary" onPress={() => setNameDialogOpen(true)}>
              {t.profile.editName}
            </Button>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.profile.email}</span>
              <strong>{profile.email}</strong>
            </div>
            <span className="status-pill">
              {profile.is_email_verified ? t.profile.emailVerified : t.profile.emailNotVerified}
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.profile.language}</span>
            </div>
            <LanguageSelector />
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.profile.appearance}</span>
            </div>
            <ThemeSelector />
          </div>
        </Card.Content>
      </Card>

      <Modal isOpen={isNameDialogOpen} onOpenChange={setNameDialogOpen}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>{t.profile.editName}</Modal.Heading>
              </Modal.Header>
              <Form key={profile.id} onSubmit={submitName}>
                <Modal.Body className="modal-form-grid">
                  <TextField defaultValue={profile.first_name ?? ''} name="first_name">
                    <Label>{t.profile.firstName}</Label>
                    <Input autoComplete="given-name" />
                  </TextField>
                  <TextField defaultValue={profile.last_name ?? ''} name="last_name">
                    <Label>{t.profile.lastName}</Label>
                    <Input autoComplete="family-name" />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => setNameDialogOpen(false)}>
                    {t.profile.cancel}
                  </Button>
                  <Button type="submit">{t.profile.saveChanges}</Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  )
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
