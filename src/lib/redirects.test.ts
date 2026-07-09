import { describe, expect, it } from 'vitest'

import { isAllowedRedirect, readRuntimeConfig, type RuntimeConfig } from './redirects'

const config: RuntimeConfig = {
  accountApiBaseUrl: '/api/account/v1',
  mockApi: false,
  allowedRedirectOrigins: ['https://admin.alive.org.tw', 'http://localhost:5173'],
  allowedRedirectSchemes: ['hhc'],
}

describe('isAllowedRedirect', () => {
  it('allows configured web origins', () => {
    expect(isAllowedRedirect('https://admin.alive.org.tw/oauth/callback?code=1', config)).toBe(true)
    expect(isAllowedRedirect('http://localhost:5173/oauth/callback?code=1', config)).toBe(true)
  })

  it('allows configured desktop callback schemes', () => {
    expect(isAllowedRedirect('hhc://callback?code=1&state=ok', config)).toBe(true)
  })

  it('blocks unconfigured origins and invalid URLs', () => {
    expect(isAllowedRedirect('https://evil.example/oauth/callback', config)).toBe(false)
    expect(isAllowedRedirect('/relative/callback', config)).toBe(false)
    expect(isAllowedRedirect('not a url', config)).toBe(false)
  })

  it('enables account-api mock mode from runtime env', () => {
    expect(readRuntimeConfig({ VITE_ACCOUNT_API_MOCK: 'true' }).mockApi).toBe(true)
    expect(readRuntimeConfig({ VITE_ACCOUNT_API_MOCK: 'false' }).mockApi).toBe(false)
  })
})
