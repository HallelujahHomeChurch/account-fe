import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { ForgotPasswordPage } from './ForgotPasswordPage'

describe('ForgotPasswordPage', () => {
  it('requests a password reset email', async () => {
    let submittedEmail = ''
    const api: AuthApi = {
      login: async () => ({}),
      me: async () => ({ id: 'u1', email: 'user@example.com' }),
      refreshAccessToken: async () => null,
      logout: async () => ({}),
      forgotPassword: async (email: string) => {
        submittedEmail = email
        return { message: 'If the email exists, a reset link has been sent.' }
      },
    }

    render(
      <MemoryRouter>
        <AuthProvider api={api}>
          <ForgotPasswordPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(submittedEmail).toBe('user@example.com')
    expect(await screen.findByText('If this email is registered, we sent a password reset link.')).toBeInTheDocument()
  })
})
