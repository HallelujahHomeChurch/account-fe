import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { useAuth } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ResourceListPage } from './ResourceListPage'

vi.mock('../auth/auth-context', () => ({ useAuth: vi.fn() }))

const operationsApi = { listMyResources: vi.fn(), getAvailability: vi.fn(), createReservation: vi.fn(), listMyReservations: vi.fn(), cancelReservation: vi.fn() }

beforeEach(() => {
  operationsApi.listMyResources.mockResolvedValue([{ id: 'resource-1', key: 'main-hall', name: 'Main hall', timezone: 'Asia/Taipei' }])
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

it('uses the server-projected resource list instead of local eligibility rules', async () => {
  render(<MemoryRouter><LocaleProvider><ResourceListPage /></LocaleProvider></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Resource requests' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Choose a resource' })).toHaveAttribute('href', '/resources/main-hall')
  expect(operationsApi.listMyResources).toHaveBeenCalledOnce()
})

it('recovers from a failed resource request using the existing retry action', async () => {
  operationsApi.listMyResources.mockRejectedValueOnce(new Error('HTTP 500'))
  render(<MemoryRouter><LocaleProvider><ResourceListPage /></LocaleProvider></MemoryRouter>)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('link', { name: 'Choose a resource' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
