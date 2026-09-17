import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './auth-context'
import { readRuntimeConfig } from '../lib/redirects'

afterEach(() => vi.unstubAllGlobals())

it('uses the shared runtime for an authenticated empty permission list without refreshing', async () => {
  document.cookie = 'hhc_sso_hint=; Max-Age=0; Path=/'
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/session')) {
      return json({
        authenticated: true,
        user: { id: 'user-1', email: 'user@example.test', display_name: 'User', avatar_url: null },
        permissions: [],
        permission_availability: { status: 'available' },
      })
    }
    if (url.endsWith('/csrf-token')) return json({ csrf_token: 'csrf-token' })
    if (url.endsWith('/session/access-token')) return json({ access_token: 'access-token', expires_in: 900 })
    if (url.endsWith('/me')) return json({ id: 'user-1', email: 'user@example.test', permissions: [] })
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetcher)

  render(
    <AuthProvider config={readRuntimeConfig({}, new URL('https://account.alive.org.tw/profile'))}>
      <StatusProbe />
    </AuthProvider>,
  )

  expect(await screen.findByText('authenticated')).toBeInTheDocument()
  expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/refresh'))).toBe(false)
})

function StatusProbe() {
  return <span>{useAuth().status}</span>
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}
