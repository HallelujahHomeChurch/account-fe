import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { ToastProvider } from '@hallelujahhomechurch/ui'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider, useLocale } from '../i18n/locale-context'
import { NewsletterPreferenceRow } from '../components/NewsletterPreferenceRow'

it.each([
  ['ja', 'メール通知', '通知設定を更新しました。'],
  ['ko', '이메일 알림', '알림 설정을 업데이트했어요.'],
])('uses %s copy and cookie for notification preference updates', async (locale, label, updated) => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  const updateNewsletterPreference = vi.fn(async () => {
    expect(document.cookie).toContain(`hhc_locale=${locale}`)
    return { status: 'subscribed' as const }
  })
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }), logout: async () => ({}),
    getNewsletterPreference: async () => ({ status: 'not_subscribed' }), updateNewsletterPreference,
  }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)

  await userEvent.click(await screen.findByRole('switch', { name: label }))
  expect(updateNewsletterPreference).toHaveBeenCalledWith(true)
  expect(await screen.findByText(updated)).toBeInTheDocument()
})

it('loads and updates the newsletter preference', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const updateNewsletterPreference = vi.fn(async () => ({ status: 'subscribed' as const }))
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }),
    refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    logout: async () => ({}),
    getNewsletterPreference: async () => ({ status: 'not_subscribed' }),
    updateNewsletterPreference,
  }
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider dismissLabel="Dismiss">
          <AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  const toggle = await screen.findByRole('switch', { name: 'Email notifications' })
  expect(toggle).not.toBeChecked()
  await userEvent.click(toggle)
  expect(updateNewsletterPreference).toHaveBeenCalledWith(true)
  expect(toggle).toBeChecked()
  expect(await screen.findByText('Notification preference updated.')).toBeInTheDocument()
})

it('shows a retry state instead of a switch when loading preferences fails', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn()
    .mockRejectedValueOnce(new Error('service unavailable'))
    .mockResolvedValueOnce({ status: 'not_subscribed' as const })
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }),
    refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    logout: async () => ({}),
    getNewsletterPreference,
    updateNewsletterPreference: async () => ({ status: 'subscribed' }),
  }
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider dismissLabel="Dismiss">
          <AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load notification settings.')
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByRole('switch', { name: 'Email notifications' })).not.toBeChecked()
  expect(getNewsletterPreference).toHaveBeenCalledTimes(2)
})


it('shows pending as a requested subscription and allows cancellation without confirming it', async () => {
  const updateNewsletterPreference = vi.fn(async () => ({ status: 'unsubscribed' as const }))
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.com' }), logout: async () => ({}),
    getNewsletterPreference: async () => ({ status: 'pending' }), updateNewsletterPreference,
  }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  const toggle = await screen.findByRole('switch', { name: 'Email notifications' })
  expect(toggle).toBeChecked()
  expect(screen.getByText('Pending confirmation')).toBeInTheDocument()
  expect(updateNewsletterPreference).not.toHaveBeenCalled()
  await userEvent.click(toggle)
  expect(updateNewsletterPreference).toHaveBeenCalledWith(false)
  expect(toggle).not.toBeChecked()
})


it('keeps a successful preference update when the user changes language during the request', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  let finishUpdate!: (value: { status: 'subscribed' }) => void
  let finishStaleRead!: (value: { status: 'not_subscribed' }) => void
  const update = new Promise<{ status: 'subscribed' }>(resolve => { finishUpdate = resolve })
  const staleRead = new Promise<{ status: 'not_subscribed' }>(resolve => { finishStaleRead = resolve })
  const getNewsletterPreference = vi.fn().mockResolvedValueOnce({ status: 'not_subscribed' }).mockReturnValue(staleRead)
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}),
    getNewsletterPreference, updateNewsletterPreference: async () => update,
  }
  function ChangeLanguage() {
    const { setLocale } = useLocale()
    return <button onClick={() => setLocale('zh-Hant')}>Change language</button>
  }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><ChangeLanguage /><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('switch'))
  await userEvent.click(screen.getByRole('button', { name: 'Change language' }))
  await act(async () => { finishUpdate({ status: 'subscribed' }) })
  await act(async () => { finishStaleRead({ status: 'not_subscribed' }) })
  expect(await screen.findByRole('switch', { name: 'Email 通知' })).toBeChecked()
  expect(getNewsletterPreference).toHaveBeenCalledTimes(1)
})

