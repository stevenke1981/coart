import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  isSafeChildPath,
  parseDataUrl,
  resolveCoartPaths,
  sanitizeFileName
} from '../mcp/lib/safety.ts'

test('resolveCoartPaths defaults canvas under project', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-test-'))
  const paths = resolveCoartPaths({ projectDir })
  assert.equal(paths.projectDir, projectDir)
  assert.equal(paths.canvasDir, join(projectDir, 'canvas'))
  assert.equal(paths.assetsDir, join(projectDir, 'canvas', 'assets'))
  assert.equal(paths.pagesDir, join(projectDir, 'canvas', 'pages'))
  assert.equal(paths.manifestFile, join(projectDir, 'canvas', 'coart-manifest.json'))
})

test('isSafeChildPath rejects traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'coart-safe-'))
  assert.equal(isSafeChildPath(root, join(root, 'assets', 'a.png')), true)
  assert.equal(isSafeChildPath(root, join(root, '..', 'outside.png')), false)
})

test('sanitizeFileName strips path and unsafe characters', () => {
  assert.equal(sanitizeFileName('../../我的 圖片?.PNG', 'image.png'), 'asset.png')
  assert.equal(sanitizeFileName('hello world.svg'), 'hello-world.svg')
})

test('parseDataUrl handles base64 and percent encoding', () => {
  const base64 = parseDataUrl('data:text/plain;base64,aGVsbG8=')
  assert.equal(base64.mimeType, 'text/plain')
  assert.equal(base64.buffer.toString('utf8'), 'hello')
  const plain = parseDataUrl('data:text/plain,hello%20world')
  assert.equal(plain.buffer.toString('utf8'), 'hello world')
})
