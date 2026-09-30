import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider, useLocale } from '../i18n/locale-context'
import { MemberDetailsError } from '../lib/member-details'
import { MemberDetailsPage } from './MemberDetailsPage'

const transport = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/member-details', async original => ({ ...await original<typeof import('../lib/member-details')>(), MemberDetailsClient: class { load = transport.load; save = transport.save; remove = transport.remove } }))
const etag = '"b021b2c8-40b5-4f6a-8051-c30f6d0e9d22"'
const initial = { familyName: 'SyntheticPrivate', givenName: null, gender: null, identityDocument: null, mobile: null }
function MemberRoutes() { return <Routes><Route path="/profile/member-details" element={<MemberDetailsPage />} /><Route path="/profile" element={<h1>General profile</h1>} /></Routes> }
function LocaleControl() { const { setLocale } = useLocale(); return <button onClick={() => setLocale('zh-Hant')}>Change locale</button> }
function page() {
 const access = vi.fn().mockResolvedValue({ memberDetailsEligible: true })
 const api: AuthApi = { login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token', me: async () => ({ id: 'owner', email: 'owner@example.test' }), logout: async () => ({}), memberTransportFetch: vi.fn() }
 const router = createMemoryRouter([{ path: '*', element: <LocaleProvider><LocaleControl /><AuthProvider api={api} operationsApi={{ getMyAccess: access } as never}><MemberRoutes /></AuthProvider></LocaleProvider> }], { initialEntries: ['/profile/member-details'] })
 const view = render(<RouterProvider router={router} />)
 return { ...view, access }
}
beforeEach(() => {
 document.cookie = 'hhc_locale=en'; document.documentElement.lang = 'en'; vi.spyOn(window, 'confirm').mockReturnValue(true); vi.clearAllMocks(); transport.load.mockResolvedValue({ details: initial, etag }); transport.save.mockResolvedValue(etag); transport.remove.mockResolvedValue(undefined)
})
describe('private member form', () => {
 it('shows optional ordinary fields without lock controls and submits a replacement', async () => {
  page()
  const field = await screen.findByLabelText('Family name')
  expect(field).toHaveValue('SyntheticPrivate')
  expect(screen.getByLabelText('Gender')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /unlock|lock/i })).not.toBeInTheDocument()
  await userEvent.clear(field); await userEvent.type(field, 'UpdatedPrivate')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(transport.save).toHaveBeenCalledWith({ ...initial, familyName: 'UpdatedPrivate' }, etag, expect.any(AbortSignal)))
 })
 it('preserves an unsaved draft when key bootstrap fails before submission', async () => {
  transport.save.mockRejectedValue(new MemberDetailsError('unavailable', 503, false))
  page(); const field = await screen.findByLabelText('Family name')
  await userEvent.clear(field); await userEvent.type(field, 'UnsavedPrivate'); await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('alert'); expect(field).toHaveValue('UnsavedPrivate'); expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
 })
 it('retains a draft but blocks writes until GET reconciles an uncertain result', async () => {
  transport.save.mockRejectedValue(new MemberDetailsError('unavailable', 503, true))
  page(); const field = await screen.findByLabelText('Family name')
  await userEvent.type(field, 'Draft'); await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByRole('button', { name: 'Reload' }); expect(field).toHaveValue('SyntheticPrivateDraft'); expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
  await waitFor(() => expect(transport.load).toHaveBeenCalledTimes(2))
 })
 it('clears fields when fresh qualification is revoked on focus', async () => {
  const { access } = page(); await screen.findByLabelText('Family name')
  access.mockResolvedValue({ memberDetailsEligible: false })
  act(() => window.dispatchEvent(new Event('focus')))
  await screen.findByRole('heading', { name: 'General profile' }); expect(screen.queryByDisplayValue('SyntheticPrivate')).not.toBeInTheDocument()
 })
 it('aborts in-flight private requests when leaving the page', async () => {
  const view = page(); await screen.findByLabelText('Family name')
  const signal = transport.load.mock.calls[0][0] as AbortSignal
  view.unmount(); expect(signal.aborted).toBe(true); expect(screen.queryByDisplayValue('SyntheticPrivate')).not.toBeInTheDocument()
 })
})

it('preserves a draft and blocks writes during a transient qualification failure', async () => {
 const { access } = page(); const field = await screen.findByLabelText('Family name')
 await userEvent.type(field, 'Draft'); access.mockRejectedValue(new Error('network unavailable'))
 act(() => window.dispatchEvent(new Event('focus')))
 await screen.findByRole('button', { name: 'Reload' }); expect(field).toHaveValue('SyntheticPrivateDraft'); expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})
it('keeps the draft available after a CSRF rejection', async () => {
 transport.save.mockRejectedValue(new MemberDetailsError('ACC_CSRF_TOKEN_INVALID', 403))
 page(); const field = await screen.findByLabelText('Family name'); await userEvent.type(field, 'Draft')
 await userEvent.click(screen.getByRole('button', { name: 'Save changes' })); await screen.findByRole('alert')
 expect(field).toHaveValue('SyntheticPrivateDraft'); expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
})
it('keeps the same editor across locale changes', async () => {
 page(); const field = await screen.findByLabelText('Family name'); await userEvent.type(field, 'Draft')
 await userEvent.click(screen.getByRole('button', { name: 'Change locale' }))
 expect(await screen.findByLabelText('姓')).toHaveValue('SyntheticPrivateDraft'); expect(transport.load).toHaveBeenCalledOnce()
})

it('blocks navigation and browser close with an unsaved draft, then allows confirmed discard', async () => {
 page(); const field = await screen.findByLabelText('Family name'); await userEvent.type(field, 'Draft')
 vi.mocked(window.confirm).mockReturnValue(false)
 await userEvent.click(screen.getByRole('link', { name: 'Back to profile' }))
 expect(field).toHaveValue('SyntheticPrivateDraft'); expect(window.confirm).toHaveBeenCalledWith('Discard your unsaved changes?')
 const closing = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(closing); expect(closing.defaultPrevented).toBe(true)
 vi.mocked(window.confirm).mockReturnValue(true)
 await userEvent.click(screen.getByRole('link', { name: 'Back to profile' }))
 await screen.findByRole('heading', { name: 'General profile' })
})
