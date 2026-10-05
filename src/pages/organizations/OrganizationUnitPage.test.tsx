import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationUnitPage } from './OrganizationUnitPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

const operationsApi = { updateManagedUnit: vi.fn(), getManagedUnit: vi.fn(), listManagedMembers: vi.fn(), searchManagedCandidates: vi.fn(), listManagedResponsibilities: vi.fn(), getMyAccess: vi.fn(), revokeManagedResponsibility: vi.fn(), applyManagedEntitlements: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active', version: 1 }, breadcrumb: [], children: [], actions: { editUnit: false, createChild: false, archive: false, restore: false, manageMembers: true, manageResponsibilities: false, manageEntitlements: true, sendNotifications: false } })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'member', displayName: 'Alice', email: 'alice@example.test' }], page: 1 })
  operationsApi.searchManagedCandidates.mockResolvedValue([])
  operationsApi.getMyAccess.mockResolvedValue({ memberId: 'self', responsibilities: [] })
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

function mount() { return render(<MemoryRouter initialEntries={['/organizations/church']}><Routes><Route path="/organizations/:unitId" element={<OrganizationUnitPage />} /></Routes></MemoryRouter>) }

it('shows the current manager read-only and still allows revoking another manager', async () => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'family', name: 'Family', status: 'active' }, breadcrumb: [], children: [], actions: { editUnit: true, manageResponsibilities: true } })
  operationsApi.listManagedResponsibilities.mockResolvedValue([
    { id: 'r-self', memberId: 'self', displayName: 'Current manager', email: 'self@example.test', version: 1 },
    { id: 'r-other', memberId: 'other', displayName: 'Other manager', email: 'other@example.test', version: 2 },
  ])
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Unit settings' }))
  const self = await screen.findByText('Current manager (You)')
  expect(within(self.closest('li')!).queryByRole('button')).not.toBeInTheDocument()
  const other = screen.getByText('Other manager')
  await userEvent.click(within(other.closest('li')!).getByRole('button', { name: 'Revoke' }))
  expect(operationsApi.revokeManagedResponsibility).toHaveBeenCalledWith('church', 'r-other', 2, expect.any(String))
})

it.each([null, {}])('does not expose revoke actions when current member identity is unavailable: %s', async access => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'family', name: 'Family', status: 'active' }, breadcrumb: [], children: [], actions: { editUnit: true, manageResponsibilities: true } })
  operationsApi.listManagedResponsibilities.mockResolvedValue([{ id: 'r-self', memberId: 'self', displayName: 'Current manager', email: 'self@example.test', version: 1 }])
  if (access === null) operationsApi.getMyAccess.mockRejectedValue(new Error('Unavailable'))
  else operationsApi.getMyAccess.mockResolvedValue(access)
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Unit settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.loadFailed)
  expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
})

it('requires a complete email and an explicit lookup before showing add-member candidates', async () => {
  expect(messages['zh-Hant'].organizations.fullEmailHint).toBe('請輸入完整 email')
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }))
  const input = await screen.findByRole('textbox', { name: 'Search email' })
  expect(screen.getByText('Enter the full email address.')).toBeInTheDocument()
  await userEvent.type(input, 'member@')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(operationsApi.searchManagedCandidates).not.toHaveBeenCalled()
  await userEvent.type(input, 'example.com')
  expect(operationsApi.searchManagedCandidates).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(operationsApi.searchManagedCandidates).toHaveBeenCalledWith('church', 'member@example.com', expect.any(AbortSignal)))
  expect(screen.queryByRole('button', { name: /browse/i })).not.toBeInTheDocument()
})

it('offers individual member access without selection or batch entitlement controls', async () => {
  mount()
  const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
  expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Grant' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(within(table).getByRole('link', { name: 'Content access Alice' })).toHaveAttribute('href', '/organizations/church/members/member')
  expect(operationsApi.applyManagedEntitlements).not.toHaveBeenCalled()
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
  const member = screen.getByRole('link', { name: 'Content access Alice' })
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

it('lets an ancestor manager restrict a child to Traditional bulletin and video', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access','video.meeting-recordings.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 await userEvent.click(within(policy).getByRole('checkbox',{name:'简体中文'}))
 await userEvent.click(within(policy).getByRole('checkbox',{name:'English'}))
 await userEvent.click(within(policy).getByRole('checkbox',{name:'Member videos'}))
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,expect.objectContaining({grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access']}),expect.any(String))
})

it('shows own unit policy read-only and omits it from an ordinary name update', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'family',name:'Family',status:'active',version:1,grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[],children:[],actions:{editUnit:true,manageEntitlementPolicy:false}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 expect(within(policy).getAllByRole('checkbox').every(input=>(input as HTMLInputElement).disabled)).toBe(true)
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Family',email:''},expect.any(String))
})

it('preserves a child policy on name-only saves after ancestor restriction', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 await userEvent.type(within(screen.getByRole('dialog')).getByRole('textbox',{name:'Name'}),' renamed')
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group renamed',email:''},expect.any(String))
})
