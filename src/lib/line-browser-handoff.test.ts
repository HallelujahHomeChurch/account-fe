import { describe, expect, it } from 'vitest'
import { externalBrowserHref, shouldOfferLineHandoff } from './line-browser-handoff'

const origin = 'https://account.alive.org.tw'
const line = 'Mozilla/5.0 LINE/15.0.0'

describe('LINE browser handoff selection', () => {
  it.each(['/', '/login', '/profile?item=1#section', '/users?page=2#detail', '/?openExternalBrowser=1'])('gates LINE entry %s', path => {
    expect(shouldOfferLineHandoff(new URL(path, origin), line)).toBe(true)
  })
  it.each(['Mozilla/5.0 Safari/605.1.15', 'facebookexternalhit/1.1', 'NOTLINE/15.0'])('preserves an ordinary browser: %s', userAgent => {
    expect(shouldOfferLineHandoff(new URL('/login', origin), userAgent)).toBe(false)
  })
  it('preserves path, query and fragment while replacing duplicate flags once', () => {
    const url = new URL(externalBrowserHref(`${origin}/login?openExternalBrowser=0&openExternalBrowser=0&return_to=%2Fprofile#form`))
    expect(url.origin).toBe(origin)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('return_to')).toBe('/profile')
    expect(url.searchParams.getAll('openExternalBrowser')).toEqual(['1'])
    expect(url.hash).toBe('#form')
  })

  it.each(['/oauth/callback?code=once', '/oauth/callback/?code=once', '/native-auth-complete', '/oauth/link', '/oauth/onboarding', '/policy/acceptance#token=once', '/line/bind', '/data-requests/verify-email#token=once', '/reset-password#token=once', '/reset-password/?token=once', '/verify-email?token=once'])('retains the sensitive flow on %s', path => {
    expect(shouldOfferLineHandoff(new URL(path, origin), line)).toBe(false)
  })

  it.each(['/verify-email', '/reset-password', '/login?auth_request_id=browser-bound'])('gates %s before account bootstrap', path => {
    expect(shouldOfferLineHandoff(new URL(path, origin), line)).toBe(true)
  })
})
