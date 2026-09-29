import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError, type DSRRequest } from '../lib/api'
import { DataRequestsPage } from './DataRequestsPage'

const profile = { id: 'u1', email: 'ray@example.com' }
const baseRequest: DSRRequest = {
  id: 'request-1', request_type: 'access_export', status: 'processing',
  identity_verified_at: '2026-09-03T00:00:00Z', submitted_at: '2026-09-03T00:00:00Z', version: 1,
  executions: [
    { owner: 'account', action: 'export', status: 'succeeded', attempt_count: 1, result_summary: {} },
    { owner: 'engagement', action: 'export', status: 'running', attempt_count: 1, result_summary: {} },
  ],
}

function renderPage(overrides: Partial<AuthApi> = {}) {
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => profile, logout: async () => ({}), listDSRRequests: async () => [], ...overrides,
  }
  return render(
    <MemoryRouter initialEntries={['/data-requests']}>
      <LocaleProvider><AuthProvider api={api}><Routes>
        <Route path="/data-requests" element={<><DataRequestsPage /><Location /></>} />
        <Route path="/profile" element={<><h1>Personal info</h1><Location /></>} />
        <Route path="/login" element={<Location />} />
      </Routes></AuthProvider></LocaleProvider>
    </MemoryRouter>,
  )
}

