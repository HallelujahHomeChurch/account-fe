// UI-only review fixture. Not imported by the production entry or build.
import { createOperationsClient } from '@hallelujahhomechurch/operations-client'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from '../src/App'
import { AuthProvider } from '../src/auth/auth-context'
import { LocaleProvider } from '../src/i18n/locale-context'
import { MockAccountApi } from '../src/lib/mock-account-api'
import { OperationsApi } from '../src/lib/operations-api'
import { UnitNotificationsApi } from '../src/lib/unit-notifications-api'
import { ThemeProvider } from '../src/theme/theme-context'
import '../src/index.css'
import '@hallelujahhomechurch/ui/styles.css'

if (!import.meta.env.DEV) throw new Error('Review fixture is development-only')
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const demoParams = new URLSearchParams(location.search)
const ordinaryMember = demoParams.get('persona') === 'member'
let failMembersOnce = demoParams.get('failure') === 'members'
const units = [
  { id: id(1), kind: 'church', name: '哈利路亞家教會', email: 'office@example.test', status: 'active', version: 1 },
  { id: id(2), parentId: id(1), kind: 'family', name: '恩典家族', status: 'active', version: 1 },
  { id: id(3), parentId: id(1), kind: 'fellowship', name: '青年團契', status: 'active', version: 1 },
  { id: id(4), parentId: id(2), kind: 'small_group', name: '喜樂小家', status: 'active', version: 1 },
  { id: id(5), parentId: id(1), kind: 'family', name: '歷史家族', status: 'archived', version: 2 },
].map(unit => ({ ...unit, updatedAt: '2026-09-25T00:00:00Z' }))
if (demoParams.get('roots') === '50') units.push(...Array.from({ length: 49 }, (_, index) => ({ ...units[0], id: id(1000 + index), name: `可管理教會 ${index + 2}` })))
const memberNames = ['陳怡君', '王大明', '林恩典', '許以樂', '張佳恩', '黃思源']
const members = Array.from({ length: demoParams.get('rows') === '50' ? 50 : memberNames.length }, (_, index) => ({
  memberId: id(100 + index), displayName: memberNames[index % memberNames.length] + (index >= 6 ? ` ${index + 1}` : ''), email: 'member' + index + '@example.test',
  affiliations: [{ id: id(200 + index), orgUnitId: id(4), kind: 'small_group', name: '喜樂小家', version: 1 }],
  entitlementCodes: index % 2 ? ['bulletin.general.zh-Hant.access'] : [],
}))
const history: Record<string, unknown>[] = []
const responsibilities: Record<string, unknown>[] = []
const receipts = new Map<string, unknown>()
function actions(unit: typeof units[number]) {
  const active = unit.status === 'active'
  return { editUnit: active, createChild: active && ['church', 'family'].includes(unit.kind), archive: active && unit.id !== id(1), restore: !active, manageMembers: active, manageResponsibilities: active && unit.id !== id(1), manageEntitlements: active, sendNotifications: active }
}
function reply(data: unknown, engagement = false, status = 200) { return new Response(JSON.stringify(engagement ? { data } : data), { status, headers: { 'Content-Type': 'application/json' } }) }
const fixtureFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(new URL(String(input), location.origin), init)
  const url = new URL(request.url)
  const method = request.method
  const body = method === 'POST' || method === 'PUT' ? await request.clone().json().catch(() => ({})) : {}
  const key = request.headers.get('Idempotency-Key')
  const engagement = url.pathname.includes('/engagement/')
  if (key && receipts.has(key)) return reply(receipts.get(key), engagement)
  const finish = (data: unknown) => { if (key) receipts.set(key, data); return reply(data, engagement) }
  if (url.pathname.endsWith('/me/resources')) return reply([])
  if (url.pathname.endsWith('/me/access')) return reply({ responsibilities: ordinaryMember ? [] : [{ orgUnitId: id(1) }], memberships: [], orgRoles: [], entitlements: [], version: '1' })
  if (ordinaryMember) return reply({ error: 'forbidden' }, false, 403)
  if (url.pathname.endsWith('/manage/roots')) return reply({ items: demoParams.get('roots') === 'empty' ? [] : units.filter(unit => !unit.parentId) })
  if (engagement) {
    if (url.pathname.endsWith('/preview')) return reply({ audienceAccounts: members.length, emailRecipients: members.length - 1, webPushDevices: members.length + 2 }, true)
    if (method === 'POST') {
      const notification = { id: crypto.randomUUID(), orgUnitId: body.orgUnitId, subject: body.subject, body: body.body, audienceAccountCount: members.length, createdAt: new Date().toISOString(), channels: [{ campaignId: crypto.randomUUID(), channel: 'email', status: 'queued', recipientCount: members.length - 1 }, { campaignId: crypto.randomUUID(), channel: 'web_push', status: 'queued', recipientCount: members.length + 2 }] }
      history.unshift(notification); return finish(notification)
    }
    const notificationId = url.pathname.split('/unit-notifications/')[1]
    if (notificationId) return reply(history.find(value => value.id === notificationId), true)
    return reply({ items: history, page: 1, perPage: 10, total: history.length }, true)
  }
  const match = url.pathname.match(/\/org-units\/([^/]+)(.*)/)
  const unit = units.find(value => value.id === match?.[1])
  if (!unit) return reply({ error: 'forbidden' }, false, 403)
  const suffix = match?.[2] ?? ''
  const query = url.searchParams.get('q') ?? ''
  if (!suffix && method === 'GET') {
    const breadcrumb = []
    let parent = units.find(value => value.id === unit.parentId)
    while (parent) { breadcrumb.unshift(parent); parent = units.find(value => value.id === parent?.parentId) }
    return reply({ unit, breadcrumb, children: units.filter(value => value.parentId === unit.id && (value.status === 'active' || url.searchParams.get('includeArchived') === 'true')), actions: actions(unit) })
  }
  if (!suffix && method === 'PUT') { Object.assign(unit, body, { version: unit.version + 1 }); return finish(unit) }
  if (suffix === '/children') { const child = { ...body, id: crypto.randomUUID(), parentId: unit.id, status: 'active', version: 1, updatedAt: new Date().toISOString() }; units.push(child); return finish(child) }
  if (suffix === '/archive' || suffix === '/restore') { unit.status = suffix === '/archive' ? 'archived' : 'active'; unit.version++; return finish(unit) }
  if (suffix === '/account-candidates') return reply({ items: query.trim().length >= 2 ? [{ state: 'available', account: { accountUserId: id(999), displayName: '新會員', email: 'new@example.test' } }] : [] })
  if (suffix === '/members' && method === 'POST') { const member = { memberId: id(999), displayName: '新會員', email: 'new@example.test', affiliations: [], entitlementCodes: [] }; if (!members.some(value => value.memberId === member.memberId)) members.push(member); return finish({ ...member, actions: actions(unit) }) }
  if (suffix === '/members') {
    if (failMembersOnce) {
      failMembersOnce = false
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json', 'X-HHC-Request-ID': 'review-account-unit-20260926' } })
    }
    return reply({ items: members.filter(member => (member.displayName + member.email).includes(query)), page: Number(url.searchParams.get('page') || 1) })
  }
  if (suffix === '/entitlements/batch') { for (const member of members.filter(value => body.memberIds.includes(value.memberId))) member.entitlementCodes = body.operation === 'grant' ? [...new Set([...member.entitlementCodes, body.entitlementCode])] : member.entitlementCodes.filter(code => code !== body.entitlementCode); return finish({ matched: body.memberIds.length, changed: body.memberIds.length }) }
  if (suffix === '/responsibility-candidates') return reply({ items: members.filter(member => (member.displayName + member.email).includes(query)) })
  if (suffix === '/responsibilities' && method === 'GET') return reply({ items: responsibilities })
  if (suffix === '/responsibilities') { const value = { ...members.find(member => member.memberId === body.memberId), id: crypto.randomUUID(), version: 1 }; responsibilities.push(value); return finish(value) }
  if (suffix.startsWith('/responsibilities/')) { const index = responsibilities.findIndex(value => value.id === suffix.split('/')[2]); return finish(responsibilities.splice(index, 1)[0]) }
  const member = members.find(value => value.memberId === suffix.split('/')[2])
  if (member) {
    if (suffix.endsWith('/affiliation-moves')) { const affiliation = member.affiliations.find(value => value.id === body.affiliationId); const target = units.find(value => value.id === body.targetOrgUnitId); if (affiliation && target) Object.assign(affiliation, { orgUnitId: target.id, name: target.name, kind: target.kind, version: affiliation.version + 1 }) }
    if (method === 'DELETE') {
      if (url.searchParams.get('endChurchMembership') !== 'true') return reply({ error: 'last_binding_requires_membership_end' }, false, 409)
      member.affiliations = []
    }
    return finish({ ...member, actions: actions(unit) })
  }
  return reply({ error: 'not_found' }, false, 404)
}
const account = new MockAccountApi()
account.refreshAccessToken = async () => 'local-review'
account.getSession = async () => ({ authenticated: true, user: { id: id(900), email: 'leader@example.test', display_name: '測試負責人', avatar_url: null, permissions: [] }, permissions: [], permission_availability: { status: 'available' } })
await account.login({ email: 'admin', password: 'admin123' })
if (!location.hash) window.history.replaceState(null, '', location.pathname + location.search + '#/organizations/' + id(Number(demoParams.get('unit')) || 1))
createRoot(document.getElementById('root')!).render(<HashRouter><LocaleProvider><ThemeProvider><AuthProvider api={account} operationsApi={new OperationsApi(createOperationsClient({ baseUrl: location.origin, getAccessToken: async () => 'local-review', refreshAfterUnauthorized: async () => null, fetcher: fixtureFetch }))} unitNotificationsApi={new UnitNotificationsApi({ getAccessToken: () => 'local-review', fetch: fixtureFetch })}><App /></AuthProvider></ThemeProvider></LocaleProvider></HashRouter>)
