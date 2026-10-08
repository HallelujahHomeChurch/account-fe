import {
  Button,
  Dialog,
  Drawer,
  SearchableSelect,
  Skeleton,
} from '@hallelujahhomechurch/ui'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/auth-context'
import { useLocale } from '../../i18n/locale-context'
import { serviceMessages } from '../../i18n/service'
import { OperationsApiError } from '../../lib/operations-api'
import type {
  MemberCommand,
  ServiceAssignment,
  ServiceCandidate,
  ServiceTeam,
} from '../../lib/member-service-api'
import { memberActions, overlaps } from '../../lib/member-service-model'

export function ServiceDetail({
  id,
  teams,
  zone,
  onClose,
  onChanged,
}: {
  id: string
  teams: ServiceTeam[]
  zone: string
  onClose: () => void
  onChanged: (item: ServiceAssignment) => void
}) {
  const { serviceApi } = useAuth()
  const { locale } = useLocale()
  const t = serviceMessages[locale]
  const [item, setItem] = useState<ServiceAssignment | null>(null)
  const [peers, setPeers] = useState<ServiceCandidate[]>([])
  const [conflicts, setConflicts] = useState<ServiceAssignment[]>([])
  const [contextReady, setContextReady] = useState(false)
  const [contextFailed, setContextFailed] = useState(false)
  const [peerFailed, setPeerFailed] = useState(false)
  const [error, setError] = useState<
    'load' | 'command' | 'stale' | 'unavailable' | null
  >(null)
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [action, setAction] = useState<MemberCommand['action'] | null>(null)
  const [mode, setMode] = useState<'open' | 'nominated'>('nominated')
  const [target, setTarget] = useState('')
  const [query, setQuery] = useState('')
  const submitting = useRef(false)
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setItem(null)
    setError(null)
    setPeers([])
    setPeerFailed(false)
    setAction(null)
    setContextReady(false)
    setContextFailed(false)
    setConflicts([])
    void serviceApi
      .getAssignment(id, controller.signal)
      .then(async (next) => {
        if (controller.signal.aborted) return
        setItem(next)
        const member = teams.find((team) => team.id === next.teamId)?.memberId
        if (
          !next.cancelled &&
          Date.parse(next.startsAt) > Date.now() &&
          (next.assigneeMemberId === member ||
            memberActions(next, member).includes('accept'))
        ) {
          // Meetings last at most 1440 minutes; include duties starting before this one.
          const from = new Date(
            Date.parse(next.startsAt) - 86400000,
          ).toISOString()
          void Promise.all(
            teams.map((team) =>
              serviceApi.listAssignments(
                team.id,
                from,
                next.endsAt,
                controller.signal,
              ),
            ),
          )
            .then((groups) => {
              if (!controller.signal.aborted) {
                setConflicts(groups.flat())
                setContextReady(true)
              }
            })
            .catch(() => {
              if (!controller.signal.aborted) setContextFailed(true)
            })
        } else setContextReady(true)
        try {
          const candidates = await serviceApi.listCandidates(
            next.teamId,
            controller.signal,
          )
          if (!controller.signal.aborted) setPeers(candidates)
        } catch {
          if (!controller.signal.aborted) setPeerFailed(true)
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof OperationsApiError &&
              [403, 404].includes(caught.status)
              ? 'unavailable'
              : 'load',
          )
      })
    return () => controller.abort()
  }, [serviceApi, id, revision, teams])
  const memberId = teams.find((team) => team.id === item?.teamId)?.memberId
  const actions = item ? memberActions(item, memberId) : []
  const isRequest = action === 'request' || action === 'switch'
  const dateFormat = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  async function send() {
    if (
      !item ||
      !action ||
      submitting.current ||
      !actions.includes(action) ||
      error === 'stale' ||
      error === 'unavailable'
    )
      return
    if (action === 'accept' && !contextReady) return
    if (
      isRequest &&
      mode === 'nominated' &&
      !peers.some((peer) => peer.id === target && peer.id !== memberId)
    )
      return
    const body: MemberCommand = {
      action,
      expectedVersion: item.version,
      ...(item.request?.status === 'active' && action !== 'help'
        ? { requestId: item.request.id }
        : {}),
      ...(isRequest
        ? { mode, ...(mode === 'nominated' ? { targetMemberId: target } : {}) }
        : {}),
    }
    const signature = JSON.stringify([item.id, body])
    if (retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() }
    submitting.current = true
    setPending(true)
    setError(null)
    setDone(false)
    try {
      const next = await serviceApi.command(item.id, body, retry.current.key)
      if (!alive.current) return
      retry.current = null
      setItem(next)
      setAction(null)
      setDone(true)
      onChanged(next)
    } catch (caught) {
      if (!alive.current) return
      if (
        caught instanceof OperationsApiError &&
        [409, 412].includes(caught.status)
      ) {
        setError('stale')
        setAction(null)
        retry.current = null
      } else if (
        caught instanceof OperationsApiError &&
        [403, 404].includes(caught.status)
      ) {
        setItem(null)
        setError('unavailable')
        setAction(null)
        retry.current = null
      } else setError('command')
    } finally {
      submitting.current = false
      if (alive.current) setPending(false)
    }
  }
  const failure =
    error === 'stale'
      ? t.stale
      : error === 'unavailable'
        ? t.unavailable
        : error === 'command'
          ? t.commandFailed
          : t.failed
  return (
    <Drawer
      isOpen
      title={t.detail}
      closeLabel={t.close}
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose()
      }}
    >
      <div className="member-service-detail">
        {error ? (
          <div>
            <p role="alert" className="form-error">
              {failure}
            </p>
            {error === 'load' || error === 'stale' ? (
              <Button
                variant="secondary"
                onPress={() => setRevision((v) => v + 1)}
              >
                {t.refresh}
              </Button>
            ) : null}
          </div>
        ) : null}
        {contextFailed ? (
          <div>
            <p role="alert">{t.failed}</p>
            <Button
              variant="secondary"
              onPress={() => setRevision((v) => v + 1)}
            >
              {t.refresh}
            </Button>
          </div>
        ) : null}
        {!item && !error ? <Skeleton label={t.loading} /> : null}
        {item ? (
          <>
            <small>{item.teamName}</small>
            <h2>{item.label}</h2>
            <div className="member-service-context">
              <strong>
                {dateFormat.formatRange(
                  new Date(item.startsAt),
                  new Date(item.endsAt),
                )}
              </strong>
              <span>{item.meetingName}</span>
              <span>
                {item.cancelled
                  ? t.cancelled
                  : item.assigneeMemberId === memberId
                    ? t.you
                    : item.assigneeName || t.unassigned}
              </span>
              <small>
                {zone}
                {item.timeZone !== zone ? ` · ${item.timeZone}` : ''}
              </small>
            </div>
            {conflicts.some(
              (other) =>
                teams.some(
                  (team) =>
                    team.id === other.teamId &&
                    team.memberId === other.assigneeMemberId,
                ) && overlaps(item, other),
            ) ? (
              <p role="status">{t.overlap}</p>
            ) : null}
            {item.needsAttention ? <p>{t.attention}</p> : null}
            {item.request?.status === 'active' ? (
              <p>{item.request.mode === 'open' ? t.open : t.waiting}</p>
            ) : null}
            {item.request?.status === 'declined' ? (
              <p>{t.declineStatus}</p>
            ) : item.request?.status === 'expired' ? (
              <p>{t.expired}</p>
            ) : item.request?.status === 'invalidated' ? (
              <p>{t.invalidated}</p>
            ) : null}
            {item.helpOpen ? (
              <p>{item.helpRecipients === 0 ? t.noLeaders : t.helpPending}</p>
            ) : null}
            {item.reminderAt ? (
              <p>
                {t.reminder} · {dateFormat.format(new Date(item.reminderAt))}
              </p>
            ) : null}
            {done ? <p role="status">{t.done}</p> : null}
            <div className="member-service-actions">
              {actions.map((value) => (
                <Button
                  key={value}
                  isDisabled={
                    pending ||
                    error === 'stale' ||
                    (value === 'accept' && !contextReady)
                  }
                  variant={
                    value === 'accept' || value === 'request'
                      ? 'primary'
                      : 'secondary'
                  }
                  onPress={() => {
                    setAction(value)
                    setDone(false)
                  }}
                >
                  {t[value]}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <Dialog
        isOpen={action !== null}
        title={action ? t[action] : ''}
        closeLabel={t.close}
        onOpenChange={(open) => {
          if (!open && !submitting.current) setAction(null)
        }}
      >
        <div className="member-service-detail">
          <strong>{item?.label}</strong>
          {isRequest ? (
            <>
              <div
                className="member-service-segments"
                role="group"
                aria-label={t.request}
              >
                <Button
                  variant="ghost"
                  aria-pressed={mode === 'nominated'}
                  isDisabled={pending}
                  onPress={() => setMode('nominated')}
                >
                  {t.person}
                </Button>
                <Button
                  variant="ghost"
                  aria-pressed={mode === 'open'}
                  isDisabled={pending}
                  onPress={() => setMode('open')}
                >
                  {t.public}
                </Button>
              </div>
              {mode === 'nominated' ? (
                peerFailed ? (
                  <p role="alert">{t.failed}</p>
                ) : (
                  <SearchableSelect
                    label={t.peer}
                    inputValue={query}
                    onInputChange={setQuery}
                    items={peers
                      .filter(
                        (peer) =>
                          peer.id !== memberId &&
                          peer.name
                            .toLocaleLowerCase()
                            .includes(query.trim().toLocaleLowerCase()),
                      )
                      .map((peer) => ({ id: peer.id, label: peer.name }))}
                    emptyText={t.noPeers}
                    loadingText={t.loading}
                    selectedKey={target}
                    selectedLabel={
                      peers.find((peer) => peer.id === target)?.name
                    }
                    onSelectionChange={setTarget}
                  />
                )
              ) : null}
              <p>{t.pendingHint}</p>
            </>
          ) : action === 'accept' ? (
            <p>{t.acceptHint}</p>
          ) : null}
          {error === 'command' ? (
            <p role="alert" className="form-error">
              {t.commandFailed}
            </p>
          ) : null}
          <Button
            isPending={pending}
            isDisabled={
              pending ||
              (isRequest && mode === 'nominated' && (!target || peerFailed))
            }
            onPress={() => void send()}
          >
            {isRequest ? (mode === 'open' ? t.public : t.submit) : t.confirm}
          </Button>
        </div>
      </Dialog>
    </Drawer>
  )
}
