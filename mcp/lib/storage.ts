import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { generateKeyBetween } from 'fractional-indexing'

const ASSET_ROUTE = '/assets/'
const STORAGE_SCHEMA_VERSION = 2

type AnyRecord = Record<string, any>

function storeRecords(store: any): AnyRecord[] {
  return Object.values(store || {}) as AnyRecord[]
}

export { isSafeChildPath, nonEmptyString, parseDataUrl, resolveCoartPaths, sanitizeFileName } from './safety.ts'
import { isSafeChildPath, nonEmptyString, parseDataUrl, resolveCoartPaths, sanitizeFileName } from './safety.ts'

function extensionForMime(mimeType: string) {
  return ({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'text/html': '.html'
  })[mimeType] || '.bin'
}

function mimeForFile(fileName: string) {
  return ({
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.html': 'text/html',
    '.htm': 'text/html'
  })[extname(fileName).toLowerCase()] || 'application/octet-stream'
}

async function exists(filePath: string) {
  try {
    return (await stat(filePath)).isFile()
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, filePath)
}

async function readJson(filePath: string, fallback: any = null): Promise<any> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function pageFileName(pageId: string, snapshotId: string) {
  return `page-${sha256(String(pageId)).slice(0, 12)}-${snapshotId}.json`
}

async function uniqueAssetPath(assetsDir: string, requestedName: string) {
  const safe = sanitizeFileName(requestedName)
  const extension = extname(safe)
  const stem = safe.slice(0, -extension.length)
  let candidate = safe
  let counter = 2
  while (await exists(join(assetsDir, candidate))) {
    candidate = `${stem}-${counter}${extension}`
    counter += 1
  }
  return { fileName: candidate, filePath: join(assetsDir, candidate) }
}

function clone(value: any): any {
  return value == null ? value : structuredClone(value)
}

function ensureSnapshot(snapshot: any): asserts snapshot is { schema: any; store: Record<string, AnyRecord> } {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.schema || !snapshot.store) {
    throw new Error('Invalid Coart canvas snapshot: schema and store are required.')
  }
}

function pageForRecord(store: Record<string, AnyRecord>, record: AnyRecord) {
  if (record?.typeName === 'page') return record.id
  let current = record?.typeName === 'shape' ? record : null
  if (record?.typeName === 'binding') {
    current = store[record.fromId] || store[record.toId] || null
  }
  const seen = new Set()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.typeName === 'page') return current.id
    current = store[current.parentId]
  }
  return null
}

function splitSnapshot(snapshot: any) {
  ensureSnapshot(snapshot)
  const pageStores = new Map()
  const sharedStore = {}

  for (const record of storeRecords(snapshot.store)) {
    if (record?.typeName === 'page') pageStores.set(record.id, { [record.id]: record })
  }
  for (const record of storeRecords(snapshot.store)) {
    if (record?.typeName === 'page') continue
    const pageId = pageForRecord(snapshot.store, record)
    if (pageId && pageStores.has(pageId)) pageStores.get(pageId)[record.id] = record
    else sharedStore[record.id] = record
  }

  return { sharedStore, pageStores }
}

function referencedAssetUrls(snapshot: any) {
  const references = new Map()
  const add = (assetUrl: unknown, recordId: string) => {
    if (typeof assetUrl !== 'string' || !assetUrl.startsWith(ASSET_ROUTE)) return
    if (!references.has(assetUrl)) references.set(assetUrl, new Set())
    references.get(assetUrl).add(recordId)
  }
  for (const record of storeRecords(snapshot.store)) {
    if (record?.typeName === 'asset' && record.type === 'image') add(record.props?.src, record.id)
    if (record?.typeName === 'shape' && record.type === 'coart-html') {
      add(nonEmptyString(record.meta?.coartAssetUrl) || nonEmptyString(record.props?.assetUrl), record.id)
    }
  }
  return references
}

