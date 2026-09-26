import {
  OperationsApiError,
  type components,
  type createOperationsClient,
} from '@hallelujahhomechurch/operations-client'

export { OperationsApiError } from '@hallelujahhomechurch/operations-client'

type Schemas = components['schemas']
type OperationsClient = ReturnType<typeof createOperationsClient>

export type ReservableResource = Schemas['ReservableResource']
export type ResourceReservation = Schemas['ResourceReservation']
export type OperationsAccess = Schemas['AccessSnapshot']
export type ManagedActions = Schemas['ManagedActions']
export type ManagedUnit = Schemas['ManagedUnit']
export type ManagedUnitFolder = Schemas['ManagedUnitFolder']
export type ManagedMemberPage = Schemas['ManagedMemberPage']
export type ManagedMemberView = Schemas['ManagedMemberView']
export type ManagedJoinCandidate = Schemas['JoinCandidate']
export type ManagedResponsibility = Schemas['UnitResponsibilityView']
export type ManagedResponsibilityCandidate = Schemas['ManagedResponsibilityCandidate']
export type EntitlementCode = Schemas['ManagedEntitlementBatchInput']['entitlementCode']

export type OperationsApiClient = {
  listMyResources: (signal?: AbortSignal) => Promise<ReservableResource[]>
  getAvailability: (resourceKey: string, from: string, to: string, signal?: AbortSignal) => Promise<Schemas['Availability']>
  createReservation: (input: Schemas['ResourceReservationInput'], idempotencyKey: string) => Promise<ResourceReservation>
  listMyReservations: (signal?: AbortSignal) => Promise<ResourceReservation[]>
  cancelReservation: (reservationId: string, version: number) => Promise<ResourceReservation>
  getMyAccess: (signal?: AbortSignal) => Promise<OperationsAccess>
  listManagedRoots: (signal?: AbortSignal) => Promise<ManagedUnit[]>
  getManagedUnit: (unitId: string, includeArchived?: boolean, signal?: AbortSignal) => Promise<ManagedUnitFolder>
  listManagedMembers: (unitId: string, query?: string, page?: number, signal?: AbortSignal) => Promise<ManagedMemberPage>
  getManagedMember: (unitId: string, memberId: string, signal?: AbortSignal) => Promise<ManagedMemberView>
  searchManagedCandidates: (unitId: string, query: string, signal?: AbortSignal) => Promise<ManagedJoinCandidate[]>
  admitManagedMember: (unitId: string, accountUserId: string, key: string) => Promise<ManagedMemberView>
  createManagedChild: (unitId: string, input: Schemas['ManagedChildInput'], key: string) => Promise<ManagedUnit>
  updateManagedUnit: (unitId: string, version: number, input: Schemas['ManagedUnitUpdate'], key: string) => Promise<ManagedUnit>
  setManagedUnitStatus: (unitId: string, version: number, action: 'archive' | 'restore', key: string) => Promise<ManagedUnit>
  listResponsibilityCandidates: (unitId: string, query: string, signal?: AbortSignal) => Promise<ManagedResponsibilityCandidate[]>
  listManagedResponsibilities: (unitId: string, signal?: AbortSignal) => Promise<ManagedResponsibility[]>
  assignManagedResponsibility: (unitId: string, memberId: string, key: string) => Promise<ManagedResponsibility>
  revokeManagedResponsibility: (unitId: string, responsibilityId: string, version: number, key: string) => Promise<ManagedResponsibility>
  moveManagedAffiliation: (unitId: string, memberId: string, affiliationId: string, targetOrgUnitId: string, version: number, key: string) => Promise<ManagedMemberView>
  removeManagedAffiliation: (unitId: string, memberId: string, affiliationId: string, version: number, endChurchMembership: boolean, key: string) => Promise<ManagedMemberView>
  applyManagedEntitlements: (unitId: string, memberIds: string[], entitlementCode: EntitlementCode, operation: 'grant' | 'revoke', key: string) => Promise<Schemas['ManagedEntitlementBatchResult']>
}

