# HHC Account

React account console for `account.alive.org.tw`.

## License

The source is publicly visible but remains all rights reserved. See
[LICENSE](LICENSE).

## Mock mode

Use mock mode when you want to test the UI without `account-api`.

```bash
NODE_AUTH_TOKEN="$(gh auth token)" corepack pnpm install
corepack pnpm dev:mock
```

Open `http://127.0.0.1:5174/login`.

Mock credentials:

- username: `admin`
- password: `admin123`

Mock mode covers login, registration, social onboarding, profile editing, password change, MFA setup/disable, devices, and linked accounts. It does not perform real provider redirects.

## Real API mode

```bash
corepack pnpm dev
```

The Vite dev server proxies `/api/account/*` to `http://127.0.0.1:8080`.

Set `VITE_TURNSTILE_SITE_KEY` for public registration and password login. Without
it, the widget stays hidden for local development and server verification remains
governed by the Account API configuration.

## Production delivery

`azure-infra` owns the storage account, default Blob service (including retention
and versioning), and public `site` container. This repository references those
existing resources and verifies the container before publishing; it no longer
provisions or updates their platform settings, or runs an empty ARM deployment.
Provision them centrally before
an initial release. The explicit `provisionPermissions` bootstrap option and
existing publisher RBAC remain unchanged. Content upload, verification and index
rollback remain owned by this release workflow.

GitHub Actions builds the Vite application and publishes it to the public
`site` container in the `hhcaccountfeprod` storage account. Hashed assets are
uploaded before `index.html`; a failed verification restores the previous
index. `api-gateway` remains the public origin for SPA fallback, security
headers, and `/api/*` routing.

## Production native callback configuration

Native OAuth callbacks are restricted to `hhc-presenter://auth/account`.
Set `VITE_ALLOWED_REDIRECT_SCHEMES=hhc-presenter` in the production build
environment; no other native scheme is supported.

## Legal review and optional analytics

`/legal` reads qualified current documents and the signed-in account's acceptance
history through the existing Account transport. The confirmation binds the exact
snapshot displayed and resets on version or language changes. Legacy records show
that no historical document was retained instead of substituting today's text.
Resource requests requiring confirmation lead to this review page; own request
history and cancellation keep their existing owner authorization.

`VITE_GA_MEASUREMENT_ID` stays unset until reviewed disclosure and GA stream
settings are ready. Only production `account.alive.org.tw`, explicit analytics
consent, and query/fragment-free login or general profile pages are eligible.
Sensitive routes reload before mounting when GA has started. Only successful
interactive login and ordinary profile saves emit fixed events; hydration and
session refresh do not. No account identity or form data is sent to analytics.

## Account settings

Devices are managed within Security; email newsletter preferences are part of
Personalization. Legacy device and notification URLs redirect to those sections.
Church statements are shown only on the public website; required legal review
and analytics consent remain available in Account.

## Small-group management migration

Management now lives at the public site's localized `/organizations` routes.
Account removes its management UI, avatar/navigation/search entries and clients;
no legacy management redirect is provided. Removed URLs follow the existing
Account unknown-route behavior. Resources, reservations and member-details
eligibility keep their existing Operations access.
Release Gateway's WWW allowlist and WWW before this Account UI removal.

## Source-map publication

Production compilation only generates hidden maps and injects debug IDs locally.
It preserves the exact client assets in the existing private ACR, removes all maps
from `dist`, then publishes the normal immutable assets and index. An independent
`upload_sourcemaps` job uploads that digest to Sentry with the merged commit as
release. Provider failure stays visible as a failed job after website deployment;
retry that job alone without rebuilding or publishing the site. No public GitHub
artifact, new Azure resource or RBAC change is used. Private retry artifacts are
retained; no retention or cost-saving claim is made by this change.
