import { ServiceDetail } from './ServiceDetail'
import { Button, IconButton, Select, Skeleton } from '@hallelujahhomechurch/ui'
import { Bell, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { serviceMessages } from '../../i18n/service'
import type { ServiceAssignment, ServiceTeam } from '../../lib/member-service-api'
import { calendarMonth, monthRange, shiftMonth } from '../../lib/member-service-model'
import './service.css'

type Roster = { key: string; teams: ServiceTeam[]; items: ServiceAssignment[] }
export function ServicePage() {
  const { serviceApi, profile } = useAuth()
  const { locale } = useLocale()
  const t = serviceMessages[locale]
  const { id } = useParams()
  const navigate = useNavigate()
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [month, setMonth] = useState(() => calendarMonth(Date.now(), zone))
  const [mode, setMode] = useState<'mine' | 'team'>('mine')
  const [teamId, setTeamId] = useState('')
  const [revision, setRevision] = useState(0)
  const [roster, setRoster] = useState<Roster | null>(null)
  const [failedKey, setFailedKey] = useState('')
  const key = `${profile?.id}:${month}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    const { from, to } = monthRange(month)
    void (async () => {
      try {
        const teams = await serviceApi.listTeams(controller.signal)
        const groups = await Promise.all(teams.map(team => serviceApi.listAssignments(team.id, from, to, controller.signal)))
        if (!controller.signal.aborted) setRoster({ key, teams, items: groups.flat().filter(item => !item.draft).sort((a,b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)) })
      } catch { if (!controller.signal.aborted) setFailedKey(key) }
    })()
    return () => controller.abort()
  }, [serviceApi, key, month])
  const ready = roster?.key === key
  const failed = failedKey === key
  const teams = ready ? roster.teams : []
  const selectedTeam = teams.find(team => team.id === teamId) ?? teams[0]
  const items = ready ? roster.items.filter(item => calendarMonth(item.startsAt, zone) === month && (mode === 'team' ? item.teamId === selectedTeam?.id : teams.some(team => team.id === item.teamId && team.memberId === item.assigneeMemberId))) : []
  const dates = new Map<string, ServiceAssignment[]>()
  const dayFormat = new Intl.DateTimeFormat(locale, { timeZone: zone, month: 'long', day: 'numeric', weekday: 'short' })
  for (const item of items) { const day = dayFormat.format(new Date(item.startsAt)); dates.set(day, [...(dates.get(day) ?? []), item]) }
  const time = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: zone, hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value))
  const zones = [...new Set([zone, 'Asia/Taipei', ...teams.flatMap(team => roster?.items.filter(item => item.teamId === team.id).map(item => item.timeZone) ?? [])])]
  return <section className="account-document member-service">
    <header className="member-service-heading"><h1>{t.title}</h1><div className="member-service-tools"><Link to="/service/notifications" aria-label={t.notices}><Bell size={20}/></Link><Link to="/service/preferences" aria-label={t.preferences}><Settings2 size={20}/></Link></div></header>
    <div className="member-service-segments" role="group" aria-label={t.title}>{(['mine','team'] as const).map(value => <Button key={value} variant="ghost" aria-pressed={mode === value} onPress={() => setMode(value)}>{t[value]}</Button>)}</div>
    <div className="member-service-toolbar">
      <div className="member-service-month"><IconButton variant="ghost" aria-label={t.previous} icon={<ChevronLeft size={20}/>} onPress={() => setMonth(shiftMonth(month,-1))}/><label><span className="sr-only">{t.month}</span><input type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value) }}/></label><IconButton variant="ghost" aria-label={t.next} icon={<ChevronRight size={20}/>} onPress={() => setMonth(shiftMonth(month,1))}/></div>
      <Select label={t.zone} selectedKey={zone} items={zones.map(id => ({id,label:id}))} onSelectionChange={setZone}/>
      {mode === 'team' && teams.length > 1 ? <Select label={t.fellowship} selectedKey={selectedTeam?.id} items={teams.map(team => ({id:team.id,label:team.name}))} onSelectionChange={setTeamId}/> : null}
    </div>
    {failed ? <div className="member-service-empty"><p role="alert">{t.failed}</p><Button variant="secondary" onPress={() => setRevision(value => value+1)}>{t.retry}</Button></div> : !ready ? <Skeleton label={t.loading} className="account-page-skeleton"/> : !items.length ? <p className="member-service-empty">{teams.length ? t.empty : t.noTeams}</p> : <div className="member-service-days">{[...dates].map(([day,assignments]) => <section key={day}><h2>{day}</h2><ul>{assignments.map(item => <li key={item.id}><Link to={`/service/assignments/${item.id}`} className="member-service-duty"><time dateTime={item.startsAt}>{time(item.startsAt)}</time><div><strong>{item.label}</strong><span>{item.meetingName} · {item.teamName}</span>{mode === 'team' ? <span>{item.assigneeName || t.unassigned}</span> : null}</div>{item.cancelled ? <small>{t.cancelled}</small> : item.request?.status === 'active' ? <small>{item.request.mode === 'open' ? t.open : t.waiting}</small> : item.helpOpen ? <small>{t.helpPending}</small> : null}<ChevronRight size={18} aria-hidden="true"/></Link></li>)}</ul></section>)}</div>}
    {id && ready ? <ServiceDetail key={`${profile?.id}:${id}`} id={id} teams={teams} items={roster.items} zone={zone} onClose={() => navigate('/service')} onChanged={next => setRoster(current => current ? {...current, items:current.items.map(item => item.id === next.id ? next : item)} : current)}/> : null}
  </section>
}
