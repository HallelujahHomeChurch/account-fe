import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { OperationsApiError } from '../lib/operations-api'
import { MyResourceReservationsPage } from './MyResourceReservationsPage'

vi.mock('../auth/auth-context', () => ({ useAuth: vi.fn() }))

const reservation = { id: 'reservation-1', resourceId: 'resource-1', requesterUserId: 'user-1', purpose: 'Small group', startsAt: '2026-09-21T01:00:00Z', endsAt: '2026-09-21T02:00:00Z', status: 'requested' as const, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', version: 1 }
const operationsApi = { listMyResources: vi.fn(), getAvailability: vi.fn(), createReservation: vi.fn(), listMyReservations: vi.fn(), cancelReservation: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  operationsApi.listMyReservations.mockResolvedValue([reservation])
  operationsApi.cancelReservation.mockResolvedValue({ ...reservation, status: 'cancelled' })
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

it('keeps an owned reservation accessible and cancellable', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><LocaleProvider><MyResourceReservationsPage /></LocaleProvider></MemoryRouter>)
  expect(await screen.findByText('Small group')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel request' }))
  await waitFor(() => expect(operationsApi.cancelReservation).toHaveBeenCalledWith('reservation-1', 1))
  expect(screen.getByText('Cancelled')).toBeInTheDocument()
})

it('refreshes the owned list after a stale cancellation without ending the session', async () => {
  operationsApi.cancelReservation.mockRejectedValue(new OperationsApiError(412))
  render(<MemoryRouter><LocaleProvider><MyResourceReservationsPage /></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This record changed. Review it again.')
  expect(operationsApi.listMyReservations).toHaveBeenCalledTimes(2)
})
