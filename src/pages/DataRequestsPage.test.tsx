import { render, screen, waitFor } from '@testing-library/react'
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

afterEach(() => vi.restoreAllMocks())

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

  it('routes ordinary correction to profile without creating a case', async () => {
    const createDSRRequest = vi.fn()
    renderPage({ createDSRRequest })
    await userEvent.click(await screen.findByRole('button', { name: 'Update personal info' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/profile')
    expect(createDSRRequest).not.toHaveBeenCalled()
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
    expect(await screen.findByTestId('location')).toHaveTextContent('/login?return_to=%2Fdata-requests')
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
