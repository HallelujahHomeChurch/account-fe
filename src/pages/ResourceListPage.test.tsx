import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

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
