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

it('renders every server-selected root as one clear management link without email or type columns', async () => {
  const roots = [{ id: 'unit', parentId: 'unmanaged-church', name: 'Family', kind: 'family', status: 'active', version: 1 }, { id: 'other', name: 'Other', kind: 'fellowship', email: 'other@example.test', status: 'active', version: 1 }]
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue(roots) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  const list = await screen.findByRole('list', { name: messages.en.organizations.roots })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(within(list).getAllByRole('link')).toHaveLength(2)
  for (const root of roots) {
    const link = within(list).getByRole('link', { name: 'Manage ' + root.name })
    expect(link).toHaveAttribute('href', '/organizations/' + root.id)
    expect(link).toHaveTextContent(root.name)
  }
  expect(screen.queryByText('other@example.test')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('renders authorization state for a direct denied URL', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 403 })) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('shows the empty state without a table for an empty successful response', async () => {
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue([]) } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByText(messages.en.organizations.empty)).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('retries a failed lookup instead of displaying an empty successful table', async () => {
  const listManagedRoots = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  vi.mocked(useAuth).mockReturnValue({ operationsApi: { listManagedRoots } } as never)
  render(<MemoryRouter><OrganizationRootsPage /></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.loadFailed)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(messages.en.organizations.empty)
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
  await userEvent.click(await screen.findByRole('link', { name: 'Manage Family' }))
  await screen.findByRole('table')
  expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Small group management' })).toHaveAttribute('href', '/organizations')
  await userEvent.click(screen.getByRole('link', { name: 'Content access Alice' }))
  await screen.findByRole('heading', { name: 'Alice' })
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Small group management' }))
  await screen.findByRole('list', { name: messages.en.organizations.roots })
  expect(operationsApi.listManagedRoots).toHaveBeenCalledTimes(2)
})