async function buildAssetManifest(args: any, snapshot: any) {
  const { assetsDir } = resolveCoartPaths(args)
  let entries = []
  try {
    entries = await readdir(assetsDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const references = referencedAssetUrls(snapshot)
  const assets = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = resolve(assetsDir, entry.name)
    if (!isSafeChildPath(assetsDir, filePath)) throw new Error('Unsafe Coart asset path while building manifest.')
    const buffer = await readFile(filePath)
    const assetUrl = `${ASSET_ROUTE}${encodeURIComponent(entry.name)}`
    assets.push({
      url: assetUrl,
      fileName: entry.name,
      mimeType: mimeForFile(entry.name),
      bytes: buffer.length,
      sha256: sha256(buffer),
      referencedBy: [...(references.get(assetUrl) || [])].sort(),
      protected: true
    })
  }
  return assets.sort((left, right) => left.url.localeCompare(right.url))
}

async function readSnapshotFromManifest(paths: AnyRecord, manifest: any) {
  if (manifest?.schemaVersion !== STORAGE_SCHEMA_VERSION || !Array.isArray(manifest.pages)) {
    throw new Error(`Unsupported Coart storage manifest version: ${manifest?.schemaVersion ?? 'missing'}.`)
  }
  const sharedPath = resolve(paths.canvasDir, nonEmptyString(manifest.sharedFile) || '')
  if (!isSafeChildPath(paths.canvasDir, sharedPath)) throw new Error('Unsafe Coart shared snapshot path.')
  const shared = await readJson(sharedPath)
  if (shared?.schemaVersion !== STORAGE_SCHEMA_VERSION || !shared.schema || !shared.store) {
    throw new Error('Invalid Coart shared snapshot file.')
  }
  const store = clone(shared.store)
  for (const page of manifest.pages) {
    const filePath = resolve(paths.pagesDir, nonEmptyString(page?.file) || '')
    if (!isSafeChildPath(paths.pagesDir, filePath)) throw new Error('Unsafe Coart page snapshot path.')
    const value = await readJson(filePath)
    if (value?.schemaVersion !== STORAGE_SCHEMA_VERSION || value.pageId !== page.id || !value.store) {
      throw new Error(`Invalid Coart page snapshot: ${page?.id || 'unknown'}.`)
    }
    for (const [id, record] of Object.entries(value.store)) {
      if (store[id]) throw new Error(`Duplicate Coart record id across snapshot files: ${id}.`)
      store[id] = record
    }
  }
  const snapshot = { schema: shared.schema, store }
  ensureSnapshot(snapshot)
  return snapshot
}

async function readStoredSnapshot(paths: AnyRecord) {
  const manifest = await readJson(paths.manifestFile)
  if (!manifest) {
    const legacy = await readJson(paths.canvasFile)
    return {
      snapshot: legacy,
      manifest: null,
      storageVersion: legacy ? 1 : null,
      migration: legacy ? { required: true, from: 1, to: STORAGE_SCHEMA_VERSION } : null,
      recovery: null
    }
  }
  try {
    return {
      snapshot: await readSnapshotFromManifest(paths, manifest),
      manifest,
      storageVersion: STORAGE_SCHEMA_VERSION,
      migration: null,
      recovery: null
    }
  } catch (error) {
    const legacy = await readJson(paths.canvasFile)
    if (!legacy) throw error
    ensureSnapshot(legacy)
    return {
      snapshot: legacy,
      manifest,
      storageVersion: 1,
      migration: { required: true, from: 1, to: STORAGE_SCHEMA_VERSION },
      recovery: { source: 'coart-canvas.json', reason: error.message }
    }
  }
}

function assetPathFromUrl(args: any, assetUrl: string) {
  if (!assetUrl?.startsWith(ASSET_ROUTE)) throw new Error('Only /assets/... URLs are allowed.')
  const { assetsDir } = resolveCoartPaths(args)
  const filePath = resolve(assetsDir, decodeURIComponent(assetUrl.slice(ASSET_ROUTE.length)))
  if (!isSafeChildPath(assetsDir, filePath)) throw new Error('Unsafe Coart asset path.')
  return filePath
}

async function localizeSnapshot(args: any, inputSnapshot: any) {
  ensureSnapshot(inputSnapshot)
  const snapshot = clone(inputSnapshot)
  const { assetsDir } = resolveCoartPaths(args)
  await mkdir(assetsDir, { recursive: true })

  for (const record of storeRecords(snapshot.store)) {
    if (record?.typeName === 'asset' && record.type === 'image') {
      const src = record.props?.src
      if (typeof src !== 'string' || !src.startsWith('data:')) continue

      const parsed = parseDataUrl(src)
      const existingUrl = nonEmptyString(record.meta?.coartAssetUrl)
      if (existingUrl) {
        const existingPath = assetPathFromUrl(args, existingUrl)
        if (await exists(existingPath)) {
          const existingBuffer = await readFile(existingPath)
          if (existingBuffer.equals(parsed.buffer)) {
            record.props.src = existingUrl
            continue
          }
        }
      }

      const requested = sanitizeFileName(record.props?.name, `image-${Date.now()}${extensionForMime(parsed.mimeType)}`)
      const target = await uniqueAssetPath(assetsDir, requested)
      await writeFile(target.filePath, parsed.buffer)
      record.props.name = target.fileName
      record.props.src = `${ASSET_ROUTE}${encodeURIComponent(target.fileName)}`
      record.props.mimeType = parsed.mimeType
      record.props.fileSize = parsed.buffer.length
      record.meta = { ...(record.meta || {}), coartAssetUrl: record.props.src }
    }

    if (record?.typeName === 'shape' && record.type === 'coart-html') {
      const html = typeof record.props?.html === 'string' ? record.props.html : ''
      if (!html) continue
      const existingUrl = nonEmptyString(record.meta?.coartAssetUrl) || nonEmptyString(record.props?.assetUrl)
      if (existingUrl) {
        const existingPath = assetPathFromUrl(args, existingUrl)
        if (await exists(existingPath) && await readFile(existingPath, 'utf8') === html) {
          record.props.assetUrl = existingUrl
          record.props.html = ''
          record.meta = { ...(record.meta || {}), coartAssetUrl: existingUrl }
          continue
        }
      }
      const requested = existingUrl
        ? sanitizeFileName(decodeURIComponent(existingUrl.slice(ASSET_ROUTE.length)), `draft-${Date.now()}.html`)
        : `draft-${Date.now()}.html`
      const target = await uniqueAssetPath(assetsDir, requested)
      const assetUrl = `${ASSET_ROUTE}${encodeURIComponent(target.fileName)}`
      await writeFile(target.filePath, html, 'utf8')
      record.props.assetUrl = assetUrl
      record.props.html = ''
      record.meta = { ...(record.meta || {}), coartAssetUrl: assetUrl }
    }
  }
  return snapshot
}

async function hydrateSnapshot(args: any, inputSnapshot: any) {
  if (!inputSnapshot) return null
  ensureSnapshot(inputSnapshot)
  const snapshot = clone(inputSnapshot)

  for (const record of storeRecords(snapshot.store)) {
    if (record?.typeName === 'asset' && record.type === 'image') {
      const src = record.props?.src
      if (typeof src !== 'string' || !src.startsWith(ASSET_ROUTE)) continue
      const filePath = assetPathFromUrl(args, src)
      const buffer = await readFile(filePath)
      record.props.src = `data:${record.props?.mimeType || mimeForFile(filePath)};base64,${buffer.toString('base64')}`
      record.meta = { ...(record.meta || {}), coartAssetUrl: src }
    }
    if (record?.typeName === 'shape' && record.type === 'coart-html') {
      const assetUrl = nonEmptyString(record.meta?.coartAssetUrl) || nonEmptyString(record.props?.assetUrl)
      if (!assetUrl) continue
      record.props.html = await readFile(assetPathFromUrl(args, assetUrl), 'utf8')
      record.props.assetUrl = assetUrl
    }
  }
  return snapshot
}

export async function readCanvasState(args: any = {}, { hydrateAssets = false }: { hydrateAssets?: boolean } = {}) {
  const paths = resolveCoartPaths(args)
  const [stored, selection, viewState] = await Promise.all([
    readStoredSnapshot(paths),
    readJson(paths.selectionFile),
    readJson(paths.viewFile)
  ])
  return {
    snapshot: hydrateAssets && stored.snapshot ? await hydrateSnapshot(args, stored.snapshot) : stored.snapshot,
    selection,
    viewState,
    manifest: stored.manifest,
    storageVersion: stored.storageVersion,
    migration: stored.migration,
    recovery: stored.recovery,
    storage: stored.snapshot ? (stored.recovery ? 'project-file-recovered' : 'project-file') : 'empty',
    projectDir: paths.projectDir,
    canvasDir: paths.canvasDir
  }
}

export async function saveCanvasSnapshot(args: any = {}, snapshot?: any) {
  const paths = resolveCoartPaths(args)
  const localized = await localizeSnapshot(args, snapshot)
  const { sharedStore, pageStores } = splitSnapshot(localized)
  const snapshotId = sha256(JSON.stringify(localized)).slice(0, 16)
  const sharedFile = `coart-shared-${snapshotId}.json`
  await mkdir(paths.pagesDir, { recursive: true })
  await atomicWriteJson(paths.canvasFile, localized)
  await atomicWriteJson(join(paths.canvasDir, sharedFile), {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    schema: localized.schema,
    store: sharedStore
  })

  const pages = []
  for (const [pageId, store] of [...pageStores.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const file = pageFileName(pageId, snapshotId)
    await atomicWriteJson(join(paths.pagesDir, file), {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      pageId,
      store
    })
    pages.push({ id: pageId, file, recordCount: Object.keys(store).length })
  }

  const manifest = {
    format: 'coart-canvas',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    snapshotId,
    updatedAt: new Date().toISOString(),
    canonicalFile: basename(paths.canvasFile),
    sharedFile,
    pages,
    assets: await buildAssetManifest(args, localized)
  }
  await atomicWriteJson(paths.manifestFile, manifest)
  return {
    ok: true,
    storage: 'project-file',
    storageVersion: STORAGE_SCHEMA_VERSION,
    canvasDir: paths.canvasDir,
    canvasFile: paths.canvasFile,
    manifestFile: paths.manifestFile,
    pages: pages.length,
    assets: manifest.assets.length
  }
}

export async function writeSelection(args: any = {}, selection?: any) {
  const paths = resolveCoartPaths(args)
  await mkdir(paths.canvasDir, { recursive: true })
  await atomicWriteJson(paths.selectionFile, selection || { version: 1, selectedShapeIds: [], selectedShapes: [] })
  return { ok: true, path: paths.selectionFile }
}

export async function readSelection(args: any = {}) {
  const paths = resolveCoartPaths(args)
  return { selection: await readJson(paths.selectionFile, { version: 1, selectedShapeIds: [], selectedShapes: [] }), path: paths.selectionFile }
}

export async function writeViewState(args: any = {}, viewState?: any) {
  const paths = resolveCoartPaths(args)
  await mkdir(paths.canvasDir, { recursive: true })
  await atomicWriteJson(paths.viewFile, viewState || { version: 1, currentPageId: null, camera: { x: 0, y: 0, z: 1 } })
  return { ok: true, path: paths.viewFile }
}

export async function writeAsset(args: any = {}, { fileName, dataUrl, dataBase64, mimeType = 'application/octet-stream' }: any = {}) {
  const paths = resolveCoartPaths(args)
  await mkdir(paths.assetsDir, { recursive: true })
  let buffer
  if (dataUrl) {
    const parsed = parseDataUrl(dataUrl)
    buffer = parsed.buffer
    mimeType = parsed.mimeType
  } else if (dataBase64) {
    buffer = Buffer.from(dataBase64, 'base64')
  } else {
    throw new Error('dataUrl or dataBase64 is required.')
  }
  const target = await uniqueAssetPath(paths.assetsDir, sanitizeFileName(fileName, `asset-${Date.now()}${extensionForMime(mimeType)}`))
  await writeFile(target.filePath, buffer)
  return {
    ok: true,
    canvasDir: paths.canvasDir,
    assetPath: target.filePath,
    assetUrl: `${ASSET_ROUTE}${encodeURIComponent(target.fileName)}`,
    assetPathRelativeToProject: relative(paths.projectDir, target.filePath),
    mimeType,
    fileSize: buffer.length
  }
}

export async function readAsset(args: any = {}, assetUrl: string) {
  const filePath = assetPathFromUrl(args, assetUrl)
  const buffer = await readFile(filePath)
  return {
    ok: true,
    assetUrl,
    assetPath: filePath,
    mimeType: mimeForFile(filePath),
    dataBase64: buffer.toString('base64'),
    fileSize: buffer.length
  }
}

export async function readLatestImageAsset(args: any = {}) {
  const { assetsDir } = resolveCoartPaths(args)
  let entries
  try {
    entries = await readdir(assetsDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('Coart project has no saved assets yet.')
    throw error
  }

  const candidates = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = resolve(assetsDir, entry.name)
    if (!isSafeChildPath(assetsDir, filePath)) throw new Error('Unsafe Coart asset path.')
    const mimeType = mimeForFile(entry.name)
    if (!mimeType.startsWith('image/')) continue
    const fileStat = await stat(filePath)
    candidates.push({ fileName: entry.name, assetUrl: `${ASSET_ROUTE}${encodeURIComponent(entry.name)}`, mimeType, updatedAt: fileStat.mtime.toISOString(), mtimeMs: fileStat.mtimeMs })
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.fileName.localeCompare(left.fileName))
  const latest = candidates[0]
  if (!latest) throw new Error('Coart project has no saved image assets yet.')
  const asset = await readAsset(args, latest.assetUrl)
  return { ...asset, updatedAt: latest.updatedAt }
}

function firstSelectedShapeId(selection: any) {
  if (Array.isArray(selection?.selectedShapeIds) && selection.selectedShapeIds.length === 1) return selection.selectedShapeIds[0]
  if (Array.isArray(selection?.selectedShapes) && selection.selectedShapes.length === 1) return selection.selectedShapes[0]?.id
  return null
}

function findPageId(store: Record<string, AnyRecord>, shape: AnyRecord | undefined) {
  let current = shape
  const seen = new Set()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.typeName === 'page') return current.id
    current = store[current.parentId]
  }
  return null
}

