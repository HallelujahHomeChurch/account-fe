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

export type OperationsApiClient = {
  listMyResources: (signal?: AbortSignal) => Promise<ReservableResource[]>
  getAvailability: (resourceKey: string, from: string, to: string, signal?: AbortSignal) => Promise<Schemas['Availability']>
  createReservation: (input: Schemas['ResourceReservationInput'], idempotencyKey: string) => Promise<ResourceReservation>
  listMyReservations: (signal?: AbortSignal) => Promise<ResourceReservation[]>
  cancelReservation: (reservationId: string, version: number) => Promise<ResourceReservation>
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
}

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
