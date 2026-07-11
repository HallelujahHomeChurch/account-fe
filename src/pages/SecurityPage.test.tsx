import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { SecurityPage } from './SecurityPage'

describe('SecurityPage', () => {
  it('opens password fields only after the user chooses to change password', async () => {
    let passwordBody: unknown
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        mfa: { enabled: false },
      }),
      logout: async () => ({}),
      listDevices: async () => [{ session_id: 'session-1', user_agent: 'Chrome on macOS' }],
      listLinkedAccounts: async () => [{ provider: 'google' }],
      changePassword: async (body) => {
        passwordBody = body
        return { message: 'Password changed successfully' }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Chrome on macOS')
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^change$/i }))
    await userEvent.type(screen.getByLabelText('Current password'), 'oldSecret1')
    await userEvent.type(screen.getByLabelText('New password'), 'newSecret1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(passwordBody).toMatchObject({
      old_password: 'oldSecret1',
      new_password: 'newSecret1',
    })
  })

  it('keeps MFA setup fields in a dialog flow', async () => {
    const calls: string[] = []
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        mfa: { enabled: false },
      }),
      logout: async () => ({}),
      listDevices: async () => [],
      listLinkedAccounts: async () => [],
      setupMfa: async () => {
        calls.push('setup')
        return { otpauth_url: 'otpauth://totp/HHC:ray@example.com', backup_codes: ['11111111'] }
      },
      verifyMfaSetup: async (code) => {
        calls.push(`verify:${code}`)
        return { message: 'MFA enabled successfully' }
      },
      disableMfa: async () => {
        calls.push('disable')
        return { message: 'MFA disabled successfully' }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Multi-factor authentication' })).toBeInTheDocument()
    expect(screen.queryByText('otpauth://totp/HHC:ray@example.com')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^set up$/i }))
    expect(await screen.findByText('otpauth://totp/HHC:ray@example.com')).toBeInTheDocument()
    expect(screen.queryByText('11111111')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /enable MFA/i }))

    expect(calls).toContain('setup')
    expect(calls).toContain('verify:123456')
    expect(await screen.findByText('11111111')).toBeInTheDocument()
  })

  it('manages linked sign-in methods and devices from settings rows', async () => {
    const calls: string[] = []
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        has_password: true,
        mfa: { enabled: true },
      }),
      logout: async () => ({}),
      listDevices: async () => [{ session_id: 'session-1', user_agent: 'Chrome on macOS' }],
      listLinkedAccounts: async () => [{ provider: 'google' }],
      unlinkAccount: async (provider) => {
        calls.push(`unlink:${provider}`)
      },
      logoutDevice: async (sessionId) => {
        calls.push(`device:${sessionId}`)
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /security/i })).toBeInTheDocument()
    expect(screen.getByText('Sign-in methods')).toBeInTheDocument()
    expect(screen.queryByText('Linked accounts')).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /remove google/i }))
    expect(calls).toContain('unlink:google')

    await userEvent.click(await screen.findByRole('button', { name: /sign out chrome on macos/i }))
    expect(calls).toContain('device:session-1')
  })
})