function pageIdFromState(store: Record<string, AnyRecord>, selection: any, viewState: any, explicitPageId: any) {
  if (explicitPageId && store[explicitPageId]) return explicitPageId
  const selected = store[firstSelectedShapeId(selection)]
  return findPageId(store, selected) || viewState?.currentPageId || storeRecords(store).find((item) => item?.typeName === 'page')?.id
}

function descendants(store: Record<string, AnyRecord>, parentId: string) {
  const result: string[] = []
  const queue: string[] = [parentId]
  while (queue.length) {
    const id = queue.shift()
    for (const record of storeRecords(store)) {
      if (record?.typeName === 'shape' && record.parentId === id) {
        result.push(record.id)
        queue.push(record.id)
      }
    }
  }
  return result
}

function nextIndex(store: Record<string, AnyRecord>, parentId: string) {
  const indexes = storeRecords(store)
    .filter((record) => record?.typeName === 'shape' && record.parentId === parentId && typeof record.index === 'string')
    .map((record) => record.index as string)
    .sort()
  return generateKeyBetween(indexes.at(-1) || null, null)
}

function recordId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
}

async function imageDimensions(filePath: string) {
  const buffer = await readFile(filePath)
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const size = buffer.readUInt16BE(offset + 2)
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      offset += size + 2
    }
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    if (buffer.toString('ascii', 12, 16) === 'VP8X') {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
    }
  }
  throw new Error('Only PNG, JPEG, and extended WebP dimensions are supported. Pass a compatible image.')
}

