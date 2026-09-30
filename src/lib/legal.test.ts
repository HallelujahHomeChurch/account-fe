import { expect, it } from 'vitest'
import { AccountApi } from './api'
it('uses the existing authenticated transport for scoped legal status', async () => {
  const calls: RequestInit[] = []
  const api = new AccountApi({
    baseUrl: '/api/account/v1',
    getAccessToken: () => 'access',
    fetcher: async (input, init) => {
      expect(String(input)).toBe('/api/account/v1/me/legal/status?locale=en')
      calls.push(init ?? {})
      return new Response(JSON.stringify({ required: false }), {
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  await expect(api.legal.status('en')).resolves.toEqual({ required: false })
  expect(new Headers(calls[0].headers).get('Authorization')).toBe(
    'Bearer access',
  )
  expect(calls[0].cache).toBe('no-store')
})
