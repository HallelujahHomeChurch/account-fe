import {
  OperationsApiError,
  type components,
  type createOperationsClient,
} from '@hallelujahhomechurch/operations-client'
import { isAbortError, recordRequestId, reportApiFailure } from '../observability'
import { AccountSessionError } from '@hallelujahhomechurch/account-client'
import { ApiError } from './api'

export { OperationsApiError } from '@hallelujahhomechurch/operations-client'

type Schemas = components['schemas']
type OperationsClient = ReturnType<typeof createOperationsClient>

export type ReservableResource = Schemas['ReservableResource']
export type ResourceReservation = Schemas['ResourceReservation']
export type OperationsAccess = Schemas['AccessSnapshot'] & { memberDetailsEligible?: boolean }
export type OperationsApiClient = {
  listMyResources: (signal?: AbortSignal) => Promise<ReservableResource[]>
  getAvailability: (resourceKey: string, from: string, to: string, signal?: AbortSignal) => Promise<Schemas['Availability']>
  createReservation: (input: Schemas['ResourceReservationInput'], idempotencyKey: string) => Promise<ResourceReservation>
  listMyReservations: (signal?: AbortSignal) => Promise<ResourceReservation[]>
  cancelReservation: (reservationId: string, version: number) => Promise<ResourceReservation>
  getMyAccess: (signal?: AbortSignal) => Promise<OperationsAccess>

}

export class OperationsApi implements OperationsApiClient {
  private readonly client: OperationsClient

  constructor(client: OperationsClient) {
    this.client = client
    client.raw.use({
      onError: ({ request, schemaPath, error }) => {
        // Session refresh owns its HTTP/validation failures; do not relabel them as Operations network errors.
        if (!request.signal.aborted && !isAbortError(error) && !(error instanceof AccountSessionError) && !(error instanceof ApiError)) reportApiFailure({ operation: schemaPath, method: request.method }, 'network', undefined, error)
      },
      onResponse: async ({ request, schemaPath, response }) => {
        recordRequestId(response)
        if (response.status === 428 && schemaPath.startsWith('/api/operations/me/resources')) window.dispatchEvent(new Event('hhc:legal-required'))
        const context = { operation: schemaPath, method: request.method }
        if (response.status >= 500) reportApiFailure(context, 'http', response)
        if (!response.ok) return
        try {
          const data: unknown = await response.clone().json()
          validateManagedResponse(schemaPath, data, response.status)
        } catch (error) {
          if (!request.signal.aborted && !isAbortError(error)) reportApiFailure(context, 'invalid_response', response)
          throw error
        }
      },
    })
  }

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


}

function validateManagedResponse(path: string, data: unknown, status: number) {
  const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
  let valid = data !== null
  if (path === '/api/operations/me/resources') valid = Array.isArray(data) && data.every(value => object(value) && ['id', 'key', 'name', 'timezone'].every(key => typeof value[key] === 'string'))
  else if (path === '/api/operations/me/access') valid = object(data) && Array.isArray(data.responsibilities)
  if (!valid) throw new OperationsApiError(status, 'invalid_response')
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
  const code = typeof record.error_code === 'string' && record.error_code ? record.error_code : typeof record.error === 'string' ? record.error : undefined
  return new OperationsApiError(response.status, code, typeof record.message === 'string' ? record.message : undefined)
}