export async function insertImage(args: any = {}) {
  const imagePath = resolve(nonEmptyString(args.imagePath) || '')
  if (!imagePath || !(await exists(imagePath))) throw new Error('imagePath must reference an existing image file.')
  const mimeType = mimeForFile(imagePath)
  if (!mimeType.startsWith('image/')) throw new Error('imagePath must be an image.')

  const state = await readCanvasState(args)
  ensureSnapshot(state.snapshot)
  const snapshot = clone(state.snapshot)
  const store = snapshot.store
  const anchorId = nonEmptyString(args.anchorShapeId) || firstSelectedShapeId(state.selection)
  const anchor = anchorId ? store[anchorId] : null
  const pageId = pageIdFromState(store, state.selection, state.viewState, args.pageId)
  if (!pageId) throw new Error('Could not determine target page.')

  const natural = await imageDimensions(imagePath)
  const isHolder = anchor?.meta?.coartKind === 'ai-image'
  const replaceHolder = isHolder && args.replaceHolder !== false
  const width = Number(args.displayWidth) || (isHolder ? anchor.props?.w : Math.min(natural.width, 512)) || 512
  const height = Number(args.displayHeight) || (isHolder ? anchor.props?.h : Math.round(width * natural.height / natural.width)) || 512
  const parentId = anchor?.parentId && store[anchor.parentId] ? anchor.parentId : pageId
  const x = isHolder ? anchor.x : Number(args.x) || ((anchor?.x || 0) + (anchor?.props?.w || 0) + 40)
  const y = isHolder ? anchor.y : Number(args.y) || (anchor?.y || 0)
  const rotation = isHolder ? anchor.rotation || 0 : 0
  const index = replaceHolder && anchor?.index ? anchor.index : nextIndex(store, parentId)

  const paths = resolveCoartPaths(args)
  await mkdir(paths.assetsDir, { recursive: true })
  const target = await uniqueAssetPath(paths.assetsDir, sanitizeFileName(args.fileName, basename(imagePath)))
  await copyFile(imagePath, target.filePath)

  const assetId = recordId('asset')
  const shapeId = recordId('shape')
  const assetUrl = `${ASSET_ROUTE}${encodeURIComponent(target.fileName)}`
  const fileStat = await stat(target.filePath)

  if (replaceHolder) {
    for (const id of [anchorId, ...descendants(store, anchorId)]) delete store[id]
  }

  store[assetId] = {
    id: assetId,
    typeName: 'asset',
    type: 'image',
    props: {
      name: target.fileName,
      src: assetUrl,
      w: natural.width,
      h: natural.height,
      fileSize: fileStat.size,
      mimeType,
      isAnimated: mimeType === 'image/gif'
    },
    meta: { coartAssetUrl: assetUrl }
  }
  store[shapeId] = {
    id: shapeId,
    typeName: 'shape',
    type: 'image',
    parentId,
    index,
    x,
    y,
    rotation,
    isLocked: false,
    opacity: 1,
    props: {
      w: width,
      h: height,
      assetId,
      playing: true,
      url: '',
      crop: null,
      flipX: false,
      flipY: false,
      altText: nonEmptyString(args.altText) || 'Coart generated image'
    },
    meta: {
      coartGenerated: true,
      coartAnchorShapeId: anchorId || null,
      coartReplacedHolder: replaceHolder
    }
  }

  await saveCanvasSnapshot(args, snapshot)
  return { ok: true, pageId, anchorShapeId: anchorId, shapeId, assetId, assetPath: target.filePath, assetUrl, bounds: { x, y, w: width, h: height }, replacedHolder: replaceHolder }
}

