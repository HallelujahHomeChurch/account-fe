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

## Church statement preferences

The profile statement shares the signed-in Website API dismissal with WWW and
all account devices. Anonymous dismissal uses the shared preferences package in
one browser. A newly published version prompts again, while the publication
window still controls availability. Auth bootstrap, stale account/version
responses and failed preference requests are handled before showing a popup.

Website client and browser preferences use the exact published
frontend-platform v1.0.47 packages and registry lockfile.
