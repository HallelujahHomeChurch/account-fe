import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
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

    expect(await screen.findByText('個人化')).toBeInTheDocument()
    expect(screen.getByLabelText('名字')).toBeInTheDocument()
  })

  it('submits profile updates to account-api', async () => {
    let updateBody: unknown
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

    const firstName = await screen.findByLabelText('First name')
    await userEvent.clear(firstName)
    await userEvent.type(firstName, 'Raymond')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(updateBody).toMatchObject({ first_name: 'Raymond', last_name: 'Self', avatar_url: '' })
  })
})