export async function insertHtml(args: any = {}) {
  const htmlContent = nonEmptyString(args.htmlContent)
    || (nonEmptyString(args.htmlPath) ? await readFile(resolve(args.htmlPath), 'utf8') : null)
  if (!htmlContent) throw new Error('htmlContent or htmlPath is required.')

  const state = await readCanvasState(args)
  ensureSnapshot(state.snapshot)
  const snapshot = clone(state.snapshot)
  const store = snapshot.store
  const requestedShapeId = nonEmptyString(args.shapeId)
  const anchorId = nonEmptyString(args.anchorShapeId) || requestedShapeId || firstSelectedShapeId(state.selection)
  const anchor = anchorId ? store[anchorId] : null
  const pageId = pageIdFromState(store, state.selection, state.viewState, args.pageId)
  if (!pageId) throw new Error('Could not determine target page.')

  if (args.updateExisting === true && anchor?.type === 'coart-html') {
    anchor.props.html = htmlContent
    anchor.props.title = nonEmptyString(args.title) || anchor.props.title || 'AI HTML'
    await saveCanvasSnapshot(args, snapshot)
    return { ok: true, updated: true, shapeId: anchor.id, pageId }
  }

  const slidesShapeId = nonEmptyString(args.slidesShapeId)
  const slidesShape = slidesShapeId ? store[slidesShapeId] : null
  const isHolder = anchor?.meta?.coartKind === 'ai-html'
  const replaceHolder = isHolder && args.replaceHolder !== false
  const width = Number(args.width) || (isHolder ? anchor.props?.w : 1024) || 1024
  const height = Number(args.height) || (isHolder ? anchor.props?.h : 576) || 576
  let parentId = anchor?.parentId && store[anchor.parentId] ? anchor.parentId : pageId
  let x = isHolder ? anchor.x : Number(args.x) || ((anchor?.x || 0) + (anchor?.props?.w || 0) + 40)
  let y = isHolder ? anchor.y : Number(args.y) || (anchor?.y || 0)
  let rotation = isHolder ? anchor.rotation || 0 : 0

  if (slidesShape?.meta?.coartKind === 'slides') {
    parentId = slidesShape.id
    const existingSlides = storeRecords(store)
      .filter((record) => record?.typeName === 'shape' && record.parentId === slidesShape.id && record.type === 'coart-html')
      .sort((a, b) => String(a.index).localeCompare(String(b.index)))
    x = 12 + existingSlides.length * (1024 + 32)
    y = 12
    rotation = 0
    slidesShape.props = {
      ...slidesShape.props,
      w: Math.max(slidesShape.props?.w || 1048, 24 + (existingSlides.length + 1) * 1024 + existingSlides.length * 32),
      h: Math.max(slidesShape.props?.h || 600, 600)
    }
  }

  const paths = resolveCoartPaths(args)
  await mkdir(paths.assetsDir, { recursive: true })
  const target = await uniqueAssetPath(paths.assetsDir, sanitizeFileName(args.fileName, `draft-${Date.now()}.html`))
  await writeFile(target.filePath, htmlContent, 'utf8')
  const assetUrl = `${ASSET_ROUTE}${encodeURIComponent(target.fileName)}`
  const shapeId = recordId('shape')
  const index = replaceHolder && anchor?.index ? anchor.index : nextIndex(store, parentId)

  if (replaceHolder) {
    for (const id of [anchorId, ...descendants(store, anchorId)]) delete store[id]
  }

  store[shapeId] = {
    id: shapeId,
    typeName: 'shape',
    type: 'coart-html',
    parentId,
    index,
    x,
    y,
    rotation,
    isLocked: false,
    opacity: 1,
    props: {
      w: width,
      h: height,
      html: '',
      title: nonEmptyString(args.title) || 'AI HTML',
      assetUrl
    },
    meta: {
      coartAssetUrl: assetUrl,
      coartGenerated: true,
      coartSlidesShapeId: slidesShapeId || null,
      coartAnchorShapeId: anchorId || null,
      coartReplacedHolder: replaceHolder
    }
  }

  await saveCanvasSnapshot(args, snapshot)
  return { ok: true, pageId, shapeId, assetPath: target.filePath, assetUrl, parentId, replacedHolder: replaceHolder, slidesShapeId: slidesShapeId || null }
}

export async function downloadFile(args: any = {}) {
  let buffer
  let mimeType = nonEmptyString(args.mimeType) || 'application/octet-stream'
  if (args.assetUrl) {
    const asset = await readAsset(args, args.assetUrl)
    buffer = Buffer.from(asset.dataBase64, 'base64')
    mimeType = asset.mimeType
  } else if (args.dataUrl) {
    const parsed = parseDataUrl(args.dataUrl)
    buffer = parsed.buffer
    mimeType = parsed.mimeType
  } else if (args.dataBase64) {
    buffer = Buffer.from(args.dataBase64, 'base64')
  } else {
    throw new Error('assetUrl, dataUrl, or dataBase64 is required.')
  }

  const downloadsDir = join(homedir(), 'Downloads')
  await mkdir(downloadsDir, { recursive: true })
  const target = await uniqueAssetPath(downloadsDir, sanitizeFileName(args.fileName, `coart-download-${Date.now()}${extensionForMime(mimeType)}`))
  await writeFile(target.filePath, buffer)
  return { ok: true, fileName: target.fileName, filePath: target.filePath, mimeType, fileSize: buffer.length }
}
