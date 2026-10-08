# Service Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Account members can receive timely service notifications in their browser before mobile publication.
**Architecture:** Extend Operations installations and deliveries, reuse Notification's durable worker and Web Push provider, connect Account's push-only worker and existing authenticated transport.
**Tech Stack:** Go/PostgreSQL, TypeScript/React, native browser Push API, Terraform/Bicep.
**Spec:** ../../design/service-web-push-20261009.md

## Global Constraints

- Web scheduling management remains exclusively in Admin; no mobile store work.
- Reuse existing isolated task worktrees and preserve native/weekly notification behavior.
- Subscription data stays encrypted; private service calls retain exact caller gates.
- Feature flags default off. No cloud mutation without a reviewed preview.
- No roster/API/auth caching; five locales and shared UI controls.

## Review Focus

- Endpoint key rotation must not create two active owners: endpoint hash uniqueness (Task 1).
- Stale device callbacks cannot revoke a newer registration (Tasks 1/2).
- Provider success plus failed callback must retry only callback (Task 2).
- Logout and another tab subscribing concurrently must not revive the old account binding (Task 3).
- Cross-origin notification links and private data caching must be rejected (Task 3).

### Task 1: Operations installation and configuration

Files: operations-api/internal/postgres/service_push.go, new service_web_push.go/tests, additive migration, internal/httpapi/service_handlers.go/tests, cmd/server/main.go, openapi.yaml and contract tests.
Interfaces: ServiceInstallation gains subscription={endpoint,keys:{p256dh,auth}} with platform=web; native token unchanged. Protected GET /api/operations/me/service/push-config returns enabled, publicKey. Notification gets operations.web-push/web_push with the same opaque assignmentId and deliveryId. Eligibility tokenHash uses canonical subscription JSON.
- [x] Test malformed endpoint/key, mixed native/web input, encryption, ownership, idempotent registration, revoke and old-version fencing; observe failure.
- [x] Implement strict normalization, additive storage support, web/native dispatch and independent flags.
- [x] Add HTTP config authorization and canonical OpenAPI tests.
- [ ] Run go test -race ./... -p=1, go vet ./..., canonical OpenAPI lint; commit.

### Task 2: Notification Web Push delivery

Files: notification-api/internal/templates/registry.go, internal/worker/worker.go, internal/providers/webpush.go, internal/nativepush (shared eligibility/callback), cmd/notification/main.go, infra/main.bicep, release workflow, OpenAPI/tests.
Interfaces: operations.web-push accepts assignmentId/deliveryId only from operations-api. Recheck Operations eligibility before every provider attempt. Pass remaining TTL to Web Push provider; leave existing newsletter defaults unchanged. Persist terminal delivery outcome before callback retries.
- [x] Test template caller/field restrictions, stale eligibility, TTL, 410, retry and callback outage without provider replay; observe failure.
- [x] Wire template-specific guarded Web Push provider and durable result callbacks; independent default-off flag.
- [ ] Run race/unit/DB tests, OpenAPI and Bicep validation; commit.

### Task 3: Account browser lifecycle and generated contracts

Files: frontend-platform/packages/operations-client/openapi/operations-api.yaml and generated.ts; api-gateway service route policy/tests/OpenAPI; account-fe/src/lib/member-service-api.ts, new browser-service-push.ts/tests, src/pages/service/ServicePreferences.tsx/tests, auth/auth-context.tsx/tests, i18n/service.ts, public/service-worker.js, manifest/icon, index.html.
Interfaces: generated config and installation calls use existing authenticated Operations transport. Browser state distinguishes permission, subscription and server binding; serialized cross-tab operations fence logout/account changes.
- [x] Regenerate SDK from Task 1, add exact authenticated config route and contract tests.
- [x] Test permission denial, unsupported/iOS install state, partial registration/revoke failure, account switch/logout races and malicious click target; observe failure.
- [x] Implement explicit opt-in control, retryable lifecycle, minimal SW/manifest; use existing brand and shared UI.
- [ ] Run frontend full tests/lint/build, gateway contract/policy tests; render desktop/tablet/narrow light/dark; commit.

### Task 4: Configuration and release readiness

Files: azure-infra/container_apps.tf, identity.tf, tests/operations_workload.tftest.hcl, README; producer/consumer release configuration and dependency pins.
Interfaces: Operations web config public key matches worker VAPID public key; native and web delivery gates independent; existing encryption-key reference remains version pinned.
- [x] Test flag/key prerequisites and disabled behavior; implement reviewed config references without reading secret values.
- [ ] Obtain independent whole-change review, fix important findings, pass all required CI.
- [ ] Replace preview SDK pins only after approved package publication. Review actual Terraform plan before cloud changes.
- [ ] Verify deployed OAuth/deep links and a specifically authorized test device's actual receipt after approved release. Keep local tests, CI, release and real-device acceptance distinct.

## Execution ledger

Ruling: user requested continuation to completion after reviewing the design; implement inline without another routine confirmation loop. Cloud mutation review boundaries remain.
Pre-flight: Tasks 2/3 consume Task 1 canonical subscription and delivery IDs; Task 4 activates Task 1/2 flags only after their producer contracts exist.
Tasks 1–3: implemented and locally verified; new push-control browser rendering remains pending.
Task 4: configuration implemented and 25 mocked plans pass. Independent review findings fixed and re-reviewed. PR CI and fresh actual plan are in progress. Registry publication, cloud apply/release and real-device receipt remain gated.
