export function legalContinuation(value: string | null): string | null {
  if (!value || value.length > 2048 || /[\\\r\n]/.test(value)) return null
  if (/^\/resources(?:\/[A-Za-z0-9_-]{1,128})?$/.test(value)) return value
  try {
    const url = new URL(value)
    if (
      url.origin !== 'https://www.alive.org.tw' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    if (
      !/^\/(zh-Hant|zh-Hans|en|ja|ko)\/(literature-ministry|member-videos|privacy-policy|terms-of-use)$/.test(
        url.pathname,
      )
    )
      return null
    return url.href
  } catch {
    return null
  }
}
