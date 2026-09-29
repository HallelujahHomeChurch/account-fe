import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { externalBrowserHref, LineBrowserNotice } from './LineBrowserNotice'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><LineBrowserNotice /><Link to="/profile">Profile</Link></MemoryRouter>)
}

describe('Account LINE browser notice', () => {
  it('does not change ordinary browser pages', () => {
    renderAt('/login')
    expect(screen.queryByRole('complementary', { name: 'Browser opening notice' })).not.toBeInTheDocument()
  })

  it('opens a normal login URL externally and stays dismissed during navigation', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
    renderAt('/login?return_to=%2Fprofile#form')
    const url = new URL(screen.getByRole('link', { name: 'Open in default browser' }).getAttribute('href')!)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('return_to')).toBe('/profile')
    expect(url.searchParams.get('openExternalBrowser')).toBe('1')
    expect(url.hash).toBe('#form')
    await userEvent.click(screen.getByRole('button', { name: 'Close browser notice and stay on this page' }))
    await userEvent.click(screen.getByRole('link', { name: 'Profile' }))
    expect(screen.queryByRole('complementary', { name: 'Browser opening notice' })).not.toBeInTheDocument()
  })

  it.each(['/login', '/register', '/register/check-email', '/forgot-password'])('shows re-entry guidance on %s instead of copying an active auth request', (path) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
    renderAt(`${path}?auth_request_id=request-1`)
    expect(screen.getByText(/Reopen the original website link/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open in default browser' })).not.toBeInTheDocument()
    expect(screen.queryByText(/use LINE's menu to open this page/)).not.toBeInTheDocument()
  })

  it.each(['/oauth/callback?code=once', '/policy/acceptance#token=once', '/line/bind', '/reset-password#token=once', '/verify-email#token=once'])('does not offer handoff on %s', (path) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
    renderAt(path)
    expect(screen.queryByRole('complementary', { name: 'Browser opening notice' })).not.toBeInTheDocument()
  })

  it.each(['/verify-email', '/reset-password'])('shows the notice on %s without a token', (path) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
    renderAt(path)
    expect(screen.getByRole('link', { name: 'Open in default browser' })).toBeInTheDocument()
  })

  it('replaces an existing LINE parameter once', () => {
    const url = new URL(externalBrowserHref('/profile?openExternalBrowser=0&item=1#section', 'https://account.alive.org.tw'))
    expect(url.searchParams.getAll('openExternalBrowser')).toEqual(['1'])
    expect(url.searchParams.get('item')).toBe('1')
    expect(url.hash).toBe('#section')
  })

  it('keeps dismissal after remount when session storage is unavailable', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied') })
    const first = renderAt('/login')
    await userEvent.click(screen.getByRole('button', { name: 'Close browser notice and stay on this page' }))
    first.unmount()

    renderAt('/profile')
    expect(screen.queryByRole('complementary', { name: 'Browser opening notice' })).not.toBeInTheDocument()
  })
})
