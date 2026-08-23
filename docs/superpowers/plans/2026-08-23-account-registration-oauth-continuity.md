# Account Registration OAuth Continuity Plan

## Global Constraints

- Work on `fix/oauth-registration-continuity` from latest `origin/main`.
- Treat `auth_request_id` as opaque and encode it with `URLSearchParams`.
- Do not change account-api, OAuth TTL, PKCE/state, callback allowlists, or social auth contracts.
- Use TDD; run focused tests, full tests, lint, and build.

### Task 1: Preserve authorization request through registration

Login's Create account link must preserve an existing `auth_request_id`. Register must read the same
ID and preserve it in Back to login, successful post-registration navigation, and all
`SocialAuthOptions` links. Without an ID, URLs remain unchanged. Add LoginPage and RegisterPage
behavior tests for special-character encoding, success, back navigation, and social providers.

### Task 2: Verify account frontend

Run full lint, tests, and production build. Record the cross-app browser-to-`librepresenter://auth/account`
round trip as a manual gate; do not deploy, push, merge, or mutate production.
