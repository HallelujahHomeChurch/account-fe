# Shared Social Auth Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse one third-party authentication component on Login and Register while keeping Login visually unchanged and placing the same provider options above the Register email form.

**Architecture:** Add one `SocialAuthOptions` module that owns provider metadata, capability loading, OAuth link creation, accessible labels, and optional divider placement. Login and Register each load capabilities once through the exported hook and render the same component with page-specific divider placement. Account API contracts and shared frontend packages remain unchanged.

**Tech Stack:** React 19, TypeScript, React Router, existing Account API client, Vitest, Testing Library.

## Global Constraints

- Modify only `account-fe`.
- Do not add dependencies or change Account API contracts.
- Login layout and visible copy must remain unchanged.
- Register renders third-party options before the email registration form.
- Do not add first-use, automatic-registration, or email-verification helper copy.
- Render only providers returned by the existing capabilities endpoint.
- Preserve `auth_request_id` in Login provider URLs.
- Capability failures hide social options without breaking email login or registration.

---

### Task 1: Share social authentication options across Login and Register

**Files:**
- Create: `src/components/SocialAuthOptions.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`
- Modify: `src/i18n/messages.ts`

**Interfaces:**
- Produces: `useAuthCapabilities(): AuthCapabilities | null`.
- Produces: `SocialAuthOptions({ providerIds, authRequestId, dividerLabel, dividerPosition })`.
- Preserves: the existing Login provider links, labels, order, divider, MFA suppression, and `auth_request_id` behavior.
- Adds: the same enabled provider links above the Register email form, followed by an email-registration divider.

- [x] **Step 1: Add the failing Register integration test**

Add a test to `src/pages/RegisterPage.test.tsx` using a real `RegisterPage` and injected Account API boundary:

```tsx
it('shows enabled social account options before the email registration form', async () => {
  const api: AuthApi = {
    login: async () => ({}),
    me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null,
    logout: async () => ({}),
    register: async () => ({}),
    getAuthCapabilities: async () => ({ providers: ['google', 'line'], registrationEnabled: true }),
    getSocialLoginUrl: (provider) => `/api/account/v1/oauth2/${provider}/login`,
  }

  render(
    <MemoryRouter initialEntries={['/register']}>
      <LocaleProvider>
        <AuthProvider api={api} restoreSession={false}><RegisterPage /></AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )

  const google = await screen.findByLabelText('Continue with Google')
  const socialPanel = google.closest('.social-login-panel')
  const form = document.querySelector('.form-stack')

  expect(google).toHaveAttribute('href', '/api/account/v1/oauth2/google/login')
  expect(screen.getByLabelText('Continue with LINE')).toBeInTheDocument()
  expect(screen.queryByLabelText('Continue with Microsoft')).not.toBeInTheDocument()
  expect(socialPanel?.compareDocumentPosition(form as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  expect(screen.getByText('Or create an account with email')).toBeInTheDocument()
})
```

Production change caught: removing Register's shared social component, rendering it below the form, or ignoring the API provider allowlist makes this test fail.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm test:run src/pages/RegisterPage.test.tsx
```

Expected: FAIL because Register currently has no Google or LINE social links.

- [x] **Step 3: Implement the shared capability hook and component**

Create `src/components/SocialAuthOptions.tsx` with:

```tsx
type SocialAuthOptionsProps = {
  providerIds: string[] | null
  authRequestId?: string
  dividerLabel: string
  dividerPosition?: 'before' | 'after'
}

export function useAuthCapabilities(): AuthCapabilities | null

export function SocialAuthOptions({
  providerIds,
  authRequestId,
  dividerLabel,
  dividerPosition = 'before',
}: SocialAuthOptionsProps)
```

The hook uses `auth.api.getAuthCapabilities()`, falls back to `getOAuthProviders()` for injected legacy test APIs, cancels stale state updates on unmount, and returns empty providers on failure. The component filters the fixed Google/LINE/Microsoft metadata by `providerIds`, builds links with `getSocialLoginUrl(provider, authRequestId)`, returns `null` when no valid link exists, and renders the existing CSS classes without adding helper copy.

- [x] **Step 4: Replace Login's inline implementation**

In `src/pages/LoginPage.tsx`:

- Remove local provider metadata, provider state, capability effect, social link memo, `SocialIcon`, and `socialLabel`.
- Call `const capabilities = useAuthCapabilities()` once.
- Derive `registrationEnabled` from `capabilities?.registrationEnabled === true`.
- Under the existing `!challenge` condition render:

```tsx
<SocialAuthOptions
  authRequestId={authRequestId}
  dividerLabel={t.login.socialDivider}
  providerIds={capabilities?.providers ?? null}
/>
```

The rendered divider, icon order, labels, hrefs, and placement after the email form must match the current page.

- [x] **Step 5: Add the component above Register's email form**

In `src/pages/RegisterPage.tsx`, call `useAuthCapabilities()` and render this immediately before `<Form>`:

```tsx
<SocialAuthOptions
  dividerLabel={t.registration.emailDivider}
  dividerPosition="after"
  providerIds={capabilities?.providers ?? null}
/>
```

Add only these locale values to `registration` in `src/i18n/messages.ts`:

```ts
emailDivider: '或使用 Email 建立帳戶' // zh-Hant
emailDivider: '或使用 Email 建立帐户' // zh-Hans
emailDivider: 'Or create an account with email' // en
```

Also make the existing Register description accurately present both choices without adding first-use helper copy:

```ts
description: '使用第三方帳號，或以 Email 建立帳戶。' // zh-Hant
description: '使用第三方帐号，或以 Email 建立帐户。' // zh-Hans
description: 'Continue with a social account, or create an account with email.' // en
```

- [x] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm test:run src/pages/RegisterPage.test.tsx src/pages/LoginPage.test.tsx
```

Expected: both files pass. Login's existing provider-order, provider-filtering, MFA, and `auth_request_id` assertions remain green; the new Register ordering test passes.

- [x] **Step 7: Run full verification**

Run:

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
```

Expected: all tests pass, lint exits successfully, and Vite produces the production bundle.

- [x] **Step 8: Commit and deliver through PR**

```bash
git add docs/superpowers/plans/2026-08-10-shared-social-auth-options.md \
  src/components/SocialAuthOptions.tsx \
  src/pages/LoginPage.tsx \
  src/pages/RegisterPage.tsx \
  src/pages/RegisterPage.test.tsx \
  src/i18n/messages.ts
git commit -m "feat: share social auth options"
```

Push `codex/shared-social-auth-options`, open a PR to `main`, wait for required CI, then merge and verify the release through the repository workflow. Do not deploy locally.

## Self-Review

- Scope coverage: shared component, one capability request per page, unchanged Login UI, Register placement, provider allowlist, error fallback, localization, TDD, and PR delivery are covered.
- Placeholder scan: no unresolved implementation steps or placeholder requirements remain.
- Type consistency: `providerIds` remains nullable during loading, `AuthCapabilities` is reused from `src/lib/api.ts`, and divider placement is the same union in every task step.
