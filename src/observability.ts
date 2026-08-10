import type { Breadcrumb } from '@sentry/react'

const sensitiveValue = /\b(code|token|access_token|refresh_token|id_token|verification_token|reset_token|sig|signature)=([^\s&#]+)/gi
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const absoluteUrl = /https?:\/\/[^\s"'<>]+/gi
const requestId = /^[A-Za-z0-9._:-]{1,128}$/
let addSentryBreadcrumb = (_breadcrumb: Breadcrumb) => {}

function sanitizeText(value: string) {
  return value
    .replace(absoluteUrl, (candidate) => {
      try {
        const url = new URL(candidate)
        return `${url.origin}${url.pathname}`
      } catch {
        return '[redacted-url]'
      }
    })
    .replace(email, '[redacted-email]')
    .replace(sensitiveValue, '$1=[redacted]')
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]'
  if (typeof value === 'string') return sanitizeText(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
  )
}

export function sanitizeSentryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeValue(event) as Record<string, unknown>
  delete sanitized.user

  const request = event.request
  if (request && typeof request === 'object' && 'url' in request && typeof request.url === 'string') {
    try {
      const url = new URL(request.url)
      sanitized.request = { url: `${url.origin}${url.pathname}` }
    } catch {
      delete sanitized.request
    }
  } else {
    delete sanitized.request
  }

  return sanitized
}

export function recordRequestId(
  response: Response,
  addBreadcrumb: (breadcrumb: Breadcrumb) => void = addSentryBreadcrumb,
) {
  const value = response.headers.get('X-HHC-Request-ID')
  if (!value || !requestId.test(value)) return
  addBreadcrumb({ category: 'http.request_id', level: 'info', data: { request_id: value } })
}

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  void import('@sentry/react').then((Sentry) => {
    addSentryBreadcrumb = Sentry.addBreadcrumb
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      sendDefaultPii: false,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1,
      tracePropagationTargets: [/^\/api\//, /^https:\/\/(?:www|account|admin)\.alive\.org\.tw\/api\//],
      beforeSend: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
      beforeSendTransaction: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
      beforeBreadcrumb: (breadcrumb) => sanitizeValue(breadcrumb) as Breadcrumb,
    })
  })
}
