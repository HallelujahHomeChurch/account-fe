import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/locale-context'
import { LineBrowserHandoff } from './LineBrowserHandoff'

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, '', '/') })
function show(path = '/login?return_to=%2Fprofile#form') {
  history.replaceState(null, '', path)
  return render(<LocaleProvider><LineBrowserHandoff /></LocaleProvider>)
}

describe('standalone LINE handoff', () => {
  it('opens the dialog with the complete original destination', () => {
    show()
    const dialog = screen.getByRole('dialog', { name: 'Open in your default browser' })
    const url = new URL(within(dialog).getByRole('link', { name: 'Open in default browser' }).getAttribute('href')!)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('return_to')).toBe('/profile')
    expect(url.searchParams.get('openExternalBrowser')).toBe('1')
    expect(url.hash).toBe('#form')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it.each(['cancel', 'escape', 'close'])('keeps the branded page and retry after %s', async action => {
    show()
    const dialog = screen.getByRole('dialog')
    if (action === 'escape') await userEvent.keyboard('{Escape}')
    else await userEvent.click(within(dialog).getByRole('button', { name: action === 'cancel' ? 'Cancel' : 'Close browser prompt' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const retry = screen.getByRole('button', { name: 'Show prompt again' })
    await userEvent.click(retry)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('ignores obsolete dismissals and works without storage', () => {
    sessionStorage.setItem('hhc:account:line-browser-notice:dismissed', '1')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage denied') })
    show()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('does not forward a browser-bound auth request or offer the unsafe manual action', () => {
    show('/login?auth_request_id=browser-bound')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Reopen the original website link/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/use LINE's menu/)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  })
})
