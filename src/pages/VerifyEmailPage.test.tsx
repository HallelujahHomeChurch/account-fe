import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { VerifyEmailPage } from './VerifyEmailPage'

describe('VerifyEmailPage', () => {
  it('verifies the email token from the link', async () => {
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
      <MemoryRouter initialEntries={['/verify-email?token=verify-token']}>
        <AuthProvider api={api}>
          <VerifyEmailPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Email verified successfully')).toBeInTheDocument()
    expect(submittedToken).toBe('verify-token')
  })
})
