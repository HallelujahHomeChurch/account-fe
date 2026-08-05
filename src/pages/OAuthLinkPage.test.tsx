import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { OAuthLinkPage } from './OAuthLinkPage'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('OAuthLinkPage', () => {
  it('requires explicit confirmation for a token from the URL fragment', async () => {
    const user = userEvent.setup()
    let submittedToken = ''
    window.history.replaceState(null, '', '/oauth/link#token=link-token')
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      confirmOAuthLink: async (token: string) => {
        submittedToken = token
        return { message: 'linked' }
      },
    }

    render(
      <MemoryRouter initialEntries={['/oauth/link']}>
        <LocaleProvider>
          <AuthProvider api={api}>
            <OAuthLinkPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(document.querySelector('.login-card')).toBeInTheDocument()

    expect(submittedToken).toBe('')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Social sign-in method linked.')
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
    expect(document.querySelector('.form-notice')).not.toBeInTheDocument()
    expect(submittedToken).toBe('link-token')
  })
})