it('translates an existing load failure without retrying it on language changes', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn().mockRejectedValue(new Error('offline'))
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}), getNewsletterPreference,
  }
  function ChangeLanguage() {
    const { setLocale } = useLocale()
    return <button onClick={() => setLocale('zh-Hant')}>Change language</button>
  }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><ChangeLanguage /><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load notification settings.')
  await userEvent.click(screen.getByRole('button', { name: 'Change language' }))
  expect(screen.getByRole('alert')).not.toHaveTextContent('Unable to load notification settings.')
  expect(getNewsletterPreference).toHaveBeenCalledTimes(1)
})

it('shows durable pending without success and refreshes without another consent command', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn().mockResolvedValueOnce({ status: 'not_subscribed' }).mockResolvedValueOnce({ status: 'subscribed', handoffState: 'completed' })
  const updateNewsletterPreference = vi.fn().mockResolvedValue({ status: 'pending', handoffState: 'pending' })
  const api: AuthApi = { login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token', me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}), getNewsletterPreference, updateNewsletterPreference }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('switch'))
  expect(await screen.findByText('Your request is saved and still processing.')).toBeInTheDocument()
  expect(screen.queryByText('Notification preference updated.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Check status' }))
  expect(await screen.findByRole('switch')).toBeChecked()
  expect(updateNewsletterPreference).toHaveBeenCalledTimes(1)
})

it('requires a fresh explicit choice after renewal and keeps completed history separate from current status', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const updateNewsletterPreference = vi.fn().mockResolvedValue({ status: 'unsubscribed', handoffState: 'completed' })
  const api: AuthApi = { login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token', me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}), getNewsletterPreference: async () => ({ status: 'unsubscribed', handoffState: 'needs-renewal' }), updateNewsletterPreference }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  expect(await screen.findByText('Please confirm a new choice to subscribe.')).toBeInTheDocument()
  expect(updateNewsletterPreference).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Subscribe again' }))
  expect(updateNewsletterPreference).toHaveBeenCalledWith(true)
  expect(screen.getByRole('switch')).not.toBeChecked()
})

it('keeps unsubscribe pending and reads status after an uncertain reply', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn().mockResolvedValue({ status: 'subscribed', handoffState: 'pending' })
  const updateNewsletterPreference = vi.fn().mockRejectedValue(new Error('lost reply'))
  const api: AuthApi = { login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token', me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}), getNewsletterPreference, updateNewsletterPreference }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  const toggle = await screen.findByRole('switch')
  expect(toggle).toBeChecked()
  await userEvent.click(toggle)
  expect(await screen.findByText('The result is uncertain. Check status before trying again.')).toBeInTheDocument()
  expect(toggle).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Check status' }))
  expect(await screen.findByRole('switch')).toBeChecked()
  expect(updateNewsletterPreference).toHaveBeenCalledTimes(1)
  expect(getNewsletterPreference).toHaveBeenCalledTimes(2)
})

it('requires status readback after a lost renewal reply before another explicit choice', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const getNewsletterPreference = vi.fn().mockResolvedValue({ status: 'unsubscribed', handoffState: 'needs-renewal' })
  const updateNewsletterPreference = vi.fn().mockRejectedValue(new Error('lost renewal reply'))
  const api: AuthApi = { login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token', me: async () => ({ id: 'u1', email: 'user@example.test' }), logout: async () => ({}), getNewsletterPreference, updateNewsletterPreference }
  render(<MemoryRouter><LocaleProvider><ToastProvider dismissLabel="Dismiss"><AuthProvider api={api}><NewsletterPreferenceRow /></AuthProvider></ToastProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: 'Subscribe again' }))
  expect(await screen.findByText('The result is uncertain. Check status before trying again.')).toBeInTheDocument()
  const renewal = screen.getByRole('button', { name: 'Subscribe again' })
  expect(renewal).toBeDisabled()
  await userEvent.click(renewal)
  expect(updateNewsletterPreference).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Check status' }))
  expect(await screen.findByRole('button', { name: 'Subscribe again' })).toBeEnabled()
  expect(getNewsletterPreference).toHaveBeenCalledTimes(2)
  expect(updateNewsletterPreference).toHaveBeenCalledTimes(1)
})
