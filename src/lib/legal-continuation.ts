import { bulletinEditions } from '@hallelujahhomechurch/preferences'

const validIssueNumber = (value: string) => /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2_147_483_647

export function legalContinuation(value: string | null): string | null {
  if (!value || value.length > 2048 || /[\\\r\n]/.test(value)) return null
  if (/^\/resources(?:\/[A-Za-z0-9_-]{1,128})?$/.test(value)) return value
  try {
    const url = new URL(value)
    if (
      url.origin !== 'https://www.alive.org.tw' ||
      url.username ||
      url.password ||
      url.hash
    )
      return null
    const route = url.pathname.match(/^\/(zh-Hant|zh-Hans|en|ja|ko)\/(literature-ministry|member-videos|privacy-policy|terms-of-use)(.*)$/)
    if (!route) return null
    if (route[2] !== 'literature-ministry') return !route[3] && !url.search ? url.href : null
    if (route[3]) {
      const reader = route[3].match(/^\/([1-9]\d{0,9})\/read\/(general|children)\/(zh-Hant|zh-Hans|en)$/)
      return !url.search && reader && validIssueNumber(reader[1]) && bulletinEditions.some(edition => edition.series === reader[2] && edition.locale === reader[3]) ? url.href : null
    }
    const allowed: Record<string, (value: string) => boolean> = {
      series: value => value === 'general' || value === 'children',
      contentLocale: value => ['zh-Hant', 'zh-Hans', 'en'].includes(value),
      issueNumber: validIssueNumber,
      page: value => /^[1-9]\d{0,5}$/.test(value),
      mode: value => value === 'online' || value === 'pdf',
    }
    for (const [key, entry] of url.searchParams) {
      if (!Object.hasOwn(allowed, key) || url.searchParams.getAll(key).length !== 1 || !allowed[key](entry)) return null
    }
    if (url.searchParams.has('issueNumber') || url.searchParams.has('contentLocale')) {
      if (['series', 'contentLocale'].some(key => url.searchParams.getAll(key).length !== 1) ||
        !bulletinEditions.some(edition => edition.series === url.searchParams.get('series') && edition.locale === url.searchParams.get('contentLocale'))) return null
    }
    return url.href
  } catch {
    return null
  }
}