function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output> }

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('DataRequestsPage', () => {
  it('creates one request type and renders owner progress', async () => {
    const createDSRRequest = vi.fn(async () => baseRequest)
    renderPage({ createDSRRequest })
    await userEvent.click(await screen.findByRole('button', { name: 'Request data export' }))
    expect(createDSRRequest).toHaveBeenCalledWith('access_export')
    expect(await screen.findByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('presents all four data-request operations as action cards', async () => {
    renderPage()
    const operations = await screen.findByRole('region', { name: 'Create a request' })
    expect(within(operations).getAllByRole('article')).toHaveLength(4)
    expect(within(operations).getByRole('button', { name: 'Request data export' })).toBeInTheDocument()
    expect(within(operations).getByRole('button', { name: 'Restrict data processing' })).toBeInTheDocument()
    expect(within(operations).getByRole('button', { name: 'Start account erasure' })).toBeInTheDocument()
    expect(within(operations).queryByRole('button', { name: 'Update personal info' })).not.toBeInTheDocument()
  })

  it('requires exact email and confirmation for erasure', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    const createDSRRequest = vi.fn(async () => erasure)
    const confirmDSRErasure = vi.fn(async () => ({ ...erasure, status: 'in_review' as const, version: 2 }))
    renderPage({ createDSRRequest, confirmDSRErasure })
    await userEvent.click(await screen.findByRole('button', { name: 'Start account erasure' }))
    await userEvent.type(screen.getByLabelText('Current email'), 'RAY@example.com')
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Current email'))
    await userEvent.type(screen.getByLabelText('Current email'), '  ray@example.com  ')
    await userEvent.click(screen.getByLabelText('I understand this action removes account data'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm account erasure' }))
    expect(confirmDSRErasure).toHaveBeenCalledWith('request-1', 1, 'ray@example.com')
  })

  it('redirects stale authentication to normal login with return path', async () => {
    renderPage({ createDSRRequest: async () => { throw new ApiError(401, 'reauth', 'ACC_DSR_REAUTH_REQUIRED') } })
    await userEvent.click(await screen.findByRole('button', { name: 'Request data export' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?return_to=%2Fdata-requests'))
  })

  it('resumes a submitted erasure confirmation after returning from sign-in', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    renderPage({ listDSRRequests: async () => [erasure] })
    expect(await screen.findByRole('heading', { name: 'Confirm account erasure' })).toBeInTheDocument()
  })

  it('removes stale erasure confirmation after cancellation', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    const cancelDSRRequest = vi.fn(async () => ({ ...erasure, status: 'cancelled' as const, version: 2 }))
    const confirmDSRErasure = vi.fn()
    renderPage({ listDSRRequests: async () => [erasure], cancelDSRRequest, confirmDSRErasure })

    expect(await screen.findByRole('heading', { name: 'Confirm account erasure' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(screen.queryByRole('heading', { name: 'Confirm account erasure' })).not.toBeInTheDocument()
    expect(confirmDSRErasure).not.toHaveBeenCalled()
  })

  it('starts a replacement erasure with blank confirmation state', async () => {
    const erasureA = { ...baseRequest, id: 'erasure-a', request_type: 'erasure' as const, status: 'submitted' as const }
    const erasureB = { ...erasureA, id: 'erasure-b' }
    const createDSRRequest = vi.fn(async () => erasureB)
    const cancelDSRRequest = vi.fn(async () => ({ ...erasureA, status: 'cancelled' as const, version: 2 }))
    const confirmDSRErasure = vi.fn()
    renderPage({ listDSRRequests: async () => [erasureA], createDSRRequest, cancelDSRRequest, confirmDSRErasure })

    await userEvent.type(await screen.findByLabelText('Current email'), 'ray@example.com')
    await userEvent.click(screen.getByLabelText('I understand this action removes account data'))
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start account erasure' }))

    expect(screen.getByLabelText('Current email')).toHaveValue('')
    expect(screen.getByLabelText('I understand this action removes account data')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeDisabled()
    expect(confirmDSRErasure).not.toHaveBeenCalled()
  })

  it('downloads and revokes the temporary object URL', async () => {
    const completed = { ...baseRequest, status: 'completed' as const }
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage({
      listDSRRequests: async () => [completed],
      issueDSRDownload: async () => ({ download_url: '/api/account/v1/dsr/downloads/token' }),
      redeemDSRDownload: async () => new Blob(['zip'], { type: 'application/zip' }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Download data export' }))
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:export'))
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })

  it('revokes a temporary download URL when the browser click fails', async () => {
    const completed = { ...baseRequest, status: 'completed' as const }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked') })
    renderPage({ listDSRRequests: async () => [completed], issueDSRDownload: async () => ({ download_url: '/api/account/v1/dsr/downloads/token' }), redeemDSRDownload: async () => new Blob(['zip']) })

    await userEvent.click(await screen.findByRole('button', { name: 'Download data export' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to complete the data request.')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-export')
  })
})

it('requires correction scope, current value and requested value before submission', async () => {
  const createDSRRequest = vi.fn(async () => ({ ...baseRequest, request_type: 'correction' as const }))
  renderPage({ createDSRRequest })
  await userEvent.click(await screen.findByRole('button', { name: 'Request data correction' }))
  const submit = screen.getByRole('button', { name: 'Submit correction' })
  expect(submit).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Data or location to correct'), '  Profile name  ')
  await userEvent.type(screen.getByLabelText('Current value'), 'Old name')
  expect(submit).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Requested value'), 'New name')
  await userEvent.click(submit)
  expect(createDSRRequest).toHaveBeenCalledWith('correction', { description: 'Profile name', current_value: 'Old name', requested_value: 'New name' })
})

it('includes optional scope in a new export request', async () => {
  const createDSRRequest = vi.fn(async () => baseRequest)
  renderPage({ createDSRRequest })
  await userEvent.type(await screen.findByLabelText('Request scope (optional)'), '  2026 reservations  ')
  await userEvent.click(screen.getByRole('button', { name: 'Request data export' }))
  expect(createDSRRequest).toHaveBeenCalledWith('access_export', { description: '2026 reservations' })
})

it('shows requested information and submits a version-bound supplement', async () => {
  const request = { ...baseRequest, information_requested: 'Please identify the affected record.', description: 'Existing scope', version: 4 }
  const supplementDSRRequest = vi.fn(async () => ({ ...request, information_requested: '', version: 5 }))
  renderPage({ listDSRRequests: async () => [request], supplementDSRRequest })
  expect(await screen.findByText('Please identify the affected record.')).toBeInTheDocument()
  await userEvent.clear(screen.getByRole('textbox', { name: 'Additional information' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Additional information' }), 'Record A from September')
  await userEvent.click(screen.getByRole('button', { name: 'Send additional information' }))
  expect(supplementDSRRequest).toHaveBeenCalledWith('request-1', { version: 4, description: 'Record A from September', current_value: '', requested_value: '' })
  expect(screen.queryByRole('button', { name: 'Send additional information' })).not.toBeInTheDocument()
})

it('shows all owner progress and only public reviewer replies', async () => {
  renderPage({ listDSRRequests: async () => [{ ...baseRequest, executions: [
    { owner: 'operations', action: 'export', status: 'succeeded', attempt_count: 1, result_summary: { public_response: 'Reservations included.', internal_note: 'DO NOT DISCLOSE' } },
    { owner: 'website_watermark', action: 'export', status: 'not_applicable', attempt_count: 1, result_summary: {} },
  ] } as DSRRequest] })
  expect(await screen.findByText('Reservations and groups')).toBeInTheDocument()
  expect(screen.getByText('Website access records')).toBeInTheDocument()
  expect(screen.getByText('Reservations included.')).toBeInTheDocument()
  expect(screen.queryByText('DO NOT DISCLOSE')).not.toBeInTheDocument()
})

it('disables expired downloads and offers a new export with the original scope', async () => {
  const issueDSRDownload = vi.fn()
  const createDSRRequest = vi.fn(async () => baseRequest)
  renderPage({ listDSRRequests: async () => [{ ...baseRequest, status: 'completed', export_expires_at: '2020-01-01T00:00:00Z', description: 'Reservations' }], issueDSRDownload, createDSRRequest })
  expect(await screen.findByRole('button', { name: 'Download data export' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Request a new export' }))
  expect(issueDSRDownload).not.toHaveBeenCalled()
  expect(createDSRRequest).toHaveBeenCalledWith('access_export', { description: 'Reservations' })
})

it('polls active requests without overlap and pauses while hidden and after unmount', async () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  let resolvePoll: (requests: DSRRequest[]) => void = () => undefined
  const listDSRRequests = vi.fn().mockResolvedValueOnce([baseRequest]).mockImplementationOnce(() => new Promise<DSRRequest[]>((resolve) => { resolvePoll = resolve })).mockResolvedValue([{ ...baseRequest, status: 'completed' }])
  const view = renderPage({ listDSRRequests })
  await act(async () => {})
  expect(listDSRRequests).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  visibility.mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  visibility.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => {})
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  await act(async () => { resolvePoll([baseRequest]) })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
})

it('expires a completed export without polling completed requests', async () => {
  vi.useFakeTimers()
  const listDSRRequests = vi.fn().mockResolvedValue([{ ...baseRequest, status: 'completed', export_expires_at: new Date(Date.now() + 1000).toISOString() }])
  renderPage({ listDSRRequests })
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'Download data export' })).toBeEnabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
  expect(screen.getByRole('button', { name: 'Download data export' })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(1)
})

it('preserves unsent additional information when polling updates the request version', async () => {
  vi.useFakeTimers()
  const request = { ...baseRequest, information_requested: 'Please identify the record.', description: 'Original scope', version: 4 }
  const listDSRRequests = vi.fn().mockResolvedValueOnce([request]).mockResolvedValue([{ ...request, version: 5 }])
  const supplementDSRRequest = vi.fn(async () => ({ ...request, information_requested: '', version: 6 }))
  renderPage({ listDSRRequests, supplementDSRRequest })
  await act(async () => {})
  fireEvent.change(screen.getByRole('textbox', { name: 'Additional information' }), { target: { value: 'My unsent details' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(screen.getByRole('textbox', { name: 'Additional information' })).toHaveValue('My unsent details')
  fireEvent.submit(screen.getByRole('textbox', { name: 'Additional information' }).closest('form')!)
  await act(async () => {})
  expect(supplementDSRRequest).toHaveBeenCalledWith('request-1', { version: 5, description: 'My unsent details', current_value: '', requested_value: '' })
})
