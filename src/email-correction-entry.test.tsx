import { act, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
vi.mock('./account-entry', () => { throw new Error('Public entry must not import the authenticated application') })
vi.mock('./observability', () => { throw new Error('Public entry must not import telemetry') })
vi.mock('./auth/auth-context', () => { throw new Error('Public entry must not import the session provider') })
it('boots the actual public root before auth or telemetry and never verifies on GET', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  history.replaceState(null, '', '/data-requests/verify-email#token=secret-from-mail')
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ dataRequests: { emailCorrection: { enabled: true } } }), { status: 200 })); vi.stubGlobal('fetch', fetcher)
  await act(async () => { await import('./main'); await vi.dynamicImportSettled() })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm verification' })).toBeInTheDocument())
  expect(location.hash).toBe('')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0]).toEqual(['/api/account/v1/oauth-providers', expect.objectContaining({ method: 'GET', credentials: 'omit', redirect: 'error' })])
  vi.unstubAllGlobals()
})
