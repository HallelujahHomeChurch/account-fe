# account-fe

React account console for `account.alive.org.tw`.

## Mock mode

Use mock mode when you want to test the UI without `account-api`.

```bash
npm run dev:mock
```

Open `http://127.0.0.1:5174/login`.

Mock credentials:

- username: `admin`
- password: `admin123`

Mock mode covers login, profile editing, password change, MFA setup/disable, devices, and linked accounts. It does not perform real social provider redirects.

## Real API mode

```bash
npm run dev
```

The Vite dev server proxies `/api/account/*` to `http://127.0.0.1:8080`.
