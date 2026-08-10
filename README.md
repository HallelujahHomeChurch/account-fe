# HHC Account

React account console for `account.alive.org.tw`.

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

Set `VITE_TURNSTILE_SITE_KEY` when public registration is enabled. Without it,
the widget stays hidden for local development and registration remains governed
by the API feature flag.

## Production delivery

GitHub Actions builds the Vite application and publishes it to the public
`site` container in the `hhcaccountfeprod` storage account. Hashed assets are
uploaded before `index.html`; a failed verification restores the previous
index. `api-gateway` remains the public origin for SPA fallback, security
headers, and `/api/*` routing.
