import { describe, expect, it, vi } from 'vitest'

import { OperationsApi } from './operations-api'

const ok = <T>(data: T) => Promise.resolve({ data, response: new Response(null, { status: 200 }) })

describe('OperationsApi organization workspace', () => {
  it('uses the exact scoped read routes and bounded queries', async () => {
    const raw = { GET: vi.fn().mockImplementation((path: string) => ok(path.endsWith('/roots') ? { items: [] } : path.endsWith('/members') ? { items: [], page: 2 } : path.endsWith('/account-candidates') ? { items: [] } : path.endsWith('/responsibility-candidates') ? { items: [] } : path.endsWith('/responsibilities') ? { items: [] } : {})) }
    const api = new OperationsApi({ raw: { ...raw, use: vi.fn() } } as never)
    await api.getMyAccess(); await api.listManagedRoots(); await api.getManagedUnit('unit', true); await api.listManagedMembers('unit', '王', 2); await api.getManagedMember('unit', 'member'); await api.searchManagedCandidates('unit', '王小'); await api.listResponsibilityCandidates('unit', '王小'); await api.listManagedResponsibilities('unit')
    expect(raw.GET).toHaveBeenCalledWith('/api/operations/me/access', { signal: undefined })
    expect(raw.GET).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}', expect.objectContaining({ params: { path: { unitId: 'unit' }, query: { includeArchived: true } } }))
    expect(raw.GET).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}/members', expect.objectContaining({ params: { path: { unitId: 'unit' }, query: { q: '王', page: 2, limit: 50 } } }))
    expect(raw.GET).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}/account-candidates', expect.objectContaining({ params: { path: { unitId: 'unit' }, query: { q: '王小' } } }))
  })

  it('adds idempotency and version headers to managed mutations', async () => {
    const raw = { POST: vi.fn().mockReturnValue(ok({})), PUT: vi.fn().mockReturnValue(ok({})), DELETE: vi.fn().mockReturnValue(ok({})) }
    const api = new OperationsApi({ raw: { ...raw, use: vi.fn() } } as never)
    await api.createManagedChild('unit', { kind: 'family', name: 'Family' }, 'create')
    await api.updateManagedUnit('unit', 3, { name: 'Unit' }, 'update')
    await api.removeManagedAffiliation('unit', 'member', 'affiliation', 4, true, 'remove')
    expect(raw.POST).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}/children', expect.objectContaining({ params: { path: { unitId: 'unit' }, header: { 'Idempotency-Key': 'create' } } }))
    expect(raw.PUT).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}', expect.objectContaining({ params: { path: { unitId: 'unit' }, header: { 'If-Match': '"3"', 'Idempotency-Key': 'update' } } }))
    expect(raw.DELETE).toHaveBeenCalledWith('/api/operations/manage/org-units/{unitId}/members/{memberId}/affiliations/{affiliationId}', expect.objectContaining({ params: { path: { unitId: 'unit', memberId: 'member', affiliationId: 'affiliation' }, query: { endChurchMembership: true }, header: { 'If-Match': '"4"', 'Idempotency-Key': 'remove' } } }))
  })

  it('rejects entitlement batches beyond the server limit before sending', () => {
    const raw = { POST: vi.fn() }
    const api = new OperationsApi({ raw: { ...raw, use: vi.fn() } } as never)
    expect(() => api.applyManagedEntitlements('unit', Array.from({ length: 51 }, (_, index) => String(index)), 'bulletin.general.en.access', 'grant', 'key')).toThrow(RangeError)
    expect(raw.POST).not.toHaveBeenCalled()
  })
})

it('sends optional access in the admission request while keeping old calls unchanged', async () => {
 const raw={POST:vi.fn().mockReturnValue(ok({})),use:vi.fn()}
 const api=new OperationsApi({raw} as never)
 await api.admitManagedMember('unit','account','key',['bulletin.general.zh-Hant.access'])
 expect(raw.POST).toHaveBeenLastCalledWith('/api/operations/manage/org-units/{unitId}/members',{params:{path:{unitId:'unit'},header:{'Idempotency-Key':'key'}},body:{accountUserId:'account',entitlementCodes:['bulletin.general.zh-Hant.access']}})
 await api.admitManagedMember('unit','account','legacy')
 expect(raw.POST).toHaveBeenLastCalledWith('/api/operations/manage/org-units/{unitId}/members',expect.objectContaining({body:{accountUserId:'account'}}))
})

it('preserves the specific final-binding confirmation code over the generic conflict', async () => {
 const raw={DELETE:vi.fn().mockResolvedValue({error:{error:'conflict',error_code:'last_binding_requires_membership_end'},response:new Response(null,{status:409})}),use:vi.fn()}
 const api=new OperationsApi({raw} as never)
 await expect(api.removeManagedAffiliation('unit','member','affiliation',1,false,'key')).rejects.toMatchObject({status:409,code:'last_binding_requires_membership_end'})
})
it('keeps the generic error fallback when no specific error code exists', async () => {
 const raw={DELETE:vi.fn().mockResolvedValue({error:{error:'forbidden'},response:new Response(null,{status:403})}),use:vi.fn()}
 await expect(new OperationsApi({raw} as never).removeManagedAffiliation('unit','member','affiliation',1,false,'key')).rejects.toMatchObject({status:403,code:'forbidden'})
})
