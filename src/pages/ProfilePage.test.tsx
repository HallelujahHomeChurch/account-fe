import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ThemeProvider } from '../theme/theme-context'
import { ProfilePage } from './ProfilePage'

describe('ProfilePage', () => {
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

  it('updates names from a dialog while preserving the current avatar URL', async () => {
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

    expect(updateBody).toMatchObject({
      first_name: 'Raymond',
      last_name: 'Self',
      avatar_url: 'https://cdn.example.com/ray.png',
    })
  })
})
