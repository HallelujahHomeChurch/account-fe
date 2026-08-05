import {
  AlertDialog,
  Button,
  Card,
  Form,
  Input,
  Label,
  Modal,
  OTP,
  REGEXP_ONLY_DIGITS,
  Skeleton,
  TextField,
} from '@hallelujahhomechurch/ui'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { ApiError, type LinkedAccount, type MfaSetup } from '../lib/api'
import { authErrorMessage, isStrongPassword } from '../auth/auth-form'
import { SocialIcon } from '../components/SocialIcon'

type MfaDialog = 'setup' | 'manage' | null

const supportedProviders = ['google', 'line', 'microsoft']

export function SecurityPage() {
  const auth = useAuth()
  const { messages: t } = useLocale()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [callbackResult] = useState(() => ({
    linkedProvider: searchParams.get('linked'),
    linkError: searchParams.get('link_error'),
  }))
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[] | null>(null)
  const [linkedAccountsError, setLinkedAccountsError] = useState(false)
  const [enabledProviders, setEnabledProviders] = useState<string[] | null>(null)
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null)
  const [mfaDialog, setMfaDialog] = useState<MfaDialog>(null)
  const [isMfaSetupVerified, setMfaSetupVerified] = useState(false)
  const [isPasswordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordDialogError, setPasswordDialogError] = useState('')
  const [mfaDialogError, setMfaDialogError] = useState('')
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const mfaEnabled = isMfaEnabled ?? Boolean(auth.profile?.mfa?.enabled)
  const visibleLinkedAccounts = (linkedAccounts ?? []).filter((account) => supportedProviders.includes(account.provider))
  const linkedProviderIDs = visibleLinkedAccounts.map((account) => account.provider)
  const visibleProviders = supportedProviders.filter((provider) =>
    linkedProviderIDs.includes(provider) || (enabledProviders ?? linkedProviderIDs).includes(provider),
  )
  const callbackMessage = callbackResult.linkedProvider && linkedProviderIDs.includes(callbackResult.linkedProvider)
    ? formatMessage(t.security.providerLinked, { provider: providerLabel(callbackResult.linkedProvider, t.security) })
    : ''
  const callbackError = callbackResult.linkError
    ? callbackResult.linkError === 'conflict' ? t.security.providerLinkConflict : t.security.providerLinkFailed
    : ''

  const loadLinkedAccounts = useCallback(async () => {
    if (!auth.api.listLinkedAccounts) {
      setLinkedAccounts([])
      return
    }
    setLinkedAccountsError(false)
    setLinkedAccounts(null)
    try {
      setLinkedAccounts(await auth.api.listLinkedAccounts())
    } catch {
      setLinkedAccountsError(true)
    }
  }, [auth.api])

  useEffect(() => {
    if (!auth.accessToken || auth.isBootstrapping) return
    void loadLinkedAccounts()
    if (auth.api.getOAuthProviders) {
      void auth.api.getOAuthProviders().then(setEnabledProviders).catch(() => undefined)
    }
  }, [auth.accessToken, auth.api, auth.isBootstrapping, loadLinkedAccounts])

  useEffect(() => {
    if (callbackResult.linkedProvider || callbackResult.linkError) {
      navigate('/security', { replace: true })
    }
  }, [callbackResult, navigate])

  async function connect(provider: string) {
    if (!auth.api.startLinkedAccountAuthorization) return
    setError('')
    setMessage('')
    try {
      const response = await auth.api.startLinkedAccountAuthorization(provider)
      auth.navigateExternal(response.authorization_url)
    } catch {
      setError(t.security.providerLinkFailed)
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.api.changePassword) return

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const newPassword = String(form.get('new_password') ?? '')
    setError('')
    setMessage('')
    setPasswordDialogError('')

    if (!isStrongPassword(newPassword)) {
      setPasswordDialogError(t.security.passwordPolicy)
      return
    }
    if (newPassword !== String(form.get('confirm_password') ?? '')) {
      setPasswordDialogError(t.security.passwordMismatch)
      return
    }

    try {
      await auth.api.changePassword({
        old_password: String(form.get('old_password') ?? ''),
        new_password: newPassword,
      })
      formElement.reset()
      setPasswordDialogOpen(false)
      auth.clearLocalSession('/login?password_changed=1')
    } catch (caught) {
      setPasswordDialogError(authErrorMessage(caught, t.security.passwordChangeFailed, {
        ACC_REQUEST_INVALID: t.security.passwordPolicy,
        ACC_AUTH_INVALID_CREDENTIALS: t.security.currentPasswordIncorrect,
      }))
    }
  }

  async function requestPasswordSetup() {
    if (!auth.profile?.email || !auth.api.forgotPassword) return
    setError('')
    setMessage('')
    try {
      await auth.api.forgotPassword(auth.profile.email)
      setMessage(t.security.passwordSetupSent)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function openMfaSetup() {
    if (!auth.api.setupMfa) return
    setError('')
    setMessage('')
    setMfaDialogError('')
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
    setMfaDialogError('')

    try {
      await auth.api.verifyMfaSetup(code)
      setIsMfaEnabled(true)
      setMfaSetupVerified(true)
      await auth.refreshProfile().catch(() => undefined)
      setMessage(t.security.mfaEnabledNotice)
    } catch (caught) {
      setMfaDialogError(errorMessage(caught))
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
    } catch {
      setError(t.security.providerRemoveFailed)
    }
  }

  async function regenerateBackupCodes() {
    if (!auth.api.regenerateBackupCodes) return
    setError('')
    setMessage('')
    setMfaDialogError('')

    try {
      const response = await auth.api.regenerateBackupCodes()
      setMfaSetup((current) => ({ ...(current ?? {}), backup_codes: response.backup_codes ?? [] }))
      setMfaSetupVerified(true)
      setMessage(t.security.backupCodesRegenerated)
    } catch (caught) {
      setMfaDialogError(errorMessage(caught))
    }
  }

  async function unlink(provider: string) {
    setError('')
    setMessage('')
    try {
      await auth.api.unlinkAccount?.(provider)
      setLinkedAccounts((current) => (current ?? []).filter((account) => account.provider !== provider))
      setMessage(t.security.providerRemoved)
    } catch (caught) {
      setError(errorMessage(caught))
      throw caught
    }
  }

  if (auth.isBootstrapping || !auth.profile) return <Skeleton className="account-page-skeleton" label={t.security.loading} />

  return (
    <section className="account-document">
      <div className="page-heading">
        <h1>{t.nav.security}</h1>
      </div>

      {message || callbackMessage ? <p className="form-notice" role="status">{message || callbackMessage}</p> : null}
      {error || callbackError ? <p className="form-error" role="alert">{error || callbackError}</p> : null}

      <Card className="panel-card settings-card">
        <Card.Header>
          <Card.Title>{t.security.signInMethods}</Card.Title>
        </Card.Header>
        <Card.Content className="settings-list">
          <div className="settings-row">
            <span className="settings-icon" aria-hidden="true"><KeyRound /></span>
            <div className="settings-row-copy">
              <strong>{t.security.password}</strong>
              <span className="settings-row-label">{auth.profile.has_password === false ? t.security.passwordNotSet : t.security.passwordSet}</span>
            </div>
            <Button
              variant="secondary"
              onPress={() => auth.profile?.has_password === false ? void requestPasswordSetup() : setPasswordDialogOpen(true)}
            >
              {auth.profile.has_password === false ? t.security.setPassword : t.security.change}
            </Button>
          </div>
          {linkedAccounts === null && !linkedAccountsError ? (
            <Skeleton className="settings-list-skeleton" label={t.security.loading} />
          ) : linkedAccountsError ? (
            <div className="settings-row">
              <p className="muted-copy">{t.security.linkedAccountsLoadFailed}</p>
              <Button variant="secondary" onPress={() => void loadLinkedAccounts()}>
                {t.security.retry}
              </Button>
            </div>
          ) : visibleProviders.length ? (
            visibleProviders.map((providerID) => {
              const provider = providerLabel(providerID, t.security)
              const isLinked = visibleLinkedAccounts.some((account) => account.provider === providerID)

              return (
                <div key={providerID} className="settings-row">
                  <span className={`settings-icon social-provider-icon social-provider-icon--${providerID}`} aria-hidden="true">
                    <SocialIcon provider={providerID} />
                  </span>
                  <div className="settings-row-copy">
                    <strong>{provider}</strong>
                    <span className="settings-row-label">{isLinked ? t.security.linked : t.security.notLinked}</span>
                  </div>
                  {isLinked ? (
                    <AlertDialog
                      cancelLabel={t.security.cancel}
                      confirmLabel={t.security.removeProvider}
                      description={formatMessage(t.security.removeProviderDescription, { provider })}
                      title={formatMessage(t.security.removeProviderTitle, { provider })}
                      trigger={<Button aria-label={formatMessage(t.security.removeProviderLabel, { provider })} variant="ghost">{t.security.removeProvider}</Button>}
                      onConfirm={() => unlink(providerID)}
                    />
                  ) : (
                    <AlertDialog
                      cancelLabel={t.security.cancel}
                      confirmLabel={t.security.continue}
                      confirmVariant="primary"
                      description={formatMessage(t.security.connectProviderDescription, { provider })}
                      title={formatMessage(t.security.connectProviderTitle, { provider })}
                      trigger={<Button aria-label={formatMessage(t.security.connectProviderLabel, { provider })} variant="secondary">{t.security.connectProvider}</Button>}
                      onConfirm={() => connect(providerID)}
                    />
                  )}
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
            <span className="settings-icon" aria-hidden="true"><ShieldCheck /></span>
            <div className="settings-row-copy">
              <strong>{t.security.authenticatorApp}</strong>
              <span className="settings-row-label">{mfaEnabled ? t.security.mfaEnabled : t.security.mfaNotEnabled}</span>
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

      <PasswordDialog
        isOpen={isPasswordDialogOpen}
        error={passwordDialogError}
        labels={t.security}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open)
          if (!open) setPasswordDialogError('')
        }}
        onSubmit={submitPassword}
      />
      <MfaDialogContent
        dialog={mfaDialog}
        labels={t.security}
        error={mfaDialogError}
        mfaSetup={mfaSetup}
        setupVerified={isMfaSetupVerified}
        onDisable={disableMfa}
        onOpenChange={(open) => {
          setMfaDialog(open ? mfaDialog : null)
          if (!open) setMfaDialogError('')
        }}
        onRegenerate={() => void regenerateBackupCodes()}
        onSubmitSetup={submitMfaSetup}
      />
    </section>
  )
}

function PasswordDialog({
  error,
  isOpen,
  labels,
  onOpenChange,
  onSubmit,
}: {
  error: string
  isOpen: boolean
  labels: Record<string, string>
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{labels.changePassword}</Modal.Heading>
            </Modal.Header>
            <Form onSubmit={onSubmit}>
              <Modal.Body>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <TextField isRequired name="old_password" type="password">
                  <Label>{labels.currentPassword}</Label>
                  <Input autoComplete="current-password" />
                </TextField>
                <TextField isRequired name="new_password" type="password">
                  <Label>{labels.newPassword}</Label>
                  <Input autoComplete="new-password" />
                </TextField>
                <TextField isRequired name="confirm_password" type="password">
                  <Label>{labels.confirmPassword}</Label>
                  <Input autoComplete="new-password" />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
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
  error,
  labels,
  mfaSetup,
  setupVerified,
  onDisable,
  onOpenChange,
  onRegenerate,
  onSubmitSetup,
}: {
  dialog: MfaDialog
  error: string
  labels: Record<string, string>
  mfaSetup: MfaSetup | null
  setupVerified: boolean
  onDisable: () => Promise<void>
  onOpenChange: (isOpen: boolean) => void
  onRegenerate: () => void
  onSubmitSetup: (event: FormEvent<HTMLFormElement>) => void
}) {
  const isSetup = dialog === 'setup'

  return (
    <Modal isOpen={Boolean(dialog)} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{labels.mfa}</Modal.Heading>
            </Modal.Header>
            {isSetup ? (
              <Form onSubmit={onSubmitSetup}>
                <Modal.Body>
                  {error ? <p className="form-error" role="alert">{error}</p> : null}
                  {mfaSetup?.qr_code_url ? (
                    <img className="mfa-qr-code" src={mfaSetup.qr_code_url} alt={labels.mfa} />
                  ) : mfaSetup?.otpauth_url ? (
                    <code className="setup-code" aria-label={labels.setupCode}>
                      {mfaSetup.otpauth_url}
                    </code>
                  ) : null}
                  <div className="mfa-code-field">
                    <OTP
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      label={labels.verificationCode}
                      maxLength={6}
                      name="code"
                      pattern={REGEXP_ONLY_DIGITS}
                      required
                    />
                  </div>
                  {setupVerified && mfaSetup?.backup_codes?.length ? (
                    <BackupCodes codes={mfaSetup.backup_codes} label={labels.backupCodes} />
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => onOpenChange(false)}>
                    {labels.cancel}
                  </Button>
                  <Button type="submit">{labels.enableMfa}</Button>
                </Modal.Footer>
              </Form>
            ) : (
              <>
                <Modal.Body>
                  {error ? <p className="form-error" role="alert">{error}</p> : null}
                  {setupVerified && mfaSetup?.backup_codes?.length ? (
                    <BackupCodes codes={mfaSetup.backup_codes} label={labels.backupCodes} />
                  ) : null}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={() => onOpenChange(false)}>
                    {labels.cancel}
                  </Button>
                  <Button variant="secondary" onPress={onRegenerate}>
                    {labels.regenerateBackupCodes}
                  </Button>
                  <AlertDialog
                    cancelLabel={labels.cancel}
                    confirmLabel={labels.disableMfa}
                    description={labels.disableMfaDescription}
                    title={labels.disableMfaTitle}
                    trigger={<Button variant="danger">{labels.disableMfa}</Button>}
                    onConfirm={onDisable}
                  />
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
