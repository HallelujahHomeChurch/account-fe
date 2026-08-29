import { describe, expect, it } from 'vitest'

import {
  buildNativeAuthCompletionPath,
  buildOAuthRedirectUrl,
  isAllowedRedirect,
  readNativeAuthCallback,
  readRuntimeConfig,
  type RuntimeConfig,
} from './redirects'

const config: RuntimeConfig = {
  accountApiBaseUrl: '/api/account/v1',
  accountAuthorizeBaseUrl: '/api/account/v1',
  accountClientId: 'account-console',
  redirectUri: 'http://localhost/oauth/callback',
  oauthScope: 'openid profile email',
  mockApi: false,
  allowedRedirectOrigins: ['https://admin.alive.org.tw', 'http://localhost:5173'],
  allowedRedirectSchemes: ['hhc-presenter'],
  publicSiteUrl: 'https://www.alive.org.tw',
}

describe('isAllowedRedirect', () => {
  it('allows configured web origins', () => {
    expect(isAllowedRedirect('https://admin.alive.org.tw/oauth/callback?code=1', config)).toBe(true)
    expect(isAllowedRedirect('http://localhost:5173/oauth/callback?code=1', config)).toBe(true)
  })

  it('allows only the HHC Presenter native callback', () => {
    expect(isAllowedRedirect('hhc-presenter://auth/account', config)).toBe(true)

    for (const redirectUri of [
      'hhc://callback',
      'librepresenter://auth/account',
      'hhc-presenter-http://auth/account',
      'hhc-presenter://auth/not-account',
      'hhc-presenter://callback/account',
      'hhc-presenter://user:password@auth/account',
      'hhc-presenter://auth/account?code=existing',
      'hhc-presenter://auth/account?state=existing',
      'hhc-presenter://auth/account#code=existing&state=existing',
      'file:///tmp/account',
      'javascript:alert(1)',
    ]) {
      expect(isAllowedRedirect(redirectUri, config)).toBe(false)
    }
  })

  it('uses HHC Presenter as the default native callback scheme', () => {
    expect(readRuntimeConfig({}).allowedRedirectSchemes).toEqual(['hhc-presenter'])
  })

  it('adds OAuth parameters to the exact native callback without replacing them from a fragment', () => {
    expect(
      buildOAuthRedirectUrl(
        'hhc-presenter://auth/account?tenant=church',
        'issued-code',
        'issued-state',
        config,
      ),
    ).toBe('hhc-presenter://auth/account?tenant=church&code=issued-code&state=issued-state')

    expect(() => buildOAuthRedirectUrl(
      'hhc-presenter://auth/account#code=existing&state=existing',
      'issued-code',
      'issued-state',
      config,
    )).toThrow('Blocked unsafe redirect URI')
  })

  it('blocks unconfigured origins and invalid URLs', () => {
    expect(isAllowedRedirect('https://evil.example/oauth/callback', config)).toBe(false)
    expect(isAllowedRedirect('/relative/callback', config)).toBe(false)
    expect(isAllowedRedirect('not a url', config)).toBe(false)
  })

  it('round-trips only an exact HHC Presenter completion callback through the fragment', () => {
    const callback = 'hhc-presenter://auth/account?code=issued-code&state=issued-state'
    const path = buildNativeAuthCompletionPath(callback, config)

    expect(path).toBe(
      '/native-auth-complete#callback=hhc-presenter%3A%2F%2Fauth%2Faccount%3Fcode%3Dissued-code%26state%3Dissued-state',
    )
    expect(readNativeAuthCallback(path.slice(path.indexOf('#')), config)).toBe(callback)
    expect(
      readNativeAuthCallback('#callback=javascript%3Aalert%281%29', config),
    ).toBeNull()
  })

  it('enables account-api mock mode from runtime env', () => {
    expect(readRuntimeConfig({ VITE_ACCOUNT_API_MOCK: 'true' }).mockApi).toBe(true)
    expect(readRuntimeConfig({ VITE_ACCOUNT_API_MOCK: 'false' }).mockApi).toBe(false)
  })
})