export class OperationsApi implements OperationsApiClient {
  private readonly client: OperationsClient

  constructor(client: OperationsClient) { this.client = client }

  listMyResources(signal?: AbortSignal) {
    return unwrap<ReservableResource[]>(this.client.raw.GET('/api/operations/me/resources', { signal }))
  }

  getAvailability(resourceKey: string, from: string, to: string, signal?: AbortSignal) {
    return unwrap<Schemas['Availability']>(this.client.raw.GET('/api/operations/me/resources/{resourceKey}/availability', {
      params: { path: { resourceKey }, query: { from, to } }, signal,
    }))
  }

  createReservation(input: Schemas['ResourceReservationInput'], idempotencyKey: string) {
    return unwrap<ResourceReservation>(this.client.raw.POST('/api/operations/me/resource-reservations', {
      params: { header: { 'Idempotency-Key': idempotencyKey } }, body: input,
    }))
  }

  listMyReservations(signal?: AbortSignal) {
    return unwrap<ResourceReservation[]>(this.client.raw.GET('/api/operations/me/resource-reservations', { signal }))
  }

  cancelReservation(reservationId: string, version: number) {
    return unwrap<ResourceReservation>(this.client.raw.POST('/api/operations/me/resource-reservations/{reservationId}/cancel', {
      params: { path: { reservationId }, header: { 'If-Match': `"${version}"` } },
    }))
  }

  getMyAccess(signal?: AbortSignal) {
    return unwrap<OperationsAccess>(this.client.raw.GET('/api/operations/me/access', { signal }))
  }

  async listManagedRoots(signal?: AbortSignal) {
    return (await unwrap<Schemas['ManagedUnitList']>(this.client.raw.GET('/api/operations/manage/roots', { signal }))).items
  }

