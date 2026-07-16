import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp } from 'node:fs/promises'
import test from 'node:test'
import {
  readCanvasState,
  readFollowUpRequest,
  readLatestImageAsset,
  resolveCoartPaths,
  saveCanvasSnapshot,
  updateImage,
  writeFollowUpRequest,
  clearFollowUpRequest
} from '../mcp/lib/storage.ts'

function snapshot() {
  return {
    schema: { schemaVersion: 2, sequences: {} },
    store: {
      'document:document': {
        id: 'document:document',
        typeName: 'document',
        name: 'Coart'
      },
      'page:one': {
        id: 'page:one',
        typeName: 'page',
        name: 'One',
        index: 'a1'
      },
      'page:two': {
        id: 'page:two',
        typeName: 'page',
        name: 'Two',
        index: 'a2'
      },
      'asset:image': {
        id: 'asset:image',
        typeName: 'asset',
        type: 'image',
        props: {
          name: 'pixel.png',
          src: 'data:image/png;base64,iVBORw0KGgo=',
          mimeType: 'image/png'
        },
        meta: {}
      },
      'shape:one': {
        id: 'shape:one',
        typeName: 'shape',
        type: 'image',
        parentId: 'page:one',
        index: 'a1',
        props: { assetId: 'asset:image', w: 1, h: 1 },
        meta: { coartGenerated: true }
      },
      'shape:two': {
        id: 'shape:two',
        typeName: 'shape',
        type: 'geo',
        parentId: 'page:two',
        index: 'a1',
        props: { w: 10, h: 10 },
        meta: {}
      }
    }
  }
}

test('saveCanvasSnapshot writes v2 manifest, per-page snapshots, and protected asset records', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-storage-'))
  const result = await saveCanvasSnapshot({ projectDir }, snapshot())
  const paths = resolveCoartPaths({ projectDir })
  const manifest = JSON.parse(await readFile(paths.manifestFile, 'utf8'))

  assert.equal(result.storageVersion, 2)
  assert.equal(result.pages, 2)
  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.pages.length, 2)
  assert.equal(manifest.assets.length, 1)
  assert.equal(manifest.assets[0].protected, true)
  assert.equal(manifest.assets[0].referencedBy[0], 'asset:image')
  assert.match(manifest.assets[0].sha256, /^[a-f0-9]{64}$/)

  const pageOneEntry = manifest.pages.find((page) => page.id === 'page:one')
  assert.match(manifest.sharedFile, /^coart-shared-[a-f0-9]{16}\.json$/)
  const pageOne = JSON.parse(await readFile(join(paths.pagesDir, pageOneEntry.file), 'utf8'))
  assert.deepEqual(Object.keys(pageOne.store).sort(), ['page:one', 'shape:one'])

  const stored = await readCanvasState({ projectDir })
  assert.equal(stored.storageVersion, 2)
  assert.equal(stored.migration, null)
  assert.match(stored.snapshot.store['asset:image'].props.src, /^\/assets\//)

  const hydrated = await readCanvasState({ projectDir }, { hydrateAssets: true })
  assert.match(hydrated.snapshot.store['asset:image'].props.src, /^data:image\/png;base64,/)
})

test('legacy snapshot is readable and migrates on the next save', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-legacy-'))
  const paths = resolveCoartPaths({ projectDir })
  await mkdir(paths.canvasDir, { recursive: true })
  await writeFile(paths.canvasFile, `${JSON.stringify(snapshot())}\n`, 'utf8')

  const legacy = await readCanvasState({ projectDir })
  assert.equal(legacy.storageVersion, 1)
  assert.deepEqual(legacy.migration, { required: true, from: 1, to: 2 })

  await saveCanvasSnapshot({ projectDir }, legacy.snapshot)
  const migrated = await readCanvasState({ projectDir })
  assert.equal(migrated.storageVersion, 2)
  assert.equal(migrated.migration, null)
})

test('invalid page manifest paths recover from the compatibility snapshot', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-recovery-'))
  const paths = resolveCoartPaths({ projectDir })
  await saveCanvasSnapshot({ projectDir }, snapshot())
  const manifest = JSON.parse(await readFile(paths.manifestFile, 'utf8'))
  manifest.pages[0].file = '../coart-canvas.json'
  await writeFile(paths.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const recovered = await readCanvasState({ projectDir })
  assert.equal(recovered.storage, 'project-file-recovered')
  assert.equal(recovered.storageVersion, 1)
  assert.match(recovered.recovery.reason, /Unsafe Coart page snapshot path/)
})

