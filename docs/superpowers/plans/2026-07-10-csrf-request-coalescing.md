# Account FE CSRF Request Coalescing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent concurrent `AccountApi` instances from issuing multiple initial CSRF token requests and overwriting the shared browser cookie during React Strict Mode startup.

**Architecture:** Keep the existing per-instance `csrfToken` cache, and add a module-level map of in-flight CSRF requests keyed by API base URL. Concurrent clients for the same account-api base URL await one request and reuse its response token. Failed requests are removed from the map so later calls can retry naturally. The account-api backend remains responsible for reusing an already-valid cookie.

**Tech Stack:** TypeScript, existing `AccountApi`, Vitest.

## Global Constraints

- Do not add dependencies, HTTP retries, cookie parsing, or new endpoints.
- Only concurrent token acquisition is coalesced; every `AccountApi` instance still caches its own resolved token.
- The map must be keyed by `baseUrl` so unrelated API origins cannot share tokens.
- A rejected token request must not poison future requests.
- Use TDD: the concurrent-client test must fail before production code changes.

---

### Task 1: Coalesce concurrent CSRF token requests

**Files:**
- Create: `docs/superpowers/plans/2026-07-10-csrf-request-coalescing.md`
- Modify: `src/lib/api.ts:1-8,185-205`
- Modify: `src/lib/api.test.ts:1-140`

**Interfaces:**
- Consumes: `AccountApi` instances configured with the same `baseUrl`.
- Produces: `getCsrfToken()` behavior where concurrent callers await one `GET <baseUrl>/csrf-token` request and receive the same token.
- Preserves: existing request headers, credentials, CSRF validation contract, and per-instance token cache.

- [ ] **Step 1: Add the failing concurrency test**

Add this test to `src/lib/api.test.ts`:

```ts
it('coalesces concurrent csrf token requests across clients with the same base URL', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  let csrfCalls = 0
  let releaseCsrf!: (response: Response) => void
  const csrfResponse = new Promise<Response>((resolve) => {
    releaseCsrf = resolve
  })
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init })
    if (String(input).endsWith('/csrf-token')) {
      csrfCalls += 1
      return csrfResponse
    }
    return jsonResponse({ message: 'ok' })
  }
  const first = new AccountApi({ baseUrl: '/api/account/v1', fetcher })
  const second = new AccountApi({ baseUrl: '/api/account/v1', fetcher })

  const firstRequest = first.forgotPassword('first@example.com')
  const secondRequest = second.forgotPassword('second@example.com')

  expect(csrfCalls).toBe(1)
  releaseCsrf(jsonResponse({ csrf_token: 'csrf-shared' }))
  await Promise.all([firstRequest, secondRequest])

  expect(calls.filter((call) => String(call.input).endsWith('/csrf-token'))).toHaveLength(1)
  expect(calls.filter((call) => String(call.input).endsWith('/forgot-password'))).toHaveLength(2)
  expect(calls.slice(-2).every((call) => new Headers(call.init?.headers).get('x-csrf-token') === 'csrf-shared')).toBe(true)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- --run src/lib/api.test.ts
```

Expected: the new test fails because each `AccountApi` instance currently starts its own `/csrf-token` request.

- [ ] **Step 3: Add the minimal base-URL keyed in-flight map**

Add this module-level map near the `AccountApi` declarations:

```ts
const csrfTokenRequests = new Map<string, Promise<string>>()
```

Replace `getCsrfToken()` with the following behavior while keeping the existing response validation:

```ts
private async getCsrfToken() {
  if (this.csrfToken) return this.csrfToken

  let request = csrfTokenRequests.get(this.baseUrl)
  if (!request) {
    request = this.fetcher(`${this.baseUrl}/csrf-token`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    }).then(async (response) => {
      const data = await this.readResponse<{ csrf_token?: string }>(response)
      if (!data.csrf_token) {
        throw new ApiError(response.status, 'CSRF token missing')
      }
      return data.csrf_token
    }).finally(() => {
      csrfTokenRequests.delete(this.baseUrl)
    })
    csrfTokenRequests.set(this.baseUrl, request)
  }

  this.csrfToken = await request
  return this.csrfToken
}
```

- [ ] **Step 4: Run focused and full frontend validation**

Run:

```bash
npm test -- --run src/lib/api.test.ts
npm test -- --run
npm run lint
npm run build
```

Expected: all Vitest tests pass, lint exits successfully, and Vite produces a production build.

- [ ] **Step 5: Run the real browser smoke test**

With account-api, notification-api, and account-fe running, load `http://127.0.0.1:5173/forgot-password` and submit `e2e-28704-1783619404@example.test`. Expected: account-api logs no 403 for the form request, the page shows the generic reset-link success message, and notification-api logs one reset URL because `LOG_EMAIL_BODY=true` is enabled.

- [ ] **Step 6: Commit the account-fe task**

```bash
git add src/lib/api.ts src/lib/api.test.ts docs/superpowers/plans/2026-07-10-csrf-request-coalescing.md
git commit -m "fix: coalesce concurrent csrf token requests"
```

## Self-Review

- Scope coverage: concurrent startup race, base URL isolation, rejected-request cleanup, existing token cache, tests, browser proof, and commit are covered.
- Placeholder scan: no unresolved behavior or generic test instructions remain.
- Type consistency: the map stores `Promise<string>`, matching the response token assigned to each instance's `csrfToken`.
