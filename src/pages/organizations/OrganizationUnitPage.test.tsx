import { useState } from 'react'
import { AccountHeaderSearch } from '../../components/AccountHeaderSearch'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { useAuth } from '../../auth/auth-context'
import { messages } from '../../i18n/messages'
import { OrganizationUnitPage } from './OrganizationUnitPage'

vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('../../i18n/locale-context', () => ({ useLocale: () => ({ messages: messages.en }) }))

const operationsApi = { admitManagedMember: vi.fn(), updateManagedUnit: vi.fn(), getManagedUnit: vi.fn(), listManagedMembers: vi.fn(), searchManagedCandidates: vi.fn(), listManagedResponsibilities: vi.fn(), getMyAccess: vi.fn(), revokeManagedResponsibility: vi.fn(), applyManagedEntitlements: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active', version: 1 }, breadcrumb: [], children: [], actions: { editUnit: false, createChild: false, archive: false, restore: false, manageMembers: true, manageResponsibilities: false, manageEntitlements: true, sendNotifications: false } })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'member', displayName: 'Alice', email: 'alice@example.test' }], page: 1 })
  operationsApi.searchManagedCandidates.mockResolvedValue([])
  operationsApi.getMyAccess.mockResolvedValue({ memberId: 'self', responsibilities: [] })
  vi.mocked(useAuth).mockReturnValue({ operationsApi } as never)
})

function mount(path = '/organizations/church') { return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/organizations/:unitId" element={<OrganizationUnitPage />} /></Routes></MemoryRouter>) }

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
  expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
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
  expect(screen.queryByRole('checkbox', { name: 'Archived units' })).not.toBeInTheDocument()
})

it('does not offer child creation when server actions deny it', async () => {
  mount()
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: 'Create child unit' })).not.toBeInTheDocument()
})

it('lets an ancestor manager restrict a child to Traditional bulletin and video', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access','video.meeting-recordings.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 await userEvent.click(within(policy).getByRole('switch',{name:'簡體週報下載'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'英文週報下載'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'Member videos'}))
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,expect.objectContaining({grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access']}),expect.any(String))
})

it('shows own unit policy read-only and omits it from an ordinary name update', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'family',name:'Family',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[],children:[],actions:{editUnit:true,manageEntitlementPolicy:false}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 expect(screen.queryByRole('group',{name:'Grantable access'})).not.toBeInTheDocument()
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Family',email:''},expect.any(String))
})

it('preserves a child policy on name-only saves after ancestor restriction', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 await userEvent.type(within(screen.getByRole('dialog')).getByRole('textbox',{name:'Name'}),' renamed')
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group renamed',email:''},expect.any(String))
})

it('can override inherited access beyond the parent and reset to inheritance', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'parent',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:true,grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 expect(within(policy).getByRole('switch',{name:'Member videos'})).toBeDisabled()
 await userEvent.click(within(policy).getByRole('switch',{name:'Inherit from parent'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'Member videos'}))
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group',email:'',inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access']},expect.any(String))
})

it('sends only the inheritance flag when restoring parent defaults', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'parent',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:[],effectiveGrantableEntitlementCodes:[]},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 await userEvent.click(screen.getByRole('switch',{name:'Inherit from parent'}))
 expect(screen.getByRole('switch',{name:'繁體週報下載'})).toBeChecked()
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group',email:'',inheritsGrantableEntitlements:true},expect.any(String))
})

it('shows effective inherited access when own-unit ancestors are hidden', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'hidden',kind:'family',name:'Family',status:'active',version:1,inheritsGrantableEntitlements:true,grantableEntitlementCodes:[],effectiveGrantableEntitlementCodes:['video.meeting-recordings.access']},breadcrumb:[],children:[],actions:{editUnit:true,manageEntitlementPolicy:false}})
 mount(); await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 expect(screen.queryByRole('group',{name:'Grantable access'})).not.toBeInTheDocument()
})

it('submits default-off admission switches atomically and resets them on reopening', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'church',name:'Church',status:'active',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[],children:[],actions:{manageMembers:true,manageEntitlements:true}})
 operationsApi.searchManagedCandidates.mockResolvedValue([{account:{accountUserId:'new',displayName:'Bob',email:'bob@example.test'},state:'available'}])
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Add member'}))
 const toggle=await screen.findByRole('switch',{name:'繁體週報下載'})
 expect(toggle).not.toBeChecked()
 await userEvent.click(toggle)
 await userEvent.type(screen.getByRole('textbox',{name:'Search email'}),'bob@example.test')
 await userEvent.click(screen.getByRole('button',{name:'Search'}))
 const row = (await screen.findByText('Bob')).closest('li')!
 await userEvent.click(within(row).getByRole('button',{name:'Add member'}))
 expect(operationsApi.admitManagedMember).toHaveBeenCalledWith('church','new',expect.any(String),['bulletin.general.zh-Hant.access'])
 await userEvent.click(await screen.findByRole('button',{name:'Add member'}))
 expect(await screen.findByRole('switch',{name:'繁體週報下載'})).not.toBeChecked()
})

