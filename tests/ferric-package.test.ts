import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('Ferric Canvas vendor package is pinned and browser-ready', () => {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(packageJson.dependencies?.['@ferric-canvas/web'], 'file:vendor/ferric-canvas')

  const vendorRoot = join(root, 'vendor', 'ferric-canvas')
  const vendorPackage = JSON.parse(readFileSync(join(vendorRoot, 'package.json'), 'utf8'))
  assert.equal(vendorPackage.name, '@ferric-canvas/web')
  assert.equal(vendorPackage.version, '0.1.0')
  assert.ok(existsSync(join(vendorRoot, 'dist', 'index.js')))
  assert.ok(existsSync(join(vendorRoot, 'dist', 'index.d.ts')))

  const wasmPath = join(vendorRoot, 'wasm', 'canvas_wasm_bg.wasm')
  assert.ok(existsSync(wasmPath))
  assert.ok(statSync(wasmPath).size > 100_000)

  const revision = readFileSync(join(vendorRoot, 'source-revision.txt'), 'utf8')
  assert.match(revision, /8eae06b8a61371f95ae7e916778ddc86c7829e1f/)
})
