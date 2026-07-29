import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { VerifyEmailPage } from './VerifyEmailPage'

describe('VerifyEmailPage', () => {
  it('requires an explicit action before verifying the email token', async () => {
    window.history.replaceState(null, '', '/verify-email#token=verify-token')
    const user = userEvent.setup()
    let submittedToken = ''
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      verifyEmail: async (token: string) => {
        submittedToken = token
        return { message: 'Email verified successfully' }
      },
    }

    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <AuthProvider api={api}>
          <VerifyEmailPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(submittedToken).toBe('')
    expect(window.location.hash).toBe('')

    await user.click(screen.getByRole('button', { name: 'Verify email' }))

    expect(await screen.findByText('Email verified successfully')).toBeInTheDocument()
    expect(submittedToken).toBe('verify-token')
  })
})
