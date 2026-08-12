import { ToastProvider } from '@hallelujahhomechurch/ui'
import { MemoryRouter } from 'react-router-dom'
import { render as testingRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { SecurityPage } from './SecurityPage'
import { ApiError } from '../lib/api'
import { LocaleProvider } from '../i18n/locale-context'
import { messages } from '../i18n/messages'

function render(element: ReactElement) {
  return testingRender(<ToastProvider dismissLabel="Dismiss">{element}</ToastProvider>)
}

describe('SecurityPage', () => {
  it('uses the same non-inverted LINE brand treatment as login and registration', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: true }),
      logout: async () => ({}), listLinkedAccounts: async () => [{ provider: 'line' }],
    }
    const { container } = render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await screen.findAllByText('LINE')
    expect(container.querySelector('.social-provider-icon--line')).toHaveClass('social-provider-icon--brand')
  })

  it.each([
    ['ja', 'セキュリティ', 'ログイン方法', '多要素認証'],
    ['ko', '보안', '로그인 방법', '다단계 인증'],
  ])('renders security controls in %s', async (locale, heading, methods, mfa) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: true, mfa: { enabled: false } }),
      logout: async () => ({}), listLinkedAccounts: async () => [],
    }
    render(<MemoryRouter><LocaleProvider><AuthProvider api={api}><SecurityPage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: methods })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mfa })).toBeInTheDocument()
  })

  it('uses standard Korean multi-factor authentication terminology throughout', () => {
    document.cookie = 'hhc_locale=ko; Path=/'
    expect(JSON.stringify(messages.ko)).not.toContain('다중 인증')
    expect(messages.ko.security.mfa).toBe('다단계 인증')
  })

  it('opens password fields only after the user chooses to change password', async () => {
    let passwordBody: unknown
    const navigateAfterLogout = vi.fn()
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        mfa: { enabled: false },
      }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [{ provider: 'google' }],
      changePassword: async (body) => {
        passwordBody = body
        return { message: 'Password changed successfully' }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api} navigateAfterLogout={navigateAfterLogout}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findAllByText('Google')
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^change$/i }))
    await userEvent.type(screen.getByLabelText('Current password'), 'oldSecret1')
    await userEvent.type(screen.getByLabelText('New password'), 'newSecret1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newSecret1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(passwordBody).toMatchObject({
      old_password: 'oldSecret1',
      new_password: 'newSecret1',
    })
    await waitFor(() => expect(navigateAfterLogout).toHaveBeenCalledWith('/login?password_changed=1'))
  })

  it('keeps mismatched password confirmation inside the dialog without calling the API', async () => {
    const changePassword = vi.fn(async () => ({}))
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: true }),
      logout: async () => ({}), listLinkedAccounts: async () => [], changePassword,
    }
    render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /^change$/i }))
    await userEvent.type(screen.getByLabelText('Current password'), 'OldSecret1')
    await userEvent.type(screen.getByLabelText('New password'), 'NewSecret1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(changePassword).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
  })

  it('keeps password errors inside the open dialog', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: true }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [],
      changePassword: async () => { throw new ApiError(400, 'Failed to change password', 'ACC_AUTH_INVALID_CREDENTIALS') },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /^change$/i }))
    await userEvent.type(screen.getByLabelText('Current password'), 'wrong')
    await userEvent.type(screen.getByLabelText('New password'), 'newSecret1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newSecret1')
    await userEvent.click(screen.getByRole('button', { name: /change password/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Current password is incorrect')
    expect(alert.closest('[role="dialog"]')).toBeInTheDocument()
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

  it('sends an email setup link for an OAuth-only account', async () => {
    let resetEmail = ''
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: false, mfa: { enabled: false } }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [{ provider: 'line' }],
      forgotPassword: async (email) => {
        resetEmail = email
        return {}
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /set password/i }))
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    expect(resetEmail).toBe('ray@example.com')
    expect(await screen.findByText('A password setup link was sent to your email.')).toBeInTheDocument()
  })

  it('does not expose password setup API errors', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: false }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [],
      forgotPassword: async () => { throw new ApiError(500, 'smtp credential leaked') },
    }

    render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /set password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to send the password setup link. Try again.',
    )
    expect(screen.queryByText('smtp credential leaked')).not.toBeInTheDocument()
  })

  it('does not expose MFA setup or verification API errors', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', mfa: { enabled: false } }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [],
      setupMfa: vi.fn()
        .mockRejectedValueOnce(new ApiError(500, 'totp seed leaked'))
        .mockResolvedValueOnce({ otpauth_url: 'otpauth://totp/HHC:ray@example.com' }),
      verifyMfaSetup: async () => { throw new ApiError(500, 'verification service leaked') },
    }

    render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /^set up$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to start multi-factor authentication setup. Try again.',
    )
    expect(screen.queryByText('totp seed leaked')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^set up$/i }))
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: /enable MFA/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to verify the authentication code. Try again.',
    )
    expect(screen.queryByText('verification service leaked')).not.toBeInTheDocument()
  })

  it('does not expose backup-code or MFA disable API errors', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', mfa: { enabled: true } }),
      logout: async () => ({}),
      listLinkedAccounts: async () => [],
      regenerateBackupCodes: async () => { throw new ApiError(500, 'backup codes leaked') },
      disableMfa: async () => { throw new ApiError(500, 'mfa database leaked') },
    }

    render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /manage/i }))
    await userEvent.click(screen.getByRole('button', { name: /regenerate backup codes/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to regenerate backup codes. Try again.',
    )
    expect(screen.queryByText('backup codes leaked')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /disable MFA/i }))
    await userEvent.click(screen.getByRole('button', { name: /disable MFA/i }))
    expect(await screen.findByText('Unable to disable multi-factor authentication. Try again.')).toBeInTheDocument()
    expect(screen.queryByText('mfa database leaked')).not.toBeInTheDocument()
  })

  it('uses the localized provider fallback when unlinking fails', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com' }),
      logout: async () => ({}),
      getOAuthProviders: async () => ['google'],
      listLinkedAccounts: async () => [{ provider: 'google' }],
      unlinkAccount: async () => { throw new ApiError(500, 'provider token leaked') },
    }

    render(<MemoryRouter><AuthProvider api={api}><SecurityPage /></AuthProvider></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /remove google/i }))
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }))

    expect(
      (await screen.findByText('Unable to remove this sign-in method. Try again later.')).closest('.hhc-toast'),
    ).toBeInTheDocument()
    expect(screen.queryByText('provider token leaked')).not.toBeInTheDocument()
  })

  it('manages linked sign-in methods from settings rows', async () => {
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
      listLinkedAccounts: async () => [{ provider: 'google' }],
      unlinkAccount: async (provider) => {
        calls.push(`unlink:${provider}`)
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
    expect(screen.getByRole('alertdialog', { name: /remove google sign-in/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }))
    expect(calls).toContain('unlink:google')
    expect((await screen.findByText('Sign-in method removed.')).closest('.hhc-toast')).toBeInTheDocument()
  })

  it('shows every enabled provider and starts linking an unlinked provider', async () => {
    const calls: string[] = []
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', has_password: true }),
      logout: async () => ({}),
      getOAuthProviders: async () => ['google', 'microsoft', 'line'],
      listLinkedAccounts: async () => [{ provider: 'google' }],
      startLinkedAccountAuthorization: async (provider) => {
        calls.push(provider)
        return { authorization_url: `https://provider.example/${provider}` }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api} navigateExternal={(url) => calls.push(url)}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.getAllByText('Not linked')).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: /connect microsoft/i }))
    expect(screen.getByRole('alertdialog', { name: /connect microsoft/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(calls).toEqual(['microsoft', 'https://provider.example/microsoft'])
  })

  it('keeps a linked provider visible when new sign-ins with it are disabled', async () => {
    render(
      <MemoryRouter>
        <AuthProvider api={{
          login: async () => ({ access_token: 'token' }),
          refreshAccessToken: async () => 'token',
          me: async () => ({ id: 'u1', email: 'ray@example.com' }),
          logout: async () => ({}),
          getOAuthProviders: async () => [],
          listLinkedAccounts: async () => [{ provider: 'google' }],
        }}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove google/i })).toBeInTheDocument()
  })

  it('closes the confirmation and shows a localized provider error', async () => {
    render(
      <MemoryRouter>
        <AuthProvider api={{
          login: async () => ({ access_token: 'token' }),
          refreshAccessToken: async () => 'token',
          me: async () => ({ id: 'u1', email: 'ray@example.com' }),
          logout: async () => ({}),
          getOAuthProviders: async () => ['google'],
          listLinkedAccounts: async () => [],
          startLinkedAccountAuthorization: async () => { throw new Error('internal provider error') },
        }}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /connect google/i }))
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to link this sign-in method')
    expect(screen.getByRole('alert')).toHaveClass('hhc-toast')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByText('internal provider error')).not.toBeInTheDocument()
  })

  it('shows the provider-link callback result', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com' }),
      logout: async () => ({}),
      getOAuthProviders: async () => ['google'],
      listLinkedAccounts: async () => [{ provider: 'google' }],
    }

    render(
      <MemoryRouter initialEntries={['/security?linked=google']}>
        <AuthProvider api={api}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect((await screen.findByText('Google sign-in method linked.')).closest('.hhc-toast')).toBeInTheDocument()
  })

  it('does not trust a forged provider-link success query', async () => {
    render(
      <MemoryRouter initialEntries={['/security?linked=google']}>
        <AuthProvider api={{
          login: async () => ({ access_token: 'token' }),
          refreshAccessToken: async () => 'token',
          me: async () => ({ id: 'u1', email: 'ray@example.com' }),
          logout: async () => ({}),
          getOAuthProviders: async () => ['google'],
          listLinkedAccounts: async () => [],
        }}>
          <SecurityPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Google')
    expect(screen.queryByText('Google sign-in method linked.')).not.toBeInTheDocument()
  })
})
