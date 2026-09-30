import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { LegalReviewPage } from './LegalReviewPage'

it('does not request or show private documents without qualified status', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const challenge = vi.fn()
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    legal: {
      status: async () => ({ required: false }),
      history: async () => [],
      challenge,
      confirm: vi.fn(),
      historyEntry: vi.fn(),
    },
  }
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}>
          <LegalReviewPage />
        </AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Acceptance history' })
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument(),
  )
  expect(challenge).not.toHaveBeenCalled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})
