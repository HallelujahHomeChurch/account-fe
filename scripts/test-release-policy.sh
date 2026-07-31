#!/bin/sh
set -eu

workflow=.github/workflows/release.yml

grep -q 'workflow_dispatch:' "$workflow"
grep -q 'deploy-account-fe-production' "$workflow"
grep -q 'GITHUB_REF.*refs/heads/main' "$workflow"
if grep -q '^  push:' "$workflow"; then
  echo 'production release must not run automatically on push' >&2
  exit 1
fi
grep -q 'IMAGE_TAG=main-${GITHUB_SHA::7}' "$workflow"
grep -q 'IMAGE_REF=.*@${digest}' "$workflow"
grep -q 'PREVIOUS_IMAGE_REF=' "$workflow"
grep -q -- '--image "$PREVIOUS_IMAGE_REF"' "$workflow"
grep -q 'az containerapp revision copy' "$workflow"
grep -q '^Disallow: /$' public/robots.txt
