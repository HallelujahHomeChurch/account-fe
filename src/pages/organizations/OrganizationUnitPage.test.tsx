import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationUnitPage } from './OrganizationUnitPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

const operationsApi = { getManagedUnit: vi.fn(), listManagedMembers: vi.fn(), searchManagedCandidates: vi.fn(), listManagedResponsibilities: vi.fn(), applyManagedEntitlements: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active', version: 1 }, breadcrumb: [], children: [], actions: { editUnit: false, createChild: false, archive: false, restore: false, manageMembers: true, manageResponsibilities: false, manageEntitlements: true, sendNotifications: false } })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'member', displayName: 'Alice', email: 'alice@example.test' }], page: 1 })
  operationsApi.searchManagedCandidates.mockResolvedValue([])
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

function mount() { return render(<MemoryRouter initialEntries={['/organizations/church']}><Routes><Route path="/organizations/:unitId" element={<OrganizationUnitPage />} /></Routes></MemoryRouter>) }

it('waits for two Unicode characters and never browses all accounts', async () => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }))
  const input = await screen.findByRole('searchbox', { name: 'Search account name or email' })
  await userEvent.type(input, '王')
  expect(operationsApi.searchManagedCandidates).not.toHaveBeenCalled()
  await userEvent.type(input, '小')
  await waitFor(() => expect(operationsApi.searchManagedCandidates).toHaveBeenCalledWith('church', '王小', expect.any(AbortSignal)))
  expect(screen.queryByRole('button', { name: /browse/i })).not.toBeInTheDocument()
})

it('limits entitlement selection to members rendered by the scoped page', async () => {
  mount()
  const checkbox = await screen.findByRole('checkbox', { name: 'Select member Alice' })
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Grant' }))
  expect(operationsApi.applyManagedEntitlements).toHaveBeenCalledWith('church', ['member'], 'bulletin.general.zh-Hant.access', 'grant', expect.any(String))
})

it.each(['church', 'family', 'small_group', 'fellowship'])('only offers child creation for supported parent kind %s', async (kind) => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind, name: 'Unit', status: 'active' }, breadcrumb: [], children: [], actions: { createChild: true } })
  mount()
  await screen.findByRole('table')
  expect(Boolean(screen.queryByRole('button', { name: 'Create child unit' }))).toBe(['church', 'family'].includes(kind))
})

it('keeps names icon-free and provides a last-column action for units and members', async () => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active' }, breadcrumb: [], children: [{ id: 'family', kind: 'family', name: 'Family', status: 'active' }], actions: {} })
  mount()
  const unit = await screen.findByRole('link', { name: 'Open unit Family' })
  const member = screen.getByRole('link', { name: 'Weekly report access Alice' })
  expect(unit).toHaveAttribute('href', '/organizations/family')
  expect(member).toHaveAttribute('href', '/organizations/church/members/member')
  for (const link of [unit, member]) expect(link.closest('td')).toBe(link.closest('tr')?.lastElementChild)
  expect(screen.getByRole('link', { name: 'Family' }).querySelector('svg')).toBeNull()
  expect(screen.getByRole('link', { name: 'Alice' }).querySelector('svg')).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Archived units' }).closest('.organization-folder-header')).not.toBeNull()
})

it('does not offer child creation when server actions deny it', async () => {
  mount()
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: 'Create child unit' })).not.toBeInTheDocument()
})
