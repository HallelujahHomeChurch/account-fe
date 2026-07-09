import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { SecurityPage } from './SecurityPage'

describe('SecurityPage', () => {
  it('submits password changes to account-api', async () => {
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
    await userEvent.type(screen.getByLabelText('Current password'), 'oldSecret1')
    await userEvent.type(screen.getByLabelText('New password'), 'newSecret1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(passwordBody).toMatchObject({
      old_password: 'oldSecret1',
      new_password: 'newSecret1',
    })
  })

  it('completes protected MFA setup and can disable MFA', async () => {
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

    await userEvent.click(await screen.findByRole('button', { name: /set up MFA/i }))
    expect(await screen.findByText('otpauth://totp/HHC:ray@example.com')).toBeInTheDocument()
    expect(screen.getByText('11111111')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /enable MFA/i }))

    expect(calls).toContain('setup')
    expect(calls).toContain('verify:123456')

    await userEvent.click(screen.getByRole('button', { name: /disable MFA/i }))
    expect(calls).toContain('disable')
  })
})