test('valid v2 storage does not depend on the compatibility snapshot remaining readable', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-v2-canonical-'))
  const paths = resolveCoartPaths({ projectDir })
  await saveCanvasSnapshot({ projectDir }, snapshot())
  await writeFile(paths.canvasFile, '{not-json', 'utf8')

  const stored = await readCanvasState({ projectDir })
  assert.equal(stored.storageVersion, 2)
  assert.equal(stored.recovery, null)
  assert.ok(stored.snapshot.store['shape:one'])
})

test('snapshot generations and changed image assets are immutable', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-generations-'))
  const paths = resolveCoartPaths({ projectDir })
  await saveCanvasSnapshot({ projectDir }, snapshot())
  const firstManifest = JSON.parse(await readFile(paths.manifestFile, 'utf8'))

  const changed = (await readCanvasState({ projectDir }, { hydrateAssets: true })).snapshot
  changed.store['shape:one'].x = 42
  changed.store['asset:image'].props.src = 'data:image/png;base64,Y2hhbmdlZA=='
  await saveCanvasSnapshot({ projectDir }, changed)
  const secondManifest = JSON.parse(await readFile(paths.manifestFile, 'utf8'))

  assert.notEqual(firstManifest.snapshotId, secondManifest.snapshotId)
  assert.equal(secondManifest.assets.length, 2)
  assert.equal(await readFile(join(paths.canvasDir, firstManifest.sharedFile), 'utf8').then(Boolean), true)
  assert.equal(await readFile(join(paths.pagesDir, firstManifest.pages[0].file), 'utf8').then(Boolean), true)
})

test('readLatestImageAsset returns the newest project-local image with visual data', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-latest-image-'))
  await saveCanvasSnapshot({ projectDir }, snapshot())

  const latest = await readLatestImageAsset({ projectDir })
  assert.equal(latest.mimeType, 'image/png')
  assert.equal(latest.assetUrl, '/assets/pixel.png')
  assert.equal(latest.dataBase64, 'iVBORw0KGgo=')
  assert.match(latest.updatedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('standalone follow-up requests are persisted without clipboard state', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-follow-up-'))
  const [first, second] = await Promise.all([
    writeFollowUpRequest({ projectDir }, { prompt: '把圖片改成夜景', source: 'test' }),
    writeFollowUpRequest({ projectDir }, { prompt: '再加上月亮', source: 'test' })
  ])
  assert.equal(first.pending, true)
  assert.equal(second.pending, true)
  const loaded = await readFollowUpRequest({ projectDir })
  assert.equal(loaded.queueLength, 2)
  const firstId = loaded.request.requestId
  await clearFollowUpRequest({ projectDir }, firstId)
  const remaining = await readFollowUpRequest({ projectDir })
  assert.equal(remaining.queueLength, 1)
  assert.notEqual(remaining.request.requestId, firstId)
  await assert.rejects(() => clearFollowUpRequest({ projectDir }), /requestId is required/)
})

test('updateImage preserves the selected shape while keeping the previous asset', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'coart-update-image-'))
  await saveCanvasSnapshot({ projectDir }, snapshot())
  const sourcePath = join(projectDir, 'revised.png')
  const png = Buffer.alloc(24)
  png.write('\x89PNG', 0, 'binary')
  png.writeUInt32BE(320, 16)
  png.writeUInt32BE(240, 20)
  await writeFile(sourcePath, png)

  const result = await updateImage({ projectDir, imagePath: sourcePath, shapeId: 'shape:one' })
  assert.equal(result.updated, true)
  assert.equal(result.shapeId, 'shape:one')
  assert.notEqual(result.assetId, 'asset:image')
  const state = await readCanvasState({ projectDir })
  assert.equal(state.snapshot.store['shape:one'].props.assetId, result.assetId)
  assert.ok(state.snapshot.store['asset:image'])
  assert.equal(state.snapshot.store[result.assetId].props.w, 320)
})
