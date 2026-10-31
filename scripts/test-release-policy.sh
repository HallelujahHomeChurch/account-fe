#!/bin/sh
set -eu

workflow=.github/workflows/release.yml
ci_workflow=.github/workflows/ci.yml
scanner='ghcr.io/aquasecurity/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969'

for scanned_workflow in "$ci_workflow" "$workflow"; do
  grep -Fq "$scanner" "$scanned_workflow"
  grep -Fq 'fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1' "$scanned_workflow"
  grep -Fq -- '--skip-dirs /workspace/.git --skip-dirs /workspace/node_modules /workspace' "$scanned_workflow"
done

grep -q 'workflow_dispatch:' "$workflow"
grep -q '^  push:' "$workflow"
grep -q 'branches: \[main\]' "$workflow"
grep -Fq "github.event_name == 'push' && 'deploy-account-fe-production' || inputs.confirmation" "$workflow"
grep -q 'deploy-account-fe-production' "$workflow"
grep -q 'GITHUB_REF.*refs/heads/main' "$workflow"
grep -q 'STORAGE_ACCOUNT: hhcaccountfeprod' "$workflow"
grep -q 'corepack pnpm build' "$workflow"
grep -q 'az storage blob upload-batch' "$workflow"
grep -q 'az storage blob upload' "$workflow"
grep -q -- '--auth-mode login' "$workflow"
grep -q 'PREVIOUS_INDEX_EXISTS=' "$workflow"
grep -q 'Restore previous index' "$workflow"
grep -q 'az bicep build --file infra/main.bicep' .github/workflows/ci.yml
! grep -q 'az containerapp' "$workflow"
! grep -q 'docker build' .github/workflows/ci.yml
[ ! -e Dockerfile ]
[ ! -e nginx.conf ]
node --test scripts/test-sentry-release.mjs
grep -q '^Disallow: /$' public/robots.txt

# Platform storage must remain centrally owned; publisher RBAC is explicit opt-in.
for resource in storage blobService site; do
  grep -Eq "^resource $resource '[^']+' existing = \{" infra/main.bicep
done
! grep -Eq 'allowSharedKeyAccess|deleteRetentionPolicy|isVersioningEnabled|publicAccess:' infra/main.bicep
grep -Fq '= if (provisionPermissions)' infra/main.bicep
grep -Fq 'az storage container-rm show' "$workflow"
grep -Fq '[[ "$access" == Blob ]]' "$workflow"
! grep -Eq 'az deployment group (what-if|create)' "$workflow"
