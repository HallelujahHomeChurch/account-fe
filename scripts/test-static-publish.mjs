import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/release.yml', 'utf8')
const publish = workflow.split('      - name: Publish immutable assets then index\n')[1]
  .split('        run: |\n')[1].split('      - name: Verify static origin')[0].replace(/^          /gm, '')

for (const assets of [true, false]) test(`publish every file once, index last (assets=${assets})`, () => {
  const dir = mkdtempSync(join(tmpdir(), 'account-static-publish-'))
  try {
    const put = (path, body) => {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), body)
    }
    put('dist/index.html', 'index')
    put('dist/robots.txt', 'robots')
    put('dist/.well-known/security.txt', 'security')
    if (assets) put('dist/assets/nested/app-hash.js', 'javascript')
    mkdirSync(join(dir, 'temp'))
    put('az', `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2);
const value = name => args[args.indexOf(name) + 1];
const files = [];
if (args[2] === 'upload-batch') {
  const source = value('--source');
  const walk = sub => {
    for (const entry of fs.readdirSync(path.join(source, sub), { withFileTypes: true })) {
      const relative = path.join(sub, entry.name);
      if (entry.isDirectory()) walk(relative);
      else files.push(path.posix.join(args.includes('--destination-path') ? value('--destination-path') : '', relative));
    }
  };
  walk('');
} else files.push(value('--name'));
fs.appendFileSync(process.env.PUBLISH_EVENTS, JSON.stringify({ files, cache: value('--content-cache-control'), login: value('--auth-mode') }) + '\\n');
if (process.env.FAIL_ASSETS === 'true' && files.some(file => file.startsWith('assets/'))) process.exit(42);
`)
    chmodSync(join(dir, 'az'), 0o700)
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: join(dir, 'temp'),
      STORAGE_ACCOUNT: 'fixture', STORAGE_CONTAINER: 'site', PUBLISH_EVENTS: join(dir, 'events') }
    const result = spawnSync('bash', ['-euc', publish], { cwd: dir, env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const events = readFileSync(env.PUBLISH_EVENTS, 'utf8').trim().split('\n').map(JSON.parse)
    const files = events.flatMap(event => event.files)
    assert.deepEqual(files.toSorted(), ['.well-known/security.txt', 'index.html', 'robots.txt', ...(assets ? ['assets/nested/app-hash.js'] : [])].toSorted())
    assert.deepEqual(events.at(-1).files, ['index.html'])
    for (const event of events) {
      assert.equal(event.login, 'login')
      assert.equal(event.cache, event.files.some(file => file.startsWith('assets/')) ? 'public, max-age=31536000, immutable' : 'no-cache, no-store, must-revalidate')
    }
    if (assets) {
      put('dist/index.html', 'index')
      put('dist/assets/nested/app-hash.js', 'javascript')
      rmSync(join(dir, 'temp'), { recursive: true })
      mkdirSync(join(dir, 'temp'))
      rmSync(env.PUBLISH_EVENTS)
      const failed = spawnSync('bash', ['-euc', publish], { cwd: dir, env: { ...env, FAIL_ASSETS: 'true' }, encoding: 'utf8' })
      assert.equal(failed.status, 42, failed.stderr)
      assert.doesNotMatch(readFileSync(env.PUBLISH_EVENTS, 'utf8'), /index.html/)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
