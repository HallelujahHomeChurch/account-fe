import { expect, it } from 'vitest'
import { calendarMonth, monthRange, memberActions } from './member-service-model'
import type { ServiceAssignment } from './member-service-api'
const assignment = { id: 'duty', assigneeMemberId: 'me', startsAt: '2030-01-01T01:00:00Z', cancelled: false } as ServiceAssignment
it('does not expose commands to unknown members or for drafts, past or cancelled duties', () => {
  for (const item of [{ ...assignment, draft: true }, { ...assignment, cancelled: true }, { ...assignment, startsAt: '2000-01-01T00:00:00Z' }]) expect(memberActions(item, 'me')).toEqual([])
  expect(memberActions(assignment, undefined)).toEqual([])
})
it('restricts nominated responses and keeps owner help/withdraw available', () => {
  const item = { ...assignment, request: { id: 'r', status: 'active', mode: 'nominated', targetMemberId: 'peer' } } as ServiceAssignment
  expect(memberActions(item, 'other')).toEqual([])
  expect(memberActions(item, 'peer')).toEqual(['accept', 'decline'])
  expect(memberActions(item, 'me')).toEqual(['switch', 'withdraw', 'help'])
})
it('groups the month in the display zone and fetches both extreme zone boundaries', () => {
  expect(calendarMonth('2026-10-01T00:00:00Z', 'America/Los_Angeles')).toBe('2026-09')
  const range = monthRange('2026-10')
  expect(range.from).toBe('2026-09-30T10:00:00.000Z')
  expect(range.to).toBe('2026-11-01T12:00:00.000Z')
})
