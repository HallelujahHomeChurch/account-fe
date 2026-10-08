import type { MemberCommand, ServiceAssignment } from './member-service-api'

export function memberActions(
  item: ServiceAssignment,
  memberId?: string,
  now = Date.now(),
): MemberCommand['action'][] {
  if (
    !memberId ||
    item.draft ||
    item.cancelled ||
    Date.parse(item.startsAt) <= now
  )
    return []
  const active = item.request?.status === 'active'
  if (item.assigneeMemberId === memberId) {
    const actions: MemberCommand['action'][] = active
      ? ['switch', 'withdraw']
      : ['request']
    if (!item.helpOpen) actions.push('help')
    return actions
  }
  if (!active) return []
  if (item.request?.mode === 'open') return ['accept']
  return item.request?.targetMemberId === memberId ? ['accept', 'decline'] : []
}

export function calendarMonth(instant: string | number, zone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(instant))
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`
}

export function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value - 1 + offset, 1))
    .toISOString()
    .slice(0, 7)
}

export function monthRange(month: string) {
  const [year, value] = month.split('-').map(Number)
  // Match mobile: fetch UTC-12 through UTC+14, then filter in the display zone.
  return {
    from: new Date(Date.UTC(year, value - 1, 1) - 14 * 3600000).toISOString(),
    to: new Date(Date.UTC(year, value, 1) + 12 * 3600000).toISOString(),
  }
}

export function overlaps(item: ServiceAssignment, other: ServiceAssignment) {
  return (
    item.id !== other.id &&
    !other.cancelled &&
    !other.draft &&
    Date.parse(other.startsAt) < Date.parse(item.endsAt) &&
    Date.parse(other.endsAt) > Date.parse(item.startsAt)
  )
}
