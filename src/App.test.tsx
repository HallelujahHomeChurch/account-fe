import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'
import { AuthProvider, type AuthApi } from './auth/auth-context'
import { LocaleProvider } from './i18n/locale-context'

const api: AuthApi = {
  login: async () => ({ access_token: 'token' }),
  refreshAccessToken: async () => null,
  me: async () => ({ id: 'u1', email: 'ray@example.com', first_name: 'Ray', last_name: 'Self' }),
  logout: async () => ({}),
}

const signedInApi: AuthApi = {
  ...api,
  refreshAccessToken: async () => 'token',
}

describe('App layout', () => {
  it('does not show account navigation on the login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /hallelujah home church/i })).toBeInTheDocument()
  })

  it('does not show account navigation on email recovery routes', async () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('redirects protected account routes before rendering account navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /hallelujah home church/i })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /account sections/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /account navigation/i })).not.toBeInTheDocument()
  })

  it('shows account navigation and account menu for signed-in account routes', async () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('complementary', { name: /account sections/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /account navigation/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/account menu/i)).toBeInTheDocument()
    expect(document.querySelector('.account-header')).toHaveClass('account-header')
  })

  it('shows a dismissible avatar account dropdown', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider api={signedInApi}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.click(await screen.findByLabelText(/account menu/i))
    expect(await screen.findByText('Hi Ray Self')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('Hi Ray Self')).not.toBeInTheDocument()
  })

  it('localizes the account brand and legal links using canonical public routes', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <LocaleProvider>
          <AuthProvider api={signedInApi}>
            <App />
          </AuthProvider>
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('HHC 帳戶')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '隱私權' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/privacy-policy',
    )
    expect(screen.getByRole('link', { name: '隱私權' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: '條款' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/terms-of-use',
    )
  })
})
