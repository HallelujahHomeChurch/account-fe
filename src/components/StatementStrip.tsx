import { useEffect, useState } from 'react'

import { useLocale } from '../i18n/locale-context'
import { readRuntimeConfig } from '../lib/redirects'

type Statement = {
  title: string
  resolvedLocale: string
  href: string
  popupStartsAt: string | null
  popupEndsAt: string | null
}

type ActiveStatement = {
  serverNow: string
  nextChangeAt: string | null
  statement: Statement | null
}

export function StatementStrip() {
  const { locale, messages: t } = useLocale()
  const [statement, setStatement] = useState<Statement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending = false

    async function refresh() {
      if (pending || controller.signal.aborted) return
      pending = true
      try {
        const response = await fetch(`/api/statements/active?locale=${encodeURIComponent(locale)}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(`Statement request failed: ${response.status}`)
        const { data } = await response.json() as { data: ActiveStatement }
        if (controller.signal.aborted) return
        const now = Date.parse(data.serverNow)
        const active = data.statement && Date.parse(data.statement.popupStartsAt ?? '') <= now && now < Date.parse(data.statement.popupEndsAt ?? '')
        setStatement(active ? data.statement : null)
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
    window.addEventListener('focus', refresh)
    return () => {
      controller.abort()
      clearInterval(interval)
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [locale])

  const publicSiteUrl = readRuntimeConfig().publicSiteUrl
  const href = statement?.href
  const articleUrl = href?.startsWith('/') && !href.startsWith('//') && /^\/(?:zh-Hant|zh-Hans|en|ja|ko)\/statements\/[^/?#]+\/?$/.test(href)
    ? `${publicSiteUrl}${href}`
    : null
  if (!statement || !articleUrl) return null

  return <aside className="account-statement" aria-label={t.site.statement.notice}>
    <a href={articleUrl}>
      <span lang={statement.resolvedLocale}>{statement.title}</span>
      <strong>{t.site.statement.readFull} →</strong>
    </a>
  </aside>
}
