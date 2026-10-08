import { useEffect, useRef, useState } from 'react'

import {createHhcWebClient, type ActiveStatement, type PublicContentItem} from '@hallelujahhomechurch/hhc-web-client'
import {readAnonymousStatementDismissal, writeAnonymousStatementDismissal, statementRefKey} from '@hallelujahhomechurch/preferences'
import {useAuth} from '../auth/auth-context'
import { useLocale } from '../i18n/locale-context'
import { readRuntimeConfig } from '../lib/redirects'
import { StatementDialog, type StatementContent } from './StatementDialog'

type Statement = PublicContentItem & StatementContent
const prompted = new Set<string>()

export function StatementStrip() {
  const auth = useAuth()
  const subject = auth.status === 'authenticated' ? auth.profile?.id ?? null : auth.status === 'anonymous' ? 'anonymous' : null
  const { locale, messages: t } = useLocale()
  const [statement, setStatement] = useState<Statement | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [preference, setPreference] = useState<{key: string; hidden: boolean} | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const scope = useRef<{controller: AbortController; client: ReturnType<typeof createHhcWebClient>; subject: string | null; key?: string | null} | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let token = auth.accessToken
    const client = createHhcWebClient({baseUrl: `${location.origin}/api`, getAccessToken: () => token, refreshAfterUnauthorized: async () => {
      if (controller.signal.aborted) return null
      token = await auth.api.refreshAccessToken()
      return controller.signal.aborted ? null : token
    }})
    scope.current = {controller, client, subject, key: scope.current?.subject === subject ? scope.current.key : null}
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false

    async function refresh() {
      if (pending || controller.signal.aborted) return
      pending = true
      try {
        const data: ActiveStatement = await client.getActiveStatement(locale, controller.signal)
        if (controller.signal.aborted) return
        const now = Date.parse(data.serverNow)
        const active = data.statement && Date.parse(data.statement.popupStartsAt ?? '') <= now && now < Date.parse(data.statement.popupEndsAt ?? '')
        setStatement(active ? data.statement as Statement : null)
        if (subject && active && data.statement) {
          const ref = {statementId: data.statement.id, publishedVersion: data.statement.publishedVersion ?? 0}
          const key = `${subject}:${statementRefKey(ref)}`
          try {
            const hidden = subject === 'anonymous' ? readAnonymousStatementDismissal(ref) : (await client.getStatementDismissal(ref, controller.signal)).dismissed
            if (!controller.signal.aborted) setPreference({key, hidden})
          } catch {
            if (!controller.signal.aborted) setPreference({key, hidden: true})
          }
        }
        clearTimeout(timer)
        if (data.nextChangeAt) timer = setTimeout(() => {
          setStatement(null)
          void refresh()
        }, Math.min(2_147_483_647, Math.max(1_000, Date.parse(data.nextChangeAt) - now)))
      } catch {
        if (!controller.signal.aborted) setStatement(null)
      } finally {
        pending = false
      }
    }

    void refresh()
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60_000)
    const visibleRefresh = () => {if (document.visibilityState === 'visible') void refresh()}
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => {
      controller.abort()
      clearInterval(interval)
      clearTimeout(timer)
      window.removeEventListener('focus', visibleRefresh)
      document.removeEventListener('visibilitychange', visibleRefresh)
    }
  }, [locale, subject, auth.accessToken, auth.api])

  const ref = statement ? {statementId: statement.id, publishedVersion: statement.publishedVersion ?? 0} : null
  const key = subject && ref && Number.isSafeInteger(ref.publishedVersion) && ref.publishedVersion > 0 ? `${subject}:${statementRefKey(ref)}` : null
  const saving = savingKey === key && key !== null
  useEffect(() => {if (scope.current) scope.current.key = key}, [key])
  useEffect(() => {
    if (!key || preference?.key !== key || preference.hidden) {setOpenKey(null); return}
    if (!prompted.has(key)) {prompted.add(key); setOpenKey(key)}
  }, [key, preference])
  async function close(hidden: boolean) {
    if (saving || !ref || !key) return
    const current = scope.current
    setErrorKey(null)
    if (hidden) {
      setSavingKey(key)
      try {
        if (subject === 'anonymous') {
          if (!writeAnonymousStatementDismissal(ref)) throw new Error('Statement preference storage unavailable')
        } else {
          if (!current || current.subject !== subject) return
          await current.client.dismissStatement(ref, current.controller.signal)
        }
      } catch {
        if (current?.controller.signal.aborted || scope.current !== current || current?.key !== key) return
        setErrorKey(key)
      } finally {
        setSavingKey(value => value === key ? null : value)
      }
    }
    if (!current?.controller.signal.aborted && scope.current === current && current?.key === key) setOpenKey(null)
  }

  const publicSiteUrl = readRuntimeConfig().publicSiteUrl
  const href = statement?.href
  const articleUrl = href?.startsWith('/') && !href.startsWith('//') && /^\/(?:zh-Hant|zh-Hans|en|ja|ko)\/statements\/[^/?#]+\/?$/.test(href)
    ? `${publicSiteUrl}${href}`
    : null
  if (!statement || !articleUrl) return null

  return <>
    <aside className="account-statement" aria-label={t.site.statement.notice}>
      <a href={articleUrl}>
        <span lang={statement.resolvedLocale}>{statement.title}</span>
        <strong>{t.site.statement.readFull} →</strong>
      </a>
    </aside>
    {errorKey === key && key ? <p role="status">{t.site.statement.syncError}</p> : null}
    {openKey === key && key ? <StatementDialog key={key} statement={statement} labels={t.site.statement} saving={saving} onClose={close} /> : null}
  </>
}