it('shows responsible people with existing read access without requesting delegation access', async () => {
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'leader', displayName: 'Alice', email: 'alice@example.test', isResponsible: true }], page: 1 })
  mount()
  const row = (await screen.findByText('alice@example.test')).closest('tr')!
  expect(within(row).getByText('Responsible person')).toBeInTheDocument()
  expect(within(row).getByRole('link', { name: 'Content access Alice' })).toBeInTheDocument()
  expect(operationsApi.listManagedResponsibilities).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Unit settings' })).not.toBeInTheDocument()
})

it('filters responsible people before pagination and excludes child-unit rows', async () => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active' }, breadcrumb: [], children: [{ id: 'family', kind: 'family', name: 'Family', status: 'active' }], actions: {} })
  operationsApi.listManagedMembers.mockImplementation((_unit, _query, _page, _signal, responsibilityOnly) => Promise.resolve({ items: responsibilityOnly ? [{ memberId: 'leader', displayName: 'Leader from another page', email: 'leader@example.test', isResponsible: true }] : [{ memberId: 'ordinary', displayName: 'Ordinary', email: 'ordinary@example.test' }], page: 1 }))
  mount()
  await screen.findByText('ordinary@example.test')
  await userEvent.click(screen.getByRole('button', { name: /Type/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'Responsible person' }))
  expect(await screen.findByText('leader@example.test')).toBeInTheDocument()
  expect(screen.queryByText('ordinary@example.test')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Family' })).not.toBeInTheDocument()
})

it.each([
  ['unit', true, false],
  ['member', false, true],
  ['invalid', true, true],
])('keeps the unit/member filter inclusive and falls back for %s', async (type, showUnit, showMember) => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active' }, breadcrumb: [], children: [{ id: 'family', kind: 'family', name: 'Family', status: 'active' }], actions: {} })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'leader', displayName: 'Alice', email: 'alice@example.test', isResponsible: true }], page: 1 })
  mount('/organizations/church?type=' + type)
  const table = await screen.findByRole('table')
  expect(Boolean(within(table).queryByRole('link', { name: 'Family' }))).toBe(showUnit)
  expect(Boolean(within(table).queryByText('alice@example.test'))).toBe(showMember)
  if (showMember) expect(within(table).getByText('Responsible person')).toBeInTheDocument()
  if (!showMember) expect(operationsApi.listManagedMembers).not.toHaveBeenCalled()
})

it('resets responsible-person filtering to the first page and preserves search', async () => {
  operationsApi.listManagedMembers.mockImplementation((_unit, query, page, _signal, responsibilityOnly) => Promise.resolve({ items: [{ memberId: 'leader', displayName: 'Alice', email: `alice-${responsibilityOnly ? 'leader' : page}@example.test`, isResponsible: responsibilityOnly }], page, nextPage: !responsibilityOnly && !query ? 2 : undefined }))
  function FolderWithHeader() {
    const [value, setValue] = useState('')
    return <><AccountHeaderSearch mode="members" value={value} onChange={setValue} items={[]} /><OrganizationUnitPage searchQuery={value} /></>
  }
  render(<MemoryRouter initialEntries={['/organizations/church']}><Routes><Route path="/organizations/:unitId" element={<FolderWithHeader />} /></Routes></MemoryRouter>)
  await screen.findByText('alice-1@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('alice-2@example.test')
  await userEvent.click(screen.getByRole('button', { name: /Type/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'Responsible person' }))
  expect(await screen.findByText('alice-leader@example.test')).toBeInTheDocument()
  expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', '', 1, expect.any(AbortSignal), true)
  await userEvent.click(screen.getByRole('button', { name: 'Search members' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search members' }), 'Alice')
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', 'Alice', 1, expect.any(AbortSignal), true))
})

it('uses the controlled header query without rendering a second roster search or archive controls', async () => {
  render(<MemoryRouter initialEntries={['/organizations/church']}><Routes><Route path="/organizations/:unitId" element={<OrganizationUnitPage searchQuery="Alice" />} /></Routes></MemoryRouter>)
  await screen.findByRole('table')
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenCalledWith('church', 'Alice', 1, expect.any(AbortSignal), false))
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Archived units' })).not.toBeInTheDocument()
})

it('keeps unit editing beside breadcrumbs above the business actions', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: "church", kind: "church", name: "Church", status: "active", version: 1 }, breadcrumb: [], children: [], actions: { editUnit: true } });
 mount();
 const edit = await screen.findByRole('button', { name: messages.en.organizations.settings });
 expect(edit.closest('.organization-location')?.querySelector('.organization-breadcrumb')).toBeInTheDocument();
});
