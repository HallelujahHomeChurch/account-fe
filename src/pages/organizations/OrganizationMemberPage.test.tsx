import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OperationsApiError } from '../../lib/operations-api'
import { OrganizationMemberPage } from './OrganizationMemberPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

const api = { getManagedMember: vi.fn(), getManagedUnit: vi.fn(), removeManagedAffiliation: vi.fn(), applyManagedEntitlements: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  api.getManagedMember.mockResolvedValue({ memberId: 'member', displayName: 'Alice', email: 'a@example.test', affiliations: [{ id: 'aff', orgUnitId: 'unit', kind: 'family', name: 'Family', version: 2 }], entitlementCodes: [], actions: { manageMembers: true, manageEntitlements: true } })
  api.getManagedUnit.mockResolvedValue({ unit: { id: 'unit' }, breadcrumb: [], children: [], actions: {} })
  vi.mocked(useAuth).mockReturnValue({ operationsApi: api } as never)
})

it('requires explicit confirmation only for the final-binding conflict', async () => {
  api.removeManagedAffiliation.mockRejectedValueOnce(new OperationsApiError(409, 'last_binding_requires_membership_end')).mockResolvedValueOnce({})
  render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: 'Remove affiliation' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(messages.en.organizations.endMembership)).toBeInTheDocument()
  expect(api.removeManagedAffiliation).toHaveBeenCalledTimes(1)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove affiliation' }))
  expect(api.removeManagedAffiliation).toHaveBeenLastCalledWith('unit', 'member', 'aff', 2, true, expect.any(String))
})

it('rejects a direct forbidden member URL with a return link, not retry or mutation controls', async () => {
  api.getManagedMember.mockRejectedValue(new OperationsApiError(403, 'forbidden'))
  render(<MemoryRouter initialEntries={['/organizations/unit/members/self']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.memberForbidden)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/organizations/unit')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
