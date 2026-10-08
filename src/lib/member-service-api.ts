import {
  OperationsApiError,
  type components,
  type createOperationsClient,
} from '@hallelujahhomechurch/operations-client'
import { unwrapOperations } from './operations-api'

type Schemas = components['schemas']
export type ServiceTeam = Schemas['ServiceTeam']
export type ServiceAssignment = Schemas['ServiceAssignment']
export type ServiceCandidate = Schemas['ServiceCandidate']
export type ServicePreference = Schemas['ServicePreference']
export type ServiceNotice = Schemas['ServiceNotice']
export type MemberCommand = Omit<
  Schemas['ServiceCommand'],
  'action' | 'label' | 'assigneeMemberId'
> & {
  action: 'request' | 'switch' | 'accept' | 'decline' | 'withdraw' | 'help'
}

// Only member operations are exposed here; scheduling belongs to Admin.
export class MemberServiceApi {
  private readonly client: ReturnType<typeof createOperationsClient>

  constructor(client: ReturnType<typeof createOperationsClient>) {
    this.client = client
  }

  listTeams(signal?: AbortSignal) {
    return unwrapOperations(
      this.client.raw.GET('/api/operations/me/service/teams', { signal }),
    )
  }

  async listAssignments(
    teamId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ) {
    const items: ServiceAssignment[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    do {
      const page = await unwrapOperations(
        this.client.raw.GET('/api/operations/me/service/assignments', {
          params: { query: { teamId, from, to, limit: 100, cursor } },
          signal,
        }),
      )
      items.push(...page.items.filter((item) => !item.draft))
      cursor = page.nextCursor
      if (cursor && cursors.has(cursor))
        throw new OperationsApiError(200, 'invalid_response')
      if (cursor) cursors.add(cursor)
    } while (cursor)
    return items
  }

  async getAssignment(id: string, signal?: AbortSignal) {
    const item = await unwrapOperations(
      this.client.raw.GET('/api/operations/me/service/assignments/{id}', {
        params: { path: { id } },
        signal,
      }),
    )
    if (item.draft) throw new OperationsApiError(404, 'not_found')
    return item
  }

  async listCandidates(id: string, signal?: AbortSignal) {
    const items: ServiceCandidate[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    for (;;) {
      const page = await unwrapOperations(
        this.client.raw.GET(
          '/api/operations/me/service/teams/{id}/candidates',
          { params: { path: { id }, query: { cursor } }, signal },
        ),
      )
      items.push(...page)
      if (page.length < 100) return items
      cursor = page.at(-1)?.id
      if (!cursor || cursors.has(cursor))
        throw new OperationsApiError(200, 'invalid_response')
      cursors.add(cursor)
    }
  }

  command(id: string, body: MemberCommand, key: string) {
    return unwrapOperations(
      this.client.raw.POST(
        '/api/operations/me/service/assignments/{id}/commands',
        {
          params: { path: { id }, header: { 'Idempotency-Key': key } },
          body,
        },
      ),
    )
  }

  getPushConfig(signal?: AbortSignal) {
    return unwrapOperations(
      this.client.raw.GET('/api/operations/me/service/push-config', { signal }),
    )
  }

  registerInstallation(
    body: Schemas['ServiceInstallation'],
    signal?: AbortSignal,
  ) {
    return unwrapOperations(
      this.client.raw.POST('/api/operations/me/service/installation', {
        body,
        signal,
      }),
    )
  }

  getPreference(signal?: AbortSignal) {
    return unwrapOperations(
      this.client.raw.GET('/api/operations/me/service/preference', { signal }),
    )
  }

  updatePreference(body: ServicePreference) {
    return unwrapOperations(
      this.client.raw.POST('/api/operations/me/service/preference', { body }),
    )
  }

  listNotices(cursor?: string, signal?: AbortSignal) {
    return unwrapOperations(
      this.client.raw.GET('/api/operations/me/service/notifications', {
        params: { query: { cursor } },
        signal,
      }),
    )
  }

  readNotice(id: string) {
    return unwrapOperations(
      this.client.raw.POST(
        '/api/operations/me/service/notifications/{id}/read',
        { params: { path: { id } } },
      ),
    )
  }
}
