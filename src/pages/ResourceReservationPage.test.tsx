import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { OperationsApiError } from '../lib/operations-api'
import { ResourceReservationPage } from './ResourceReservationPage'

vi.mock('../auth/auth-context', () => ({ useAuth: vi.fn() }))

const resource = { id: 'resource-1', key: 'main-hall', name: 'Main hall', timezone: 'Asia/Taipei' }
const operationsApi = { listMyResources: vi.fn(), getAvailability: vi.fn(), createReservation: vi.fn(), listMyReservations: vi.fn(), cancelReservation: vi.fn() }

function LocationProbe() { return <span data-testid="path">{useLocation().pathname}</span> }

beforeEach(() => {
  vi.resetAllMocks()
  operationsApi.getAvailability.mockResolvedValue({ busyIntervals: [] })
  operationsApi.createReservation.mockResolvedValue({ id: 'reservation-1' })
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

it('removes the request form when Operations revokes resource access', async () => {
  operationsApi.getAvailability.mockRejectedValue(new OperationsApiError(404))
  render(<MemoryRouter initialEntries={[{ pathname: '/resources/main-hall', state: { resource } }]}><LocaleProvider><Routes><Route path="/resources/:resourceKey" element={<ResourceReservationPage />} /></Routes></LocaleProvider></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('You are no longer eligible to request this resource.')
  expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument()
})

it('submits one typed reservation request through the Operations client', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[{ pathname: '/resources/main-hall', state: { resource } }]}><LocaleProvider><Routes><Route path="/resources/:resourceKey" element={<ResourceReservationPage />} /><Route path="/resources/reservations" element={<LocationProbe />} /></Routes></LocaleProvider></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Request resource: Main hall' })).toBeInTheDocument()
  await user.type(screen.getByLabelText('Purpose'), 'Small group')
  await user.click(screen.getByRole('button', { name: 'Submit request' }))
  await waitFor(() => expect(operationsApi.createReservation).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 'resource-1', purpose: 'Small group' }), expect.any(String)))
  expect(screen.getByTestId('path')).toHaveTextContent('/resources/reservations')
})
