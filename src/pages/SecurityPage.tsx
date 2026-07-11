import {
  Button,
  Card,
  Form,
  Input,
  InputOTP,
  Label,
  Modal,
  REGEXP_ONLY_DIGITS,
  TextField,
} from '@heroui/react'
import { useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type Device, type LinkedAccount, type MfaSetup } from '../lib/api'

type MfaDialog = 'setup' | 'manage' | null

const supportedProviders = ['google', 'line', 'microsoft']

export function SecurityPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [devices, setDevices] = useState<Device[]>([])
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null)
  const [mfaDialog, setMfaDialog] = useState<MfaDialog>(null)
  const [isMfaSetupVerified, setMfaSetupVerified] = useState(false)
  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const mfaEnabled = isMfaEnabled ?? Boolean(auth.profile?.mfa?.enabled)
  const visibleLinkedAccounts = linkedAccounts.filter((account) => supportedProviders.includes(account.provider))

  useEffect(() => {
    if (!auth.accessToken || auth.isBootstrapping) return

    auth.api.listDevices?.().then(setDevices).catch(() => setDevices([]))
    auth.api.listLinkedAccounts?.().then(setLinkedAccounts).catch(() => setLinkedAccounts([]))
  }, [auth.accessToken, auth.api, auth.isBootstrapping])

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.changePassword) return

    const form = new FormData(event.currentTarget)
    setError('')
    setMessage('')

    try {
      await auth.api.changePassword({
        old_password: String(form.get('old_password') ?? ''),
        new_password: String(form.get('new_password') ?? ''),
      })
      event.currentTarget.reset()
      setPasswordDialogOpen(false)
      setMessage(t.security.passwordChanged)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function openMfaSetup() {
    if (!auth.api.setupMfa) return
    setError('')
    setMessage('')
    setMfaSetupVerified(false)

    try {
      setMfaSetup(await auth.api.setupMfa())
      setMfaDialog('setup')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function submitMfaSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.verifyMfaSetup) return

    const code = String(new FormData(event.currentTarget).get('code') ?? '')
    setError('')
    setMessage('')

    try {
      await auth.api.verifyMfaSetup(code)
      setIsMfaEnabled(true)
      setMfaSetupVerified(true)
      await auth.refreshProfile().catch(() => undefined)
      setMessage(t.security.mfaEnabledNotice)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function disableMfa() {
    if (!auth.api.disableMfa) return
    setError('')
    setMessage('')

    try {
      await auth.api.disableMfa()
      setIsMfaEnabled(false)
      setMfaSetup(null)
      setMfaDialog(null)
      await auth.refreshProfile().catch(() => undefined)
      setMessage(t.security.mfaDisabledNotice)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function regenerateBackupCodes() {
    if (!auth.api.regenerateBackupCodes) return
    setError('')
    setMessage('')

    try {
      const response = await auth.api.regenerateBackupCodes()
      setMfaSetup((current) => ({ ...(current ?? {}), backup_codes: response.backup_codes ?? [] }))
      setMfaSetupVerified(true)
      setMessage(t.security.backupCodesRegenerated)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function removeDevice(sessionId: string) {
    await auth.api.logoutDevice?.(sessionId)
    setDevices((current) => current.filter((device) => device.session_id !== sessionId))
  }

  async function unlink(provider: string) {
    await auth.api.unlinkAccount?.(provider)
    setLinkedAccounts((current) => current.filter((account) => account.provider !== provider))
    setMessage(t.security.providerRemoved)
  }

  if (auth.isBootstrapping || !auth.profile) return <p className="inline-status">{t.security.loading}</p>

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.security}</h1>
      </div>

      {message ? <p className="form-notice">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.security.signInMethods}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.security.password}</span>
              <strong>{auth.profile.has_password === false ? t.security.passwordNotSet : t.security.passwordSet}</strong>
            </div>
            <Button variant="secondary" onPress={() => setPasswordDialogOpen(true)}>
              {t.security.change}
            </Button>
          </div>
          {visibleLinkedAccounts.length ? (
            visibleLinkedAccounts.map((account) => {
              const provider = providerLabel(account.provider, t.security)

              return (
                <div key={account.provider} className="settings-row">
                  <div className="settings-row-copy">
                    <span className="settings-row-label">{provider}</span>
                    <strong>{account.provider_id ?? provider}</strong>
                  </div>
                  <Button
                    aria-label={formatMessage(t.security.removeProviderLabel, { provider })}
                    variant="ghost"
                    onPress={() => void unlink(account.provider)}
                  >
                    {t.security.removeProvider}
                  </Button>
                </div>
              )
            })
          ) : (
            <p className="muted-copy">{t.security.noLinkedAccounts}</p>
          )}
        </Card.Content>
      </Card>

      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.security.mfa}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          <div className="settings-row">
            <div className="settings-row-copy">
              <span className="settings-row-label">{t.security.mfa}</span>
              <strong>{mfaEnabled ? t.security.mfaEnabled : t.security.mfaNotEnabled}</strong>
            </div>
            {mfaEnabled ? (
              <Button variant="secondary" onPress={() => setMfaDialog('manage')}>
                {t.security.manage}
              </Button>
            ) : (
              <Button variant="secondary" onPress={() => void openMfaSetup()}>
                {t.security.setUp}
              </Button>
            )}
          </div>
        </Card.Content>
      </Card>

      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.security.devices}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          {devices.length ? (
            devices.map((device) => {
              const deviceName = device.user_agent || device.session_id

              return (
                <div key={device.session_id} className="settings-row">
                  <div className="settings-row-copy">
                    <span className="settings-row-label">{deviceName}</span>
                    {device.ip_address ? <strong>{device.ip_address}</strong> : null}
                  </div>
                  <Button
                    aria-label={formatMessage(t.security.signOutDeviceLabel, { device: deviceName })}
                    variant="ghost"
                    onPress={() => void removeDevice(device.session_id)}
                  >
                    {t.security.signOutDevice}
                  </Button>
                </div>
              )
            })
          ) : (
            <p className="muted-copy">{t.security.noDevices}</p>
          )}
        </Card.Content>
      </Card>

      <PasswordDialog
        isOpen={isPasswordDialogOpen}
        labels={t.security}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={submitPassword}
      />
      <MfaDialogContent
        dialog={mfaDialog}
        labels={t.security}
        mfaSetup={mfaSetup}
        setupVerified={isMfaSetupVerified}
        onDisable={() => void disableMfa()}
        onOpenChange={(open) => setMfaDialog(open ? mfaDialog : null)}
        onRegenerate={() => void regenerateBackupCodes()}
        onSubmitSetup={submitMfaSetup}
      />
    </section>
  )
}

function PasswordDialog({
  isOpen,
  labels,
  onOpenChange,
  onSubmit,
}: {
  isOpen: boolean
  labels: Record<string, string>
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop className="modal-backdrop">
        <Modal.Container className="modal-container" placement="center">
          <Modal.Dialog className="modal-dialog">
            <Modal.Header>
              <Modal.Heading>{labels.changePassword}</Modal.Heading>
            </Modal.Header>
            <Form onSubmit={onSubmit}>
              <Modal.Body className="modal-form-grid">
                <TextField isRequired name="old_password" type="password">
                  <Label>{labels.currentPassword}</Label>
                  <Input autoComplete="current-password" />
                </TextField>
                <TextField isRequired name="new_password" type="password">
                  <Label>{labels.newPassword}</Label>
                  <Input autoComplete="new-password" />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="modal-actions">
                <Button variant="ghost" onPress={() => onOpenChange(false)}>
                  {labels.cancel}
                </Button>
                <Button type="submit">{labels.changePassword}</Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

function MfaDialogContent({
  dialog,
  labels,
  mfaSetup,
  setupVerified,
  onDisable,
  onOpenChange,
  onRegenerate,
  onSubmitSetup,
}: {
  dialog: MfaDialog
  labels: Record<string, string>
  mfaSetup: MfaSetup | null
  setupVerified: boolean
  onDisable: () => void
  onOpenChange: (isOpen: boolean) => void
  onRegenerate: () => void
  onSubmitSetup: (event: FormEvent<HTMLFormElement>) => void
}) {
  const isSetup = dialog === 'setup'

  return (
    <Modal isOpen={Boolean(dialog)} onOpenChange={onOpenChange}>
      <Modal.Backdrop className="modal-backdrop">
        <Modal.Container className="modal-container" placement="center">
          <Modal.Dialog className="modal-dialog">
            <Modal.Header>
              <Modal.Heading>{labels.mfa}</Modal.Heading>
            </Modal.Header>
            {isSetup ? (
              <Form onSubmit={onSubmitSetup}>
                <Modal.Body className="modal-form-grid">
                  {mfaSetup?.qr_code_url ? (
                    <img className="mfa-qr-code" src={mfaSetup.qr_code_url} alt={labels.mfa} />
                  ) : mfaSetup?.otpauth_url ? (
                    <code className="setup-code" aria-label={labels.setupCode}>
                      {mfaSetup.otpauth_url}
                    </code>
                  ) : null}
                  <div className="mfa-code-field">
                    <Label className="mfa-code-label" id="security-mfa-code-label">
                      {labels.verificationCode}
                    </Label>
                    <InputOTP
                      aria-labelledby="security-mfa-code-label"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      name="code"
                      pattern={REGEXP_ONLY_DIGITS}
                      required
                    >
                      <InputOTP.Group>
                        <InputOTP.Slot index={0} />
                        <InputOTP.Slot index={1} />
                        <InputOTP.Slot index={2} />
                      </InputOTP.Group>
                      <InputOTP.Separator />
                      <InputOTP.Group>
                        <InputOTP.Slot index={3} />
                        <InputOTP.Slot index={4} />
                        <InputOTP.Slot index={5} />
                      </InputOTP.Group>
                    </InputOTP>
                  </div>
                  {setupVerified && mfaSetup?.backup_codes?.length ? (
                    <BackupCodes codes={mfaSetup.backup_codes} label={labels.backupCodes} />
                  ) : null}
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => onOpenChange(false)}>
                    {labels.cancel}
                  </Button>
                  <Button type="submit">{labels.enableMfa}</Button>
                </Modal.Footer>
              </Form>
            ) : (
              <>
                <Modal.Body className="modal-form-grid">
                  {setupVerified && mfaSetup?.backup_codes?.length ? (
                    <BackupCodes codes={mfaSetup.backup_codes} label={labels.backupCodes} />
                  ) : null}
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => onOpenChange(false)}>
                    {labels.cancel}
                  </Button>
                  <Button variant="secondary" onPress={onRegenerate}>
                    {labels.regenerateBackupCodes}
                  </Button>
                  <Button variant="danger" onPress={onDisable}>
                    {labels.disableMfa}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

function BackupCodes({ codes, label }: { codes: string[]; label: string }) {
  return (
    <div>
      <p className="backup-codes-label">{label}</p>
      <ul className="backup-codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  )
}

function providerLabel(provider: string, labels: Record<string, string>) {
  return labels[provider] ?? provider
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((message, [key, value]) => message.replace(`{${key}}`, value), template)
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
