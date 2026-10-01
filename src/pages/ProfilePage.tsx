import { markProfileSaved } from '../lib/analytics-events'
import { Button, Card, FieldError, Form, Input, Label, Modal, Skeleton, TextField } from '@hallelujahhomechurch/ui'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { memberDetailsMessages } from '../i18n/member-details'

import { useAuth } from '../auth/auth-context'
import { ProfileAvatarEditor } from '../components/ProfileAvatarEditor'
import { LanguageSelector } from '../components/LanguageSelector'
import { ThemeSelector } from '../components/ThemeSelector'
import { useLocale } from '../i18n/locale-context'
import { useAuthCapabilitiesState } from '../components/SocialAuthOptions'
import { authErrorMessage } from '../auth/auth-form'
import { displayAccountName } from '../lib/account-display'

export function ProfilePage({ memberDetailsAvailable = false }: { memberDetailsAvailable?: boolean }) {
  const auth = useAuth()
  const { capabilities, error: capabilityError, retry: retryCapabilities } = useAuthCapabilitiesState()
  const nicknameEnabled = capabilities?.nicknameWriteEnabled === true
  const { locale, messages: t } = useLocale()
  const [isNameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameDialogError, setNameDialogError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const profile = auth.profile

  useEffect(() => {
    if (!profile && auth.accessToken && !auth.isBootstrapping) {
      auth.refreshProfile().catch(() => setError(t.profile.loadFailed))
    }
  }, [auth, profile, t.profile.loadFailed])

  async function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.updateProfile || !profile) return

    const form = new FormData(event.currentTarget)
    setError('')
    setMessage('')
    setNameDialogError('')

    try {
      await auth.api.updateProfile({
        ...(nicknameEnabled ? { nickname: String(form.get('nickname') ?? '') } : { first_name: String(form.get('first_name') ?? ''), last_name: String(form.get('last_name') ?? '') }),
      })
      markProfileSaved()
      await auth.refreshProfile()
      setMessage(t.profile.updated)
      setNameDialogOpen(false)
    } catch (caught) {
      setNameDialogError(authErrorMessage(caught, t.profile.updateFailed, { ACC_PROFILE_NAME_CLIENT_UPDATE_REQUIRED: t.nickname.clientUpdate, ACC_PROFILE_NAME_WRITES_PAUSED: t.nickname.paused }))
    }
  }

  if (auth.isBootstrapping || !profile) return <Skeleton className="account-page-skeleton" label={t.profile.loading} />

  const name = displayAccountName(profile, t.profile.fallbackName)

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.personalInfo}</h1>
      </div>

      {message ? <p className="form-notice" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {capabilityError ? <div role="alert"><p>{t.profile.updateFailed}</p><Button onPress={retryCapabilities}>{t.legalAcceptance.retry}</Button></div> : null}

      {memberDetailsAvailable ? <Card className="panel-card settings-card"><Card.Content className="settings-list"><div className="settings-row"><div className="settings-row-copy"><span className="settings-row-label">{memberDetailsMessages[locale].title}</span><p>{memberDetailsMessages[locale].privacy}</p></div><Link className="member-details-link" to="/profile/member-details">{memberDetailsMessages[locale].title}</Link></div></Card.Content></Card> : null}

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
              <span className="settings-row-label">{t.nickname.label}</span>
              <strong>{name}</strong>
            </div>
            <Button variant="secondary" isDisabled={!capabilities} onPress={() => setNameDialogOpen(true)}>
              {nicknameEnabled ? t.nickname.edit : t.profile.editName}
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

      <Modal
        isOpen={isNameDialogOpen}
        onOpenChange={(open) => {
          setNameDialogOpen(open)
          if (!open) setNameDialogError('')
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{nicknameEnabled ? t.nickname.edit : t.profile.editName}</Modal.Heading>
              </Modal.Header>
              <Form key={`${profile.id}-${nicknameEnabled}`} onSubmit={submitName}>
                <Modal.Body>
                  {nameDialogError ? <p className="form-error" role="alert">{nameDialogError}</p> : null}
                  {nicknameEnabled ? (
                    <TextField isRequired defaultValue={profile.nickname ?? ''} name="nickname">
                      <Label>{t.nickname.label}</Label>
                      <Input autoComplete="nickname" />
                      <p>{t.nickname.hint}</p>
                      <FieldError />
                    </TextField>
                  ) : (<><TextField defaultValue={profile.first_name ?? ''} name="first_name">
                    <Label>{t.profile.firstName}</Label>
                    <Input autoComplete="given-name" />
                  </TextField>
                  <TextField defaultValue={profile.last_name ?? ''} name="last_name">
                    <Label>{t.profile.lastName}</Label>
                    <Input autoComplete="family-name" />
                  </TextField></>)}
                </Modal.Body>
                <Modal.Footer>
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
