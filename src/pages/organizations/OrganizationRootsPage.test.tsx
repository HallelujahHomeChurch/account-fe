import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationRootsPage } from './OrganizationRootsPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

beforeEach(() => vi.resetAllMocks())

it('renders only deduplicated roots returned by the server', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue([{ id: 'unit', name: 'Family', kind: 'family', status: 'active', version: 1, updatedAt: '2026-09-25T00:00:00Z' }]) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Open unit' })).toHaveAttribute('href', '/organizations/unit')
  expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument()
})

it('renders authorization state for a direct denied URL', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 403 })) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access')
})
