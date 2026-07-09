import { Button, Card, Form, Input, Label, TextField } from '@heroui/react'
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { ApiError, type Device, type LinkedAccount, type MfaSetup } from '../lib/api'

export function SecurityPage() {
  const auth = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null)
  const [isMfaEnabled, setIsMfaEnabled] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const mfaEnabled = isMfaEnabled ?? Boolean(auth.profile?.mfa?.enabled)

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
      setMessage('Password changed.')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function disableMfa() {
    if (!auth.api.disableMfa) return
    await auth.api.disableMfa()
    setIsMfaEnabled(false)
    setMfaSetup(null)
    await auth.refreshProfile().catch(() => undefined)
    setMessage('MFA disabled.')
  }

  async function startMfaSetup() {
    if (!auth.api.setupMfa) return
    setError('')
    setMessage('')

    try {
      setMfaSetup(await auth.api.setupMfa())
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
      await auth.refreshProfile().catch(() => undefined)
      setMessage('MFA enabled.')
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
      setMessage('Backup codes regenerated.')
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
  }

  if (auth.isBootstrapping) return <p className="inline-status">Loading security...</p>

  if (!auth.profile) {
    return (
      <section className="document-shell">
        <div className="page-heading">
          <h1>Security</h1>
          <p>Sign in to manage password, MFA, devices, and linked accounts.</p>
          <Link className="button-link" to="/login">
            Sign in
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="account-document">
      <div className="page-heading">
        <p className="eyebrow">Security</p>
        <h1>Account protection</h1>
        <p>Password, MFA, devices, and linked sign-in methods.</p>
      </div>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>Change password</Card.Title>
        </Card.Header>
        <Card.Content>
          {message ? <p className="form-notice">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Form className="form-stack" onSubmit={submitPassword}>
            <TextField isRequired name="old_password" type="password">
              <Label>Current password</Label>
              <Input autoComplete="current-password" />
            </TextField>
            <TextField isRequired name="new_password" type="password">
              <Label>New password</Label>
              <Input autoComplete="new-password" />
            </TextField>
            <Button type="submit">
              <KeyRound size={17} />
              Change password
            </Button>
          </Form>
        </Card.Content>
      </Card>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>Multi-factor authentication</Card.Title>
          <Card.Description>{mfaEnabled ? 'Enabled' : 'Not enabled'}</Card.Description>
        </Card.Header>
        <Card.Content>
          {mfaSetup?.otpauth_url ? <code className="setup-code">{mfaSetup.otpauth_url}</code> : null}
          {mfaSetup?.backup_codes?.length ? (
            <ul className="backup-codes">
              {mfaSetup.backup_codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          ) : null}
          {mfaSetup && !mfaEnabled ? (
            <Form className="form-stack compact-form" onSubmit={submitMfaSetup}>
              <TextField isRequired name="code">
                <Label>Verification code</Label>
                <Input inputMode="numeric" placeholder="123456" />
              </TextField>
              <Button type="submit">Enable MFA</Button>
            </Form>
          ) : null}
          <div className="action-row">
            {mfaEnabled ? (
              <>
                <Button variant="secondary" onPress={() => void regenerateBackupCodes()}>
                  <ShieldCheck size={17} />
                  Regenerate backup codes
                </Button>
                <Button variant="danger" onPress={() => void disableMfa()}>
                  Disable MFA
                </Button>
              </>
            ) : !mfaSetup ? (
              <Button variant="secondary" onPress={() => void startMfaSetup()}>
                <ShieldCheck size={17} />
                Set up MFA
              </Button>
            ) : null}
          </div>
        </Card.Content>
      </Card>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>Devices</Card.Title>
        </Card.Header>
        <Card.Content className="item-list">
          {devices.length ? (
            devices.map((device) => (
              <div key={device.session_id} className="list-item">
                <span>{device.user_agent || device.session_id}</span>
                <Button isIconOnly aria-label="Remove device" variant="ghost" onPress={() => void removeDevice(device.session_id)}>
                  <Trash2 size={17} />
                </Button>
              </div>
            ))
          ) : (
            <p className="muted-copy">No active devices reported.</p>
          )}
        </Card.Content>
      </Card>

      <Card className="panel-card document-card">
        <Card.Header>
          <Card.Title>Linked accounts</Card.Title>
        </Card.Header>
        <Card.Content className="item-list">
          {linkedAccounts.length ? (
            linkedAccounts.map((account) => (
              <div key={account.provider} className="list-item">
                <span>{account.provider}</span>
                <Button isIconOnly aria-label={`Unlink ${account.provider}`} variant="ghost" onPress={() => void unlink(account.provider)}>
                  <Trash2 size={17} />
                </Button>
              </div>
            ))
          ) : (
            <p className="muted-copy">No linked social accounts.</p>
          )}
        </Card.Content>
      </Card>
    </section>
  )
}

function errorMessage(caught: unknown) {
  if (caught instanceof ApiError || caught instanceof Error) return caught.message
  return 'Request failed.'
}
