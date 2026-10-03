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
 it('uses concise controls and submits Taiwan local input as E.164', async () => {
  page(); await screen.findByLabelText('Family name')
  expect(screen.queryByText('These private details do not appear on your general profile.')).not.toBeInTheDocument()
  expect(screen.queryByText('All fields are optional.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Country code/ })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Mobile number'), '0934058627')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(transport.save).toHaveBeenCalledWith({ ...initial, mobile: '+886934058627' }, etag, expect.any(AbortSignal)))
 })
 it('splits an existing international number and preserves it when editing another field', async () => {
  transport.load.mockResolvedValue({ details: { ...initial, mobile: '+819012345678' }, etag })
  page(); const field = await screen.findByLabelText('Family name')
  expect(screen.getByLabelText('Mobile number')).toHaveValue('9012345678')
  await userEvent.type(field, 'Changed')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(transport.save).toHaveBeenCalledWith({ ...initial, familyName: 'SyntheticPrivateChanged', mobile: '+819012345678' }, etag, expect.any(AbortSignal)))
 })
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
 await userEvent.click(screen.getByRole('link', { name: 'Back' }))
 expect(field).toHaveValue('SyntheticPrivateDraft'); expect(window.confirm).toHaveBeenCalledWith('Discard your unsaved changes?')
 const closing = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(closing); expect(closing.defaultPrevented).toBe(true)
 vi.mocked(window.confirm).mockReturnValue(true)
 await userEvent.click(screen.getByRole('link', { name: 'Back' }))
 await screen.findByRole('heading', { name: 'General profile' })
})

it('guards unsaved changes made only to the calling code', async () => {
 page(); await screen.findByLabelText('Family name')
 await userEvent.click(screen.getByRole('button', { name: /Country code/ }))
 await userEvent.click(await screen.findByRole('option', { name: 'Japan +81' }))
 vi.mocked(window.confirm).mockReturnValue(false)
 await userEvent.click(screen.getByRole('link', { name: 'Back' }))
 expect(window.confirm).toHaveBeenCalledWith('Discard your unsaved changes?')
 expect(screen.getByLabelText('Family name')).toBeInTheDocument()
})
it('recognizes a pasted international number and updates its country', async () => {
 page(); await screen.findByLabelText('Family name')
 await userEvent.type(screen.getByLabelText('Mobile number'), '+81 90 1234 5678')
 await userEvent.tab()
 expect(screen.getByRole('button', { name: /Country code/ })).toHaveTextContent('+81 Japan')
 expect(screen.getByLabelText('Mobile number')).toHaveValue('9012345678')
 await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
 await waitFor(() => expect(transport.save).toHaveBeenCalledWith({ ...initial, mobile: '+819012345678' }, etag, expect.any(AbortSignal)))
})
it('rejects unsupported phone extensions and clears all details on confirmation', async () => {
 page(); await screen.findByLabelText('Family name')
 await userEvent.type(screen.getByLabelText('Mobile number'), '0934058627 ext.123')
 await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
 await screen.findByRole('alert'); expect(transport.save).not.toHaveBeenCalled()
 transport.load.mockResolvedValue({ details: null, etag: null })
 await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
 await waitFor(() => expect(transport.remove).toHaveBeenCalledWith(etag, expect.any(AbortSignal)))
 expect(await screen.findByLabelText('Mobile number')).toHaveValue('')
})

it('searches country names and calling codes before selecting a phone country', async () => {
 page(); await screen.findByLabelText('Family name')
 await userEvent.click(screen.getByRole('button', { name: /Country code/ }))
 const search = await screen.findByRole('searchbox', { name: 'Country code' })
 await userEvent.type(search, 'Japan')
 expect(screen.getByRole('option', { name: 'Japan +81' })).toBeInTheDocument()
 expect(screen.queryByRole('option', { name: 'Taiwan +886' })).not.toBeInTheDocument()
 await userEvent.clear(search); await userEvent.type(search, '886')
 expect(screen.getByRole('option', { name: 'Taiwan +886' })).toBeInTheDocument()
 await userEvent.clear(search); await userEvent.type(search, 'no-country-match')
 expect(await screen.findByRole('status')).toHaveTextContent('No matching countries.')
 await userEvent.clear(search); await userEvent.type(search, 'Japan')
 await userEvent.click(screen.getByRole('option', { name: 'Japan +81' }))
 await userEvent.type(screen.getByLabelText('Mobile number'), '09012345678')
 await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
 await waitFor(() => expect(transport.save).toHaveBeenCalledWith({ ...initial, mobile: '+819012345678' }, etag, expect.any(AbortSignal)))
})
it('closes an open country search and disables selection during a qualification failure', async () => {
 const { access } = page(); await screen.findByLabelText('Family name')
 await userEvent.click(screen.getByRole('button', { name: /Country code/ }))
 await screen.findByRole('searchbox', { name: 'Country code' })
 access.mockRejectedValue(new Error('network unavailable'))
 act(() => window.dispatchEvent(new Event('focus')))
 await screen.findByRole('button', { name: 'Reload' })
 expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
 expect(screen.getByRole('button', { name: /Country code/ })).toBeDisabled()
})
it('does not mark member data dirty when only searching and dismissing countries', async () => {
 page(); await screen.findByLabelText('Family name')
 await userEvent.click(screen.getByRole('button', { name: /Country code/ }))
 await userEvent.type(await screen.findByRole('searchbox', { name: 'Country code' }), 'Japan')
 await userEvent.keyboard('{Escape}')
 await userEvent.click(screen.getByRole('link', { name: 'Back' }))
 await screen.findByRole('heading', { name: 'General profile' })
 expect(window.confirm).not.toHaveBeenCalled()
})
