import { describe, expect, it, vi } from 'vitest'
import { MemberServiceApi } from './member-service-api'
const ok = (data: unknown) =>
  Promise.resolve({ data, response: new Response(null, { status: 200 }) })
describe('member service transport', () => {
  it('loads all published pages without requesting drafts', async () => {
    const raw = {
      GET: vi
        .fn()
        .mockReturnValueOnce(ok({ items: [{ id: 'one' }], nextCursor: 'next' }))
        .mockReturnValueOnce(ok({ items: [{ id: 'two' }] })),
    }
    const api = new MemberServiceApi({ raw } as never)
    expect(await api.listAssignments('team', 'from', 'to')).toEqual([
      { id: 'one' },
      { id: 'two' },
    ])
    expect(raw.GET).toHaveBeenLastCalledWith(
      '/api/operations/me/service/assignments',
      expect.objectContaining({
        params: {
          query: {
            teamId: 'team',
            from: 'from',
            to: 'to',
            limit: 100,
            cursor: 'next',
          },
        },
      }),
    )
  })
  it('does not show drafts to a leader in the member view', async () => {
    const raw = {
      GET: vi
        .fn()
        .mockReturnValueOnce(
          ok({
            items: [
              { id: 'draft', draft: true },
              { id: 'published', draft: false },
            ],
          }),
        )
        .mockReturnValueOnce(ok({ id: 'draft', draft: true })),
    }
    const api = new MemberServiceApi({ raw } as never)
    expect(await api.listAssignments('team', 'from', 'to')).toEqual([
      { id: 'published', draft: false },
    ])
    await expect(api.getAssignment('draft')).rejects.toMatchObject({
      status: 404,
    })
  })
  it('rejects a repeated cursor instead of hanging', async () => {
    const api = new MemberServiceApi({
      raw: {
        GET: vi.fn().mockReturnValue(ok({ items: [], nextCursor: 'same' })),
      },
    } as never)
    await expect(api.listAssignments('team', 'from', 'to')).rejects.toThrow()
  })
  it('preserves command version, request identity and retry key', async () => {
    const raw = { POST: vi.fn().mockReturnValue(ok({ id: 'one', version: 4 })) }
    const api = new MemberServiceApi({ raw } as never)
    const body = {
      action: 'accept' as const,
      expectedVersion: 3,
      requestId: 'request',
    }
    await api.command('one', body, 'retry-key')
    expect(raw.POST).toHaveBeenCalledWith(
      '/api/operations/me/service/assignments/{id}/commands',
      {
        params: {
          path: { id: 'one' },
          header: { 'Idempotency-Key': 'retry-key' },
        },
        body,
      },
    )
  })
})
it('loads candidates beyond the first 100 members', async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({
    id: `member-${index}`,
    name: `Member ${index}`,
  }))
  const raw = {
    GET: vi
      .fn()
      .mockReturnValueOnce(ok(first))
      .mockReturnValueOnce(ok([{ id: 'last', name: 'Last member' }])),
  }
  const api = new MemberServiceApi({ raw } as never)
  expect(await api.listCandidates('team')).toHaveLength(101)
  expect(raw.GET).toHaveBeenLastCalledWith(
    '/api/operations/me/service/teams/{id}/candidates',
    {
      params: { path: { id: 'team' }, query: { cursor: 'member-99' } },
      signal: undefined,
    },
  )
})
