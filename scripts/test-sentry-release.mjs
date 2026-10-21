import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
const vite = readFileSync('vite.config.ts', 'utf8')
const repo = JSON.parse(readFileSync('package.json', 'utf8')).name.split('/').at(-1)
const deploy = workflow.split('\n  deploy:\n')[1].split('\n  upload_sourcemaps:\n')[0]
const upload = workflow.split('\n  upload_sourcemaps:\n')[1]
const build = deploy.split('      - name: Build production site\n')[1].split('      - name: Capture current index')[0]
const guards = upload.split('      - name: Validate source-map artifact\n')[1].split('        run: |\n')[1].split('      - uses:')[0].replace(/^          /gm, '')
const command = upload.split('      - name: Upload exact private source maps\n')[1].split('        run: |\n')[1].split('      - name: Report')[0].replace(/^          /gm, '')
const sha = '1'.repeat(40)
const image = `alive.azurecr.io/alive/${repo}-sourcemaps@sha256:${'2'.repeat(64)}`

test('Sentry network publication follows deployment in an independent visibly failing job', () => {
  assert.match(upload, /^    needs: deploy$/m)
  assert.doesNotMatch(deploy, /sourcemaps upload|needs:.*upload_sourcemaps/)
  assert.doesNotMatch(upload, /continue-on-error|sourcemaps upload[^\n]*\|\|/)
  assert.match(upload, /if: always\(\)/)
  assert.doesNotMatch(vite, /SENTRY_AUTH_TOKEN|sentryVitePlugin/)
  assert.doesNotMatch(build, /^          SENTRY_AUTH_TOKEN:/m)
  assert.match(vite, /sourcemap: buildSourceMaps \? 'hidden' : false/)
})

test('exact private assets are saved before maps are removed from public dist', () => {
  assert.match(build, /sourcemaps inject dist/)
  assert.match(build, /anonymousPullEnabled[^\n]+== false/)
  assert.ok(build.indexOf('docker push') < build.indexOf("find dist -type f -name '*.map' -delete"))
  assert.ok(deploy.indexOf("find dist -type f -name '*.map' -delete") < deploy.indexOf('Publish immutable assets then index'))
  assert.match(build, /\[\[ "\$digest" =~ \^sha256:\[0-9a-f\]\{64\}\$ \]\] \|\| exit 1/)
  assert.equal(readFileSync('Dockerfile.sourcemaps', 'utf8'), 'FROM scratch\nARG BUILD_COMMIT\nLABEL org.opencontainers.image.revision=$BUILD_COMMIT\nCOPY assets/ /assets/\n')
})

test('artifact guards reject non-main refs, other repositories and mutable tags', () => {
  for (const env of [
    { GITHUB_REF: 'refs/pull/1/merge', SOURCE_MAPS_IMAGE: image },
    { GITHUB_REF: 'refs/heads/main', SOURCE_MAPS_IMAGE: image.replace(repo, 'other') },
    { GITHUB_REF: 'refs/heads/main', SOURCE_MAPS_IMAGE: image.replace(/@.*/, ':latest') },
    { GITHUB_REF: 'refs/heads/main', SOURCE_MAPS_IMAGE: `${image}\nextra` },
  ]) assert.notEqual(spawnSync('bash', ['-ec', guards], { env: { ...process.env, ...env } }).status, 0)
  assert.equal(spawnSync('bash', ['-ec', guards], { env: { ...process.env, GITHUB_REF: 'refs/heads/main', SOURCE_MAPS_IMAGE: image } }).status, 0)
})

test('literal provider 502 fails only the uploader command and rejects a wrong commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hhc-sentry-policy-'))
  try {
    const stubs = {
      az: '#!/bin/sh\ncase "$*" in *anonymousPullEnabled*) echo false;; esac\n',
      docker: '#!/bin/sh\ncase "$1" in inspect) printf "%s\\n" "$FIXTURE_IMAGE_SHA";; create) echo fixture-container;; esac\n',
      corepack: '#!/bin/sh\nprintf "%s\\n" "Sentry HTTP 502" >&2\nexit 42\n',
    }
    for (const [name, text] of Object.entries(stubs)) {
      writeFileSync(join(dir, name), text)
      chmodSync(join(dir, name), 0o700)
    }
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir, GITHUB_SHA: sha, FIXTURE_IMAGE_SHA: sha, SOURCE_MAPS_IMAGE: image, SENTRY_ORG: 'fixture', SENTRY_PROJECT: 'fixture' }
    const failure = spawnSync('bash', ['-ec', command], { env, encoding: 'utf8' })
    assert.equal(failure.status, 42)
    assert.match(failure.stderr, /Sentry HTTP 502/)
    const wrongCommit = spawnSync('bash', ['-ec', command], { env: { ...env, FIXTURE_IMAGE_SHA: '3'.repeat(40) }, encoding: 'utf8' })
    assert.equal(wrongCommit.status, 1)
    assert.doesNotMatch(wrongCommit.stderr, /Sentry HTTP 502/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