  getManagedUnit(unitId: string, includeArchived = false, signal?: AbortSignal) {
    return unwrap<ManagedUnitFolder>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}', {
      params: { path: { unitId }, query: { includeArchived } }, signal,
    }))
  }

  listManagedMembers(unitId: string, q = '', page = 1, signal?: AbortSignal) {
    return unwrap<ManagedMemberPage>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}/members', {
      params: { path: { unitId }, query: { q: q || undefined, page, limit: 50 } }, signal,
    }))
  }

  getManagedMember(unitId: string, memberId: string, signal?: AbortSignal) {
    return unwrap<ManagedMemberView>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}/members/{memberId}', {
      params: { path: { unitId, memberId } }, signal,
    }))
  }

  async searchManagedCandidates(unitId: string, q: string, signal?: AbortSignal) {
    return (await unwrap<Schemas['ManagedJoinCandidateList']>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}/account-candidates', {
      params: { path: { unitId }, query: { q } }, signal,
    }))).items
  }

  admitManagedMember(unitId: string, accountUserId: string, key: string) {
    return unwrap<ManagedMemberView>(this.client.raw.POST('/api/operations/manage/org-units/{unitId}/members', {
      params: { path: { unitId }, header: idempotency(key) }, body: { accountUserId },
    }))
  }

  createManagedChild(unitId: string, input: Schemas['ManagedChildInput'], key: string) {
    return unwrap<ManagedUnit>(this.client.raw.POST('/api/operations/manage/org-units/{unitId}/children', {
      params: { path: { unitId }, header: idempotency(key) }, body: input,
    }))
  }

  updateManagedUnit(unitId: string, version: number, input: Schemas['ManagedUnitUpdate'], key: string) {
    return unwrap<ManagedUnit>(this.client.raw.PUT('/api/operations/manage/org-units/{unitId}', {
      params: { path: { unitId }, header: versioned(version, key) }, body: input,
    }))
  }

  setManagedUnitStatus(unitId: string, version: number, action: 'archive' | 'restore', key: string) {
    const request = action === 'archive'
      ? this.client.raw.POST('/api/operations/manage/org-units/{unitId}/archive', { params: { path: { unitId }, header: versioned(version, key) } })
      : this.client.raw.POST('/api/operations/manage/org-units/{unitId}/restore', { params: { path: { unitId }, header: versioned(version, key) } })
    return unwrap<ManagedUnit>(request)
  }

  async listResponsibilityCandidates(unitId: string, q: string, signal?: AbortSignal) {
    return (await unwrap<Schemas['ManagedResponsibilityCandidateList']>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}/responsibility-candidates', {
      params: { path: { unitId }, query: { q } }, signal,
    }))).items
  }

  async listManagedResponsibilities(unitId: string, signal?: AbortSignal) {
    return (await unwrap<Schemas['UnitResponsibilityViewList']>(this.client.raw.GET('/api/operations/manage/org-units/{unitId}/responsibilities', {
      params: { path: { unitId } }, signal,
    }))).items
  }

  assignManagedResponsibility(unitId: string, memberId: string, key: string) {
    return unwrap<ManagedResponsibility>(this.client.raw.POST('/api/operations/manage/org-units/{unitId}/responsibilities', {
      params: { path: { unitId }, header: idempotency(key) }, body: { memberId },
    }))
  }

  revokeManagedResponsibility(unitId: string, responsibilityId: string, version: number, key: string) {
    return unwrap<ManagedResponsibility>(this.client.raw.DELETE('/api/operations/manage/org-units/{unitId}/responsibilities/{responsibilityId}', {
      params: { path: { unitId, responsibilityId }, header: versioned(version, key) },
    }))
  }

  moveManagedAffiliation(unitId: string, memberId: string, affiliationId: string, targetOrgUnitId: string, version: number, key: string) {
    return unwrap<ManagedMemberView>(this.client.raw.POST('/api/operations/manage/org-units/{unitId}/members/{memberId}/affiliation-moves', {
      params: { path: { unitId, memberId }, header: versioned(version, key) }, body: { affiliationId, targetOrgUnitId },
    }))
  }

  removeManagedAffiliation(unitId: string, memberId: string, affiliationId: string, version: number, endChurchMembership: boolean, key: string) {
    return unwrap<ManagedMemberView>(this.client.raw.DELETE('/api/operations/manage/org-units/{unitId}/members/{memberId}/affiliations/{affiliationId}', {
      params: { path: { unitId, memberId, affiliationId }, query: { endChurchMembership }, header: versioned(version, key) },
    }))
  }

  applyManagedEntitlements(unitId: string, memberIds: string[], entitlementCode: EntitlementCode, operation: 'grant' | 'revoke', key: string) {
    if (memberIds.length === 0 || memberIds.length > 50) throw new RangeError('memberIds must contain 1 to 50 items')
    return unwrap<Schemas['ManagedEntitlementBatchResult']>(this.client.raw.POST('/api/operations/manage/org-units/{unitId}/entitlements/batch', {
      params: { path: { unitId }, header: idempotency(key) }, body: { memberIds, entitlementCode, operation },
    }))
  }
}

function idempotency(key: string) { return { 'Idempotency-Key': key } }
function versioned(version: number, key: string) { return { 'If-Match': `"${version}"`, 'Idempotency-Key': key } }

async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const result = await request
  if (result.error !== undefined || !result.response.ok) throw await operationError(result.response, result.error)
  if (result.data === undefined) throw new OperationsApiError(result.response.status, 'invalid_response')
  return result.data
}

async function operationError(response: Response, body: unknown) {
  let value = body
  if (value === undefined) {
    try { value = await response.clone().json() } catch { value = undefined }
  }
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const code = typeof record.error === 'string' ? record.error : typeof record.error_code === 'string' ? record.error_code : undefined
  return new OperationsApiError(response.status, code, typeof record.message === 'string' ? record.message : undefined)
}
