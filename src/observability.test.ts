import { describe, expect, it, vi } from 'vitest'

import { recordRequestId, sanitizeSentryEvent } from './observability'

describe('observability privacy boundary', () => {
  it('removes user data and sensitive URL values before sending', () => {
    const event = sanitizeSentryEvent({
      request: {
        url: 'https://account.alive.org.tw/verify-email?token=secret#done',
        headers: { authorization: 'Bearer secret' },
      },
      user: { email: 'member@example.com' },
      message: 'Failed for member@example.com with code=secret',
    })

    expect(event.request).toEqual({ url: 'https://account.alive.org.tw/verify-email' })
    expect(event.user).toBeUndefined()
    expect(event.message).toBe('Failed for [redacted-email] with code=[redacted]')
    expect(JSON.stringify(event)).not.toContain('secret')
    expect(JSON.stringify(event)).not.toContain('member@example.com')
  })

  it('records only bounded request IDs', () => {
    const addBreadcrumb = vi.fn()

    recordRequestId(new Response(null, { headers: { 'X-HHC-Request-ID': 'req-123' } }), addBreadcrumb)
    recordRequestId(new Response(null, { headers: { 'X-HHC-Request-ID': 'not valid' } }), addBreadcrumb)

    expect(addBreadcrumb).toHaveBeenCalledOnce()
    expect(addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ data: { request_id: 'req-123' } }))
  })
})
