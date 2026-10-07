import { render, screen, waitFor, within } from '@testing-library/react'
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

it.each(['grant', 'revoke'] as const)('keeps individual entitlement %s scoped to the opened member', async operation => {
  const code = 'bulletin.general.zh-Hant.access'
  api.getManagedMember.mockResolvedValue({ memberId: 'member', displayName: 'Alice', email: 'a@example.test', affiliations: [], entitlementCodes: operation === 'revoke' ? [code] : [], grantableEntitlementCodes: [code], actions: { manageEntitlements: true } })
  render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  const control = await screen.findByRole('switch', { name: '繁體週報下載' })
  await userEvent.click(control)
  expect(api.applyManagedEntitlements).toHaveBeenCalledExactlyOnceWith('unit', ['member'], code, operation, expect.any(String))
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

it('removes only the affiliation of the opened unit from the member heading', async () => {
  api.getManagedMember.mockResolvedValue({ memberId: 'member', displayName: 'Alice', email: 'a@example.test', affiliations: [
    { id: 'other-aff', orgUnitId: 'other-unit', kind: 'family', name: 'Other family', version: 3 },
    { id: 'unit-aff', orgUnitId: 'unit', kind: 'family', name: 'Current family', version: 2 },
  ], entitlementCodes: [], actions: { manageMembers: true, manageEntitlements: true } })
  api.removeManagedAffiliation.mockResolvedValue({})
  render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  const heading = await screen.findByRole('heading', { name: 'Alice' })
  const action = within(heading.parentElement!.parentElement!).getByRole('button', { name: 'Remove affiliation' })
  expect(screen.getAllByRole('button', { name: 'Remove affiliation' })).toHaveLength(1)
  await userEvent.click(action)
  expect(api.removeManagedAffiliation).toHaveBeenCalledExactlyOnceWith('unit', 'member', 'unit-aff', 2, false, expect.any(String))
})

it('does not offer removal when the opened unit has no direct affiliation', async () => {
  api.getManagedMember.mockResolvedValue({ memberId: 'member', displayName: 'Alice', email: 'a@example.test', affiliations: [
    { id: 'child-aff', orgUnitId: 'child-unit', kind: 'small_group', name: 'Child group', version: 2 },
  ], entitlementCodes: [], actions: { manageMembers: true, manageEntitlements: true } })
  render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  await screen.findByRole('heading', { name: 'Alice' })
  expect(screen.queryByRole('button', { name: 'Remove affiliation' })).not.toBeInTheDocument()
})

it('rejects a direct forbidden member URL with a return link, not retry or mutation controls', async () => {
  api.getManagedMember.mockRejectedValue(new OperationsApiError(403, 'forbidden'))
  render(<MemoryRouter initialEntries={['/organizations/unit/members/self']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.memberForbidden)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/organizations/unit')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('offers only the server-authorized Traditional bulletin and video grants', async () => {
 api.getManagedMember.mockResolvedValue({memberId:'member',displayName:'Alice',email:'a@example.test',affiliations:[],entitlementCodes:[],grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access'],actions:{manageEntitlements:true}})
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 await screen.findByText('Member videos')
 expect(screen.getAllByRole('switch').filter(control => !(control as HTMLInputElement).disabled)).toHaveLength(2)
 const row = screen.getByText('Member videos').closest('li')!
 await userEvent.click(within(row).getByRole('switch',{name:'Member videos'}))
 expect(api.applyManagedEntitlements).toHaveBeenCalledWith('unit',['member'],'video.meeting-recordings.access','grant',expect.any(String))
})

it('fails new grants closed when the server policy projection is unavailable', async () => {
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 await screen.findByRole('heading',{name:'Alice'})
 expect(screen.getAllByRole('switch')).toHaveLength(4)
 for (const control of screen.getAllByRole('switch')) expect(control).toBeDisabled()
 expect(screen.queryByText(messages.en.organizations.blocked)).not.toBeInTheDocument()
})

it('preserves revocation for existing access outside the grantable policy', async () => {
 api.getManagedMember.mockResolvedValue({memberId:'member',displayName:'Alice',email:'a@example.test',affiliations:[],entitlementCodes:['bulletin.general.zh-Hant.access'],grantableEntitlementCodes:[],actions:{manageEntitlements:true}})
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 const control=await screen.findByRole('switch',{name:'繁體週報下載'})
 expect(control).toBeChecked(); expect(control).not.toBeDisabled()
 await userEvent.click(control)
 expect(api.applyManagedEntitlements).toHaveBeenCalledWith('unit',['member'],'bulletin.general.zh-Hant.access','revoke',expect.any(String))
})

it('keeps the confirmed switch value on failure', async () => {
 api.getManagedMember.mockResolvedValue({memberId:'member',displayName:'Alice',email:'a@example.test',affiliations:[],entitlementCodes:[],grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],actions:{manageEntitlements:true}})
 api.applyManagedEntitlements.mockRejectedValue(new OperationsApiError(403,'forbidden'))
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 const control=await screen.findByRole('switch',{name:'繁體週報下載'})
 await userEvent.click(control)
 expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.forbidden)
 expect(control).not.toBeChecked()
})

it('keeps switches disabled until the confirmed member reload finishes', async () => {
 const initial={memberId:'member',displayName:'Alice',email:'a@example.test',affiliations:[],entitlementCodes:[],grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],actions:{manageEntitlements:true}}
 let finish!: (value: unknown) => void
 api.getManagedMember.mockResolvedValueOnce(initial).mockReturnValueOnce(new Promise(resolve=>{finish=resolve}))
 api.applyManagedEntitlements.mockResolvedValue({matched:1,changed:1})
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 const control=await screen.findByRole('switch',{name:'繁體週報下載'})
 control.focus(); await userEvent.keyboard(' ')
 await waitFor(()=>expect(api.getManagedMember).toHaveBeenCalledTimes(2))
 expect(control).toBeDisabled()
 finish({...initial,entitlementCodes:['bulletin.general.zh-Hant.access']})
 await waitFor(()=>expect(control).toBeChecked())
 expect(control).not.toBeDisabled()
})

it('locks mutations after a successful write with failed reload and retries only the read', async () => {
 const initial={memberId:'member',displayName:'Alice',email:'a@example.test',affiliations:[],entitlementCodes:[],grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],actions:{manageEntitlements:true}}
 api.getManagedMember.mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue({...initial,entitlementCodes:['bulletin.general.zh-Hant.access']})
 api.applyManagedEntitlements.mockResolvedValue({matched:1,changed:1})
 render(<MemoryRouter initialEntries={['/organizations/unit/members/member']}><Routes><Route path="/organizations/:unitId/members/:memberId" element={<OrganizationMemberPage />} /></Routes></MemoryRouter>)
 await userEvent.click(await screen.findByRole('switch',{name:'繁體週報下載'}))
 await screen.findByRole('alert')
 expect(screen.getByRole('switch',{name:'繁體週報下載'})).toBeDisabled()
 await userEvent.click(screen.getByRole('button',{name:messages.en.organizations.retry}))
 await waitFor(()=>expect(screen.getByRole('switch',{name:'繁體週報下載'})).toBeChecked())
 expect(screen.getByRole('switch',{name:'繁體週報下載'})).not.toBeDisabled()
 expect(api.applyManagedEntitlements).toHaveBeenCalledTimes(1)
})
