#!/bin/sh
set -eu

workflow=.github/workflows/release.yml

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
grep -q 'errorHandler: (error) => { throw error }' vite.config.ts
grep -q '^Disallow: /$' public/robots.txt
