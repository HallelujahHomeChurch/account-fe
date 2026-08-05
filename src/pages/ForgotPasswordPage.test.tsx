import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { messages } from '../i18n/messages'
import { ForgotPasswordPage } from './ForgotPasswordPage'

describe('ForgotPasswordPage', () => {
  it('requests a password reset email', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
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
        <LocaleProvider>
          <AuthProvider api={api}>
            <ForgotPasswordPage />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: '寄送重設連結' }))

    expect(submittedEmail).toBe('user@example.com')
    const success = await screen.findByRole('status')
    expect(success).toHaveTextContent('我們已寄出密碼重設連結。')
    expect(success).toHaveClass('auth-completion')
    expect(screen.getByRole('heading', { name: '請查看信箱' })).toBeInTheDocument()
    expect(screen.queryByText('輸入 Email，我們會寄送密碼重設連結。')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回登入' })).toBeInTheDocument()
    expect(document.querySelector('.form-success')).not.toBeInTheDocument()
  })

  it('provides localized recovery completion copy', () => {
    expect(messages['zh-Hant'].passwordRecovery).toMatchObject({
      sentTitle: '請查看信箱',
      sent: '我們已寄出密碼重設連結。',
      resetSuccess: '密碼已重設',
      resetSuccessDescription: '現在可以使用新密碼登入。',
    })
    expect(messages['zh-Hans'].passwordRecovery.resetSuccessDescription).toBe(
      '现在可以使用新密码登录。',
    )
    expect(messages.en.passwordRecovery.resetSuccessDescription).toBe(
      'You can now sign in with your new password.',
    )
  })
})
