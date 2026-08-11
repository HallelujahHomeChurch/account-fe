import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { ThemeProvider } from '../theme/theme-context'
import { ProfilePage } from './ProfilePage'

vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="avatar-cropper" />,
}))

describe('ProfilePage', () => {
  it.each([
    ['ja', 'プロフィール', 'メールアドレス確認済み'],
    ['ko', '개인 정보', '이메일 인증 완료'],
  ])('renders authenticated profile in %s', async (locale, heading, verified) => {
    document.cookie = `hhc_locale=${locale}; Path=/`
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', first_name: 'Ray', is_email_verified: true }),
      logout: async () => ({}),
    }
    render(<MemoryRouter><LocaleProvider><AuthProvider api={api}><ProfilePage /></AuthProvider></LocaleProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(verified)).toBeInTheDocument()
  })

  it('uses the shared hhc_locale cookie for localized profile labels', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        first_name: 'Ray',
        last_name: 'Self',
        avatar_url: '',
        is_email_verified: true,
      }),
      logout: async () => ({}),
    }

    render(
      <MemoryRouter>
        <LocaleProvider>
          <AuthProvider api={api}>
            <ProfilePage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '個人化' })).toBeInTheDocument()
    expect(screen.getByText('Email 已驗證')).toBeInTheDocument()
    expect(screen.queryByLabelText('名字')).not.toBeInTheDocument()
  })

  it('keeps system-only account state out of the profile page', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        first_name: 'Ray',
        last_name: 'Self',
        avatar_url: '',
        roles: ['account.admin'],
        permissions: ['*'],
        is_email_verified: true,
        is_active: true,
      }),
      logout: async () => ({}),
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /personal info/i })).toBeInTheDocument()
    expect(screen.queryByText(/account state/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/roles/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/active/i)).not.toBeInTheDocument()
  })

  it('stores an explicit appearance preference in the shared theme cookie', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        first_name: 'Ray',
        last_name: 'Self',
        avatar_url: '',
        is_email_verified: true,
      }),
      logout: async () => ({}),
    }

    render(
      <MemoryRouter>
        <LocaleProvider>
          <ThemeProvider>
            <AuthProvider api={api}>
              <ProfilePage />
            </AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Appearance')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }))

    expect(document.cookie).toContain('hhc_theme=dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('updates names without sending the legacy avatar URL', async () => {
    let updateBody: unknown
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        first_name: 'Ray',
        last_name: 'Self',
        avatar_url: 'https://cdn.example.com/ray.png',
        roles: ['account.admin'],
        is_email_verified: true,
        is_active: true,
      }),
      logout: async () => ({}),
      updateProfile: async (body) => {
        updateBody = body
        return { message: 'Profile updated successfully' }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Ray Self')).toBeInTheDocument()
    expect(screen.queryByLabelText('Avatar URL')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /edit name/i }))

    const firstName = await screen.findByLabelText('First name')
    await userEvent.clear(firstName)
    await userEvent.type(firstName, 'Raymond')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(updateBody).toEqual({
      first_name: 'Raymond',
      last_name: 'Self',
    })
  })

  it('keeps profile update errors inside the open dialog', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', first_name: 'Ray' }),
      logout: async () => ({}),
      updateProfile: async () => { throw new ApiError(500, 'database host and query leaked') },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /edit name/i }))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to update your profile. Try again.')
    expect(alert).not.toHaveTextContent('database host and query leaked')
    expect(alert.closest('[role="dialog"]')).toBeInTheDocument()
  })

  it('does not expose avatar API errors', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        avatar_source: 'custom',
        avatar_status: 'ready',
      }),
      logout: async () => ({}),
      deleteAvatar: async () => { throw new ApiError(500, 'blob account secret leaked') },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /change profile picture/i }))
    await userEvent.click(screen.getByRole('button', { name: /remove photo/i }))

    expect(await screen.findByText('Unable to update your profile picture. Try again.')).toBeInTheDocument()
    expect(screen.queryByText('blob account secret leaked')).not.toBeInTheDocument()
  })

  it('opens avatar management and removes the current custom avatar', async () => {
    let removed = false
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        first_name: 'Ray',
        last_name: 'Self',
        avatar_url: 'https://www.alive.org.tw/api/assets/public/avatar-1',
        avatar_source: 'custom',
        avatar_status: 'ready',
      }),
      logout: async () => ({}),
      deleteAvatar: async () => {
        removed = true
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /change profile picture/i }))
    expect(await screen.findByRole('heading', { name: /profile picture/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove photo/i }))

    expect(removed).toBe(true)
  })

  it('keeps provider avatars and shows asynchronous processing state', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({
        id: 'u1',
        email: 'ray@example.com',
        avatar_url: 'https://provider.example/avatar.jpg',
        avatar_source: 'provider',
        avatar_status: 'processing',
      }),
      logout: async () => ({}),
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Checking the new photo...')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /change profile picture/i }))
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('validates selected avatar files before opening the cropper', async () => {
    const api: AuthApi = {
      login: async () => ({ access_token: 'token' }),
      refreshAccessToken: async () => 'token',
      me: async () => ({ id: 'u1', email: 'ray@example.com', first_name: 'Ray' }),
      logout: async () => ({}),
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /change profile picture/i }))
    const input = screen.getByLabelText(/choose photo/i)
    await userEvent.upload(
      input,
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'avatar.jpg', { type: 'image/jpeg' }),
    )

    expect(await screen.findByText(/jpeg, png, or webp/i)).toBeInTheDocument()
    expect(screen.queryByTestId('avatar-cropper')).not.toBeInTheDocument()
  })
})
