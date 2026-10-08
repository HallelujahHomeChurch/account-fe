import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/auth-context'
import { LocaleProvider } from '../../i18n/locale-context'
import {
  disableBrowserServicePush,
  enableBrowserServicePush,
  getBrowserServicePushState,
} from '../../lib/browser-service-push'
import { BrowserServicePushControl } from './BrowserServicePushControl'
vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../lib/browser-service-push', () => ({
  getBrowserServicePushState: vi.fn(),
  enableBrowserServicePush: vi.fn(),
  disableBrowserServicePush: vi.fn(),
}))
const api = { getPushConfig: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  api.getPushConfig.mockResolvedValue({ enabled: true, publicKey: 'public' })
  vi.mocked(useAuth).mockReturnValue({
    profile: { id: 'member' },
    serviceApi: api,
  } as never)
  vi.mocked(getBrowserServicePushState).mockResolvedValue('off')
})
function mount() {
  render(
    <LocaleProvider>
      <BrowserServicePushControl />
    </LocaleProvider>,
  )
}
it('requires explicit opt-in and reflects successful registration', async () => {
  mount()
  const control = await screen.findByRole('switch', {
    name: 'Notifications on this browser',
  })
  await waitFor(() => expect(control).not.toBeDisabled())
  expect(enableBrowserServicePush).not.toHaveBeenCalled()
  vi.mocked(getBrowserServicePushState).mockResolvedValue('on')
  await userEvent.click(screen.getByText('Notifications on this browser'))
  await waitFor(() => expect(control).toBeChecked())
  expect(enableBrowserServicePush).toHaveBeenCalledWith(
    api,
    'member',
    'public',
    expect.any(AbortSignal),
  )
})
it('explains denied permission without requesting it again', async () => {
  vi.mocked(getBrowserServicePushState).mockResolvedValue('denied')
  mount()
  expect(
    await screen.findByText(
      'Notifications are blocked. Allow them in your browser settings.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('switch')).toBeDisabled()
  expect(enableBrowserServicePush).not.toHaveBeenCalled()
})
it('does not show browser delivery as available while the server flag is disabled', async () => {
  api.getPushConfig.mockResolvedValue({ enabled: false })
  mount()
  await waitFor(() =>
    expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
  )
  expect(getBrowserServicePushState).not.toHaveBeenCalled()
})
it('leaves registration errors visible with a retry', async () => {
  vi.mocked(enableBrowserServicePush).mockRejectedValue(new Error('offline'))
  mount()
  await waitFor(() => expect(screen.getByRole('switch')).not.toBeDisabled())
  await userEvent.click(screen.getByText('Notifications on this browser'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to update browser notifications',
  )
  expect(screen.getByRole('switch')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
})

it('retries cleanup instead of enabling an uncertain subscription', async () => {
  vi.mocked(getBrowserServicePushState).mockResolvedValue('pending')
  mount()
  const retry = await screen.findByRole('button', { name: 'Retry' })
  expect(screen.getByRole('switch')).toBeDisabled()
  vi.mocked(getBrowserServicePushState).mockResolvedValue('off')
  await userEvent.click(retry)
  await waitFor(() =>
    expect(disableBrowserServicePush).toHaveBeenCalledWith(api, 'member'),
  )
  expect(enableBrowserServicePush).not.toHaveBeenCalled()
})
it('resets busy state when the account changes during registration', async () => {
  let finish!: () => void
  vi.mocked(enableBrowserServicePush).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const view = render(
    <LocaleProvider>
      <BrowserServicePushControl />
    </LocaleProvider>,
  )
  await waitFor(() => expect(screen.getByRole('switch')).not.toBeDisabled())
  await userEvent.click(screen.getByText('Notifications on this browser'))
  expect(screen.getByRole('switch')).toBeDisabled()
  vi.mocked(useAuth).mockReturnValue({
    profile: { id: 'new-member' },
    serviceApi: api,
  } as never)
  view.rerender(
    <LocaleProvider>
      <BrowserServicePushControl />
    </LocaleProvider>,
  )
  await waitFor(() => expect(screen.getByRole('switch')).not.toBeDisabled())
  finish()
})
