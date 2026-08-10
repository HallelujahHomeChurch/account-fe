#!/bin/sh
set -eu

workflow=.github/workflows/release.yml

grep -q 'workflow_dispatch:' "$workflow"
grep -q '^  push:' "$workflow"
grep -q 'branches: \[main\]' "$workflow"
grep -Fq "github.event_name == 'push' && 'deploy-account-fe-production' || inputs.confirmation" "$workflow"
grep -q 'deploy-account-fe-production' "$workflow"
grep -q 'GITHUB_REF.*refs/heads/main' "$workflow"
grep -q 'IMAGE_TAG=main-${GITHUB_SHA::7}' "$workflow"
grep -q 'IMAGE_REF=.*@${digest}' "$workflow"
grep -q 'PREVIOUS_IMAGE_REF=' "$workflow"
grep -q -- '--image "$PREVIOUS_IMAGE_REF"' "$workflow"
grep -q 'az containerapp revision copy' "$workflow"
grep -q 'errorHandler: (error) => { throw error }' vite.config.ts
grep -q '^Disallow: /$' public/robots.txt
