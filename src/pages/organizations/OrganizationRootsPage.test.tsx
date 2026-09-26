import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationRootsPage } from './OrganizationRootsPage'
import { OrganizationUnitPage } from './OrganizationUnitPage'
import { OrganizationMemberPage } from './OrganizationMemberPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

beforeEach(() => vi.resetAllMocks())

it('renders server-selected roots as icon-free table rows without dropping units with unmanaged parents', async () => {
  const roots = [{ id: 'unit', parentId: 'unmanaged-church', name: 'Family', kind: 'family', status: 'active', version: 1 }, { id: 'other', name: 'Other', kind: 'fellowship', email: 'other@example.test', status: 'active', version: 1 }]
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue(roots) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  const table = await screen.findByRole('table', { name: 'Unit management' })
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  for (const root of roots) {
    const action = within(table).getByRole('link', { name: 'Open unit ' + root.name })
    const name = within(table).getByRole('link', { name: root.name })
    expect(action).toHaveAttribute('href', '/organizations/' + root.id)
    expect(name).toHaveAttribute('href', action.getAttribute('href'))
    expect(name.querySelector('svg')).toBeNull()
    expect(action.querySelector('svg')).not.toBeNull()
    expect(action.closest('td')).toBe(action.closest('tr')?.lastElementChild)
  }
  expect(screen.getByRole('navigation').querySelector('[aria-current="page"]')).toHaveTextContent('Unit management')
  expect(screen.queryByText(messages.en.organizations.description)).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('renders authorization state for a direct denied URL', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 403 })) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('keeps the table for an empty successful response', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue([]) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(within(await screen.findByRole('table')).getByText(messages.en.organizations.empty)).toBeInTheDocument()
})

it('retries a failed lookup instead of displaying an empty successful table', async () => {
  const listManagedRoots = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.loadFailed)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('table')
  expect(listManagedRoots).toHaveBeenCalledTimes(2)
})

it('navigates root to unit to member and back using the shared breadcrumb title', async () => {
  const unit = { id: 'unit', name: 'Family', kind: 'family', status: 'active', version: 1 }
  const member = { memberId: 'member', displayName: 'Alice', email: 'alice@example.test', affiliations: [], entitlementCodes: [], actions: {} }
  const operationsApi = { listManagedRoots: vi.fn().mockResolvedValue([unit]), getManagedUnit: vi.fn().mockResolvedValue({ unit, breadcrumb: [], children: [], actions: {} }), listManagedMembers: vi.fn().mockResolvedValue({ items: [member], page: 1 }), getManagedMember: vi.fn().mockResolvedValue(member) }
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
  render(<MemoryRouter initialEntries={['/organizations']}><Routes>
    <Route path="/organizations" element={<OrganizationRootsPage />} />
    <Route path="/organizations/:unitId" element={<OrganizationUnitPage />} />
    <Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} />
  </Routes></MemoryRouter>)
  await userEvent.click(await screen.findByRole('link', { name: 'Open unit Family' }))
  await screen.findByRole('table')
  expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Unit management' })).toHaveAttribute('href', '/organizations')
  await userEvent.click(screen.getByRole('link', { name: 'Weekly report access Alice' }))
  await screen.findByRole('heading', { name: 'Alice' })
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Unit management' }))
  await screen.findByRole('table', { name: 'Unit management' })
  expect(operationsApi.listManagedRoots).toHaveBeenCalledTimes(2)
})
