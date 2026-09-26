import type { Breadcrumb } from '@sentry/react'

const sensitiveValue = /\b(code|token|access_token|refresh_token|id_token|verification_token|reset_token|sig|signature)=([^\s&#]+)/gi
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const absoluteUrl = /https?:\/\/[^\s"'<>]+/gi
const requestId = /^[A-Za-z0-9._:-]{1,128}$/
let addSentryBreadcrumb = (_breadcrumb: Breadcrumb) => {}
let sentryReady: Promise<typeof import('@sentry/react') | undefined> | undefined
type ApiContext = { operation: string; method: string }
type FailureKind = 'network' | 'http' | 'invalid_response'
const responseContexts = new WeakMap<Response, ApiContext>()

export function isAbortError(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

export function reportApiFailure(context: ApiContext, kind: FailureKind, response?: Response) {
  const id = response?.headers.get('X-HHC-Request-ID')
  // Never capture the original exception: it can contain response bodies or search input.
  const error = new Error(`API request failed (${kind})`)
  error.name = 'ApiRequestFailure'
  void initObservability()?.then(sentry => {
    sentry?.captureException(error, {
      tags: { api_failure: kind, operation: context.operation, method: context.method },
      contexts: { api: { ...context, ...(response ? { status: response.status } : {}), ...(id && requestId.test(id) ? { request_id: id } : {}) } },
      fingerprint: ['api-failure', context.operation, context.method, kind],
    })
  }).catch(() => {})
}

export function reportResponseFailure(response: Response, kind: FailureKind) {
  const context = responseContexts.get(response)
  if (context) reportApiFailure(context, kind, response)
}

/** Scoped to the supplied client; preserves arguments, response and retry ownership. */
export function observeApiFetch(fetcher: typeof fetch, operation: string): typeof fetch {
  return async (input, init) => {
    const context = { operation, method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() }
    let response: Response
    try { response = await fetcher(input, init) }
    catch (error) {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
      if (!signal?.aborted && !isAbortError(error)) reportApiFailure(context, 'network')
      throw error
    }
    responseContexts.set(response, context)
    recordRequestId(response)
    if (response.status >= 500) reportApiFailure(context, 'http', response)
    return response
  }
}

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

  if ((sanitized.tags as Record<string, unknown> | undefined)?.api_failure) {
    // Caught API failures need request correlation, not UI text, route IDs or form data.
    delete sanitized.request
    delete sanitized.breadcrumbs
    delete sanitized.extra
    sanitized.transaction = (sanitized.tags as Record<string, unknown>).operation
    return sanitized
  }

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
  if (sentryReady) return sentryReady
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  sentryReady = import('@sentry/react').then((Sentry) => {
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
    return Sentry
  }).catch(() => undefined)
  return sentryReady
}
