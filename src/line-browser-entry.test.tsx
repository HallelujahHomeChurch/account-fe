import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
vi.mock('./account-entry', () => { throw new Error('LINE must not import the normal application') })
vi.mock('./observability', () => { throw new Error('LINE handoff must not import telemetry') })
vi.mock('./auth/auth-context', () => { throw new Error('LINE handoff must not import auth') })
it('boots the actual isolated root and never starts the original flow after cancel', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  history.replaceState(null, '', '/login?return_to=%2Fprofile#form')
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await act(async () => { await import('./main'); await vi.dynamicImportSettled() })
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Show prompt again' })).toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
  expect(location.pathname).toBe('/login')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
