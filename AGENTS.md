# Repository Instructions

## Delivery Policy

- Treat `main` as the production branch. Do not commit or push directly to `main`.
- Create a focused branch for every task and submit changes through a pull request.
- CI must pass before merge. Do not bypass, ignore, or merge around a failing required check.
- Keep changes small and reviewable, and use squash merge unless the repository explicitly requires another strategy.
- For deployable applications and services, a merge to `main` is the release boundary: build an immutable artifact, deploy it through CI/CD, then verify health and the production route.
- Never deploy an unmerged local commit or replace the CI/CD path with an ad hoc production command.
- If deployment fails, preserve the last healthy revision, report the failure, and use the repository rollback path.

## Architecture and local verification

- React/Vite account portal, distinct from `account-web`. Owns account-facing login, security, profile and preferences UX; APIs retain authentication, authorization and data ownership.
- `src/auth` owns session integration; `src/pages`, `src/components`, `src/features` and `src/i18n` own views and localization; `src/lib` contains adapters/helpers. Reuse versioned Account/Operations clients and shared UI/preferences packages rather than copying their contracts.
- Read [README.md](README.md), [package.json](package.json), [vite.config.ts](vite.config.ts) and [.github/workflows/ci.yml](.github/workflows/ci.yml). Use Node/pnpm versions from the manifest. `corepack pnpm install --frozen-lockfile` requires approved GitHub Packages registry access through the existing NODE_AUTH_TOKEN configuration; never print or extract tokens.
- `corepack pnpm dev:mock` serves UI on 127.0.0.1:5174 without Account API; `corepack pnpm dev` uses the Vite proxy to Account API at 127.0.0.1:8080. Mock success does not validate provider redirects or real sessions. Test with `corepack pnpm test:run`, `corepack pnpm lint` and `corepack pnpm build`.
- Keep sensitive account data out of analytics/logs and keep frontend permissions as UX only. Public website organization management belongs to its owning application; do not silently restore retired Account management routes.

The commands above are source-defined entrypoints, not a record of successful execution. Report installation, local tests, Linux startup, CI and live acceptance separately.

## Multi-repository Codex tasks

Read the checked-out `hhc-planning/AGENTS.md` and
`hhc-planning/docs/cloud-environments.md` first and record its revision.
Sibling repositories do not inherit it automatically. This repository owns its
setup/tests; use the task’s smallest runtime set and preserve active writers in
isolated worktrees. Follow explicit review/merge/deployment authority. Pure human
documentation uses lightweight checks; source, workflow/configuration, executable
skills and mixed changes retain full verification.

If no sibling planning checkout exists, use the [single-repository fallback](https://github.com/HallelujahHomeChurch/hhc-planning/blob/73ee1af2a1ff828d72421a73626f45ff4ce04a6f/docs/cloud-environments.md#single-repository-checkout)
to read the same entry documents through authorized GitHub access at the task’s
immutable planning revision. Record that revision; report the exact inaccessible
target/error without expanding permissions or copying private text here.
