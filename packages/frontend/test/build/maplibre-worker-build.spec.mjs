import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url))
const viteBin = fileURLToPath(new URL('../../node_modules/.bin/vite', import.meta.url))

test('production build emits the MapLibre worker module graph', { timeout: 30_000 }, () => {
  const build = spawnSync(viteBin, ['build', '--logLevel', 'error'], {
    cwd: frontendRoot,
    encoding: 'utf8',
  })

  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`)

  const workerPath = `${frontendRoot}/dist/assets/maplibre-gl-worker.mjs`
  const sharedPath = `${frontendRoot}/dist/assets/maplibre-gl-shared.mjs`

  assert.equal(existsSync(workerPath), true, 'MapLibre worker is missing from the build output')
  assert.equal(existsSync(sharedPath), true, 'MapLibre worker dependency is missing from the build output')
  assert.match(readFileSync(workerPath, 'utf8'), /from["']\.\/maplibre-gl-shared\.mjs["']/)
})
