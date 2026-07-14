import {
  ActiveSelection,
  Canvas,
  FabricImage,
  FabricText,
  Group,
  Line,
  Path,
  Point,
  Rect,
  type FabricObject
} from 'fabric'
import { generateKeyBetween } from 'fractional-indexing'
import type {
  AnyCanvasShape,
  CanvasCamera,
  CanvasRecord,
  CanvasShapeInput,
  CanvasSnapshot,
  CanvasViewportBounds,
  EditorLike,
  CanvasImageOptions
} from '../types'

const PAGE_ID = 'page:page'
const DOCUMENT_ID = 'document:document'

type CoartFabricObject = FabricObject & {
  coartId?: string
  coartRecord?: AnyCanvasShape
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function pageForRecord(store: Map<string, CanvasRecord>, record: CanvasRecord): string | null {
  let current: CanvasRecord | undefined = record
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.typeName === 'page') return current.id
    current = current.parentId ? store.get(current.parentId) : undefined
  }
  return null
}

function recordFromInput(input: CanvasShapeInput, index: string, pageId: string): AnyCanvasShape {
  return {
    id: input.id,
    typeName: 'shape',
    type: input.type || 'frame',
    parentId: input.parentId || pageId,
    index: input.index || index,
    x: numberValue(input.x, 0),
    y: numberValue(input.y, 0),
    rotation: numberValue(input.rotation, 0),
    opacity: numberValue(input.opacity, 1),
    isLocked: Boolean(input.isLocked),
    props: { ...(input.props || {}) },
    meta: { ...(input.meta || {}) }
  }
}

function nextIndex(records: Map<string, CanvasRecord>, parentId: string): string {
  const values = [...records.values()]
    .filter((record) => record.typeName === 'shape' && record.parentId === parentId)
    .map((record) => record.index || '')
    .sort()
  return generateKeyBetween(values.at(-1) || null, null)
}

export function createCoartShapeId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  return `shape:${Date.now().toString(36)}-${uuid.slice(0, 12)}`
}

export function createEmptyCanvasSnapshot(): CanvasSnapshot {
  return {
    schema: {
      schemaVersion: 2,
      sequences: { 'coart.fabric': 1 }
    },
    store: {
      [DOCUMENT_ID]: { id: DOCUMENT_ID, typeName: 'document', props: {}, meta: {} },
      [PAGE_ID]: { id: PAGE_ID, typeName: 'page', name: 'Page 1', index: 'a1', props: {}, meta: {} }
    }
  }
}

function objectRecord(object: FabricObject): AnyCanvasShape | undefined {
  return (object as CoartFabricObject).coartRecord
}

function setObjectRecord(object: FabricObject, record: AnyCanvasShape): void {
  const target = object as CoartFabricObject
  target.coartId = record.id
  target.coartRecord = record
}

function objectId(object: FabricObject): string | undefined {
  return (object as CoartFabricObject).coartId
}

function objectSize(object: FabricObject): { w: number; h: number } {
  return {
    w: Math.max(1, numberValue(object.getScaledWidth?.(), numberValue(object.width, 1))),
    h: Math.max(1, numberValue(object.getScaledHeight?.(), numberValue(object.height, 1)))
  }
}

function makeLabeledBox(record: AnyCanvasShape, width: number, height: number, color: string): Group {
  const body = new Rect({
    left: 0,
    top: 0,
    width,
    height,
    rx: 12,
    ry: 12,
    fill: 'rgba(255,255,255,0.94)',
    stroke: color,
    strokeWidth: 2
  })
  const label = new FabricText(
    stringValue(record.props.title, record.type === 'coart-html' ? 'AI HTML' : 'Coart'),
    {
      left: 16,
      top: 16,
      fontSize: 18,
      fontFamily: 'Inter, Segoe UI, sans-serif',
      fontWeight: '600',
      fill: color,
      selectable: false,
      evented: false
    }
  )
  return new Group([body, label], {
    left: numberValue(record.x, 0),
    top: numberValue(record.y, 0),
    angle: numberValue(record.rotation, 0),
    opacity: numberValue(record.opacity, 1),
    originX: 'left',
    originY: 'top'
  })
}

function rectForRecord(record: AnyCanvasShape): Rect {
  const width = numberValue(record.props.w, 512)
  const height = numberValue(record.props.h, 512)
  const isFrame = record.type === 'frame'
  return new Rect({
    left: numberValue(record.x, 0),
    top: numberValue(record.y, 0),
    width,
    height,
    angle: numberValue(record.rotation, 0),
    opacity: numberValue(record.opacity, 1),
    originX: 'left',
    originY: 'top',
    rx: 12,
    ry: 12,
    fill: isFrame ? 'rgba(109,94,247,0.06)' : 'rgba(255,255,255,0.92)',
    stroke: isFrame ? '#8b7fff' : '#c8c2ee',
    strokeWidth: isFrame ? 2 : 1,
    strokeDashArray: isFrame ? [8, 6] : undefined
  })
}

function lineForRecord(record: AnyCanvasShape): Line {
  const width = numberValue(record.props.w, numberValue(record.props.x2, 120))
  const height = numberValue(record.props.h, numberValue(record.props.y2, 0))
  return new Line([0, 0, width, height], {
    left: numberValue(record.x, 0),
    top: numberValue(record.y, 0),
    angle: numberValue(record.rotation, 0),
    opacity: numberValue(record.opacity, 1),
    originX: 'left',
    originY: 'top',
    stroke: stringValue(record.props.stroke, '#6d5ef7'),
    strokeWidth: numberValue(record.props.strokeWidth, 3),
    strokeLineCap: 'round'
  })
}

function textForRecord(record: AnyCanvasShape): FabricText {
  return new FabricText(stringValue(record.props.text, stringValue(record.props.content, '文字')), {
    left: numberValue(record.x, 0),
    top: numberValue(record.y, 0),
    angle: numberValue(record.rotation, 0),
    opacity: numberValue(record.opacity, 1),
    originX: 'left',
    originY: 'top',
    fontSize: numberValue(record.props.fontSize, 28),
    fontFamily: stringValue(record.props.fontFamily, 'Inter, Segoe UI, sans-serif'),
    fill: stringValue(record.props.fill, '#17161d'),
    fontWeight: stringValue(record.props.fontWeight, '400')
  })
}

function pathForRecord(record: AnyCanvasShape): Path | null {
  const path = record.props.path
  if (!Array.isArray(path) && typeof path !== 'string') return null
  return new Path(path as never, {
    left: numberValue(record.x, 0),
    top: numberValue(record.y, 0),
    angle: numberValue(record.rotation, 0),
    opacity: numberValue(record.opacity, 1),
    originX: 'left',
    originY: 'top',
    fill: '',
    stroke: stringValue(record.props.stroke, '#6d5ef7'),
    strokeWidth: numberValue(record.props.strokeWidth, 4),
    strokeLineCap: 'round',
    strokeLineJoin: 'round'
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body = ''] = dataUrl.split(',', 2)
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'image/png'
  const binary = header.includes(';base64') ? atob(body) : decodeURIComponent(body)
  const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}

export class CoartFabricEditor implements EditorLike {
  private readonly listeners = new Set<() => void>()
  private readonly disposers: Array<() => void> = []
  private records = new Map<string, CanvasRecord>()
  private schema: Record<string, unknown> = createEmptyCanvasSnapshot().schema
  private currentPageId = PAGE_ID
  private loading = false

  constructor(private readonly canvas: Canvas) {
    this.registerCanvasEvents()
    this.setCurrentTool('select')
  }

  private registerCanvasEvents(): void {
    const onSelection = () => this.emitChange()
    const onModified = (event: { target?: FabricObject }) => {
      if (event.target) this.syncRecordFromObject(event.target)
      this.emitChange()
    }
    const onRemoved = (event: { target?: FabricObject }) => {
      const id = event.target ? objectId(event.target) : undefined
      if (id && !this.loading) this.records.delete(id)
      this.emitChange()
    }
    const onPathCreated = (event: { path?: FabricObject }) => {
      if (!event.path) return
      const path = event.path
      const id = createCoartShapeId()
      const width = numberValue(path.getScaledWidth?.(), 1)
      const height = numberValue(path.getScaledHeight?.(), 1)
      const record: AnyCanvasShape = {
        id,
        typeName: 'shape',
        type: 'draw',
        parentId: this.currentPageId,
        index: nextIndex(this.records, this.currentPageId),
        x: numberValue(path.left, 0),
        y: numberValue(path.top, 0),
        rotation: numberValue(path.angle, 0),
        opacity: 1,
        props: {
          w: width,
          h: height,
          path: (path as FabricObject & { path?: unknown }).path,
          stroke: '#6d5ef7',
          strokeWidth: numberValue(path.strokeWidth, 4)
        },
        meta: {}
      }
      this.records.set(id, record)
      setObjectRecord(path, record)
      this.emitChange()
    }

    this.disposers.push(this.canvas.on('selection:created', onSelection as never))
    this.disposers.push(this.canvas.on('selection:updated', onSelection as never))
    this.disposers.push(this.canvas.on('selection:cleared', onSelection as never))
    this.disposers.push(this.canvas.on('object:modified', onModified as never))
    this.disposers.push(this.canvas.on('object:removed', onRemoved as never))
    this.disposers.push(this.canvas.on('path:created', onPathCreated as never))
  }

  private emitChange(): void {
    if (!this.loading) {
      for (const listener of this.listeners) listener()
    }
  }

  private syncRecordFromObject(object: FabricObject): void {
    const record = objectRecord(object)
    if (!record) return
    record.x = numberValue(object.left, record.x || 0)
    record.y = numberValue(object.top, record.y || 0)
    record.rotation = numberValue(object.angle, record.rotation || 0)
    record.opacity = numberValue(object.opacity, record.opacity || 1)
    const size = objectSize(object)
    record.props = { ...record.props, w: size.w, h: size.h }

    if (record.type === 'image') {
      const assetId = stringValue(record.props.assetId)
      const asset = this.records.get(assetId)
      const source = object as FabricImage
      const src = source.getSrc?.()
      if (asset && typeof src === 'string' && src) {
        asset.props = {
          ...asset.props,
          src,
          w: numberValue(source.width, size.w),
          h: numberValue(source.height, size.h)
        }
      }
    }
  }

  private attach(object: FabricObject, record: AnyCanvasShape): FabricObject {
    setObjectRecord(object, record)
    object.set({
      selectable: !record.isLocked,
      evented: true,
      hoverCursor: 'move'
    })
    object.setCoords()
    return object
  }

  private async objectForRecord(record: AnyCanvasShape): Promise<FabricObject> {
    const width = numberValue(record.props.w, 512)
    const height = numberValue(record.props.h, 512)

    if (record.type === 'image') {
      const assetId = stringValue(record.props.assetId)
      const asset = assetId ? this.records.get(assetId) : undefined
      const source = stringValue(asset?.props.src) || stringValue(record.props.url)
      if (source) {
        try {
          const image = await FabricImage.fromURL(source, { crossOrigin: 'anonymous' })
          const naturalWidth = Math.max(1, numberValue(image.width, width))
          const naturalHeight = Math.max(1, numberValue(image.height, height))
          image.set({
            left: numberValue(record.x, 0),
            top: numberValue(record.y, 0),
            angle: numberValue(record.rotation, 0),
            opacity: numberValue(record.opacity, 1),
            originX: 'left',
            originY: 'top',
            scaleX: width / naturalWidth,
            scaleY: height / naturalHeight
          })
          return image
        } catch (error) {
          console.warn('Coart could not load an image asset.', error)
        }
      }
      return rectForRecord({ ...record, props: { ...record.props, w: width, h: height } })
    }

    if (record.type === 'coart-html') return makeLabeledBox(record, width, height, '#8b7fff')
    if (record.type === 'frame') return rectForRecord(record)
    if (record.type === 'text') return textForRecord(record)
    if (record.type === 'line' || record.type === 'arrow') return lineForRecord(record)
    if (record.type === 'draw' || record.type === 'path') return pathForRecord(record) || rectForRecord(record)
    return rectForRecord(record)
  }

  private async addRecord(record: AnyCanvasShape): Promise<void> {
    const object = this.attach(await this.objectForRecord(record), record)
    this.canvas.add(object)
  }

  private ensureBaseRecords(): void {
    if (!this.records.has(DOCUMENT_ID)) {
      this.records.set(DOCUMENT_ID, { id: DOCUMENT_ID, typeName: 'document', props: {}, meta: {} })
    }
    if (!this.records.has(this.currentPageId)) {
      this.records.set(this.currentPageId, {
        id: this.currentPageId,
        typeName: 'page',
        name: 'Page 1',
        index: 'a1',
        props: {},
        meta: {}
      })
    }
  }

  getViewportPageBounds(): CanvasViewportBounds {
    const transform = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
    const zoom = Math.max(0.01, numberValue(transform[0], 1))
    return {
      x: -numberValue(transform[4], 0) / zoom,
      y: -numberValue(transform[5], 0) / zoom,
      w: this.canvas.getWidth() / zoom,
      h: this.canvas.getHeight() / zoom
    }
  }

  getCurrentPageId(): string {
    return this.currentPageId
  }

  setCurrentPage(pageId: string): void {
    if (this.records.has(pageId)) this.currentPageId = pageId
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  getCamera(): CanvasCamera {
    const transform = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
    return {
      x: numberValue(transform[4], 0),
      y: numberValue(transform[5], 0),
      z: Math.max(0.01, numberValue(transform[0], 1))
    }
  }

  setCamera(camera: CanvasCamera): void {
    const zoom = Math.max(0.1, Math.min(4, numberValue(camera.z, 1)))
    this.canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      numberValue(camera.x, 0),
      numberValue(camera.y, 0)
    ])
    this.canvas.requestRenderAll()
  }

  getSelectedShapeIds(): string[] {
    return this.canvas.getActiveObjects()
      .map((object) => objectId(object))
      .filter((id): id is string => Boolean(id))
  }

  getShape(id: string): AnyCanvasShape | undefined {
    const record = this.records.get(id)
    if (!record || record.typeName !== 'shape') return undefined
    const object = this.canvas.getObjects().find((item) => objectId(item) === id)
    if (object) this.syncRecordFromObject(object)
    return clone(record) as AnyCanvasShape
  }

  getCurrentPageShapes(): AnyCanvasShape[] {
    for (const object of this.canvas.getObjects()) this.syncRecordFromObject(object)
    return [...this.records.values()]
      .filter((record): record is AnyCanvasShape => record.typeName === 'shape' && pageForRecord(this.records, record) === this.currentPageId)
      .sort((left, right) => String(left.index || '').localeCompare(String(right.index || '')))
      .map((record) => clone(record))
  }

  createShape(input: CanvasShapeInput): void {
    const record = recordFromInput(input, nextIndex(this.records, input.parentId || this.currentPageId), this.currentPageId)
    this.records.set(record.id, record)
    if (record.type === 'image') {
      void this.addRecord(record).then(() => this.emitChange()).catch((error) => console.error(error))
    } else {
      void this.addRecord(record).then(() => this.emitChange()).catch((error) => console.error(error))
    }
  }

  select(id: string): void {
    const object = this.canvas.getObjects().find((item) => objectId(item) === id)
    if (!object) return
    this.canvas.setActiveObject(object)
    this.canvas.requestRenderAll()
  }

  setSelection(ids: string[]): void {
    const objects = ids
      .map((id) => this.canvas.getObjects().find((item) => objectId(item) === id))
      .filter((object): object is FabricObject => Boolean(object))
    if (!objects.length) {
      this.canvas.discardActiveObject()
    } else if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0])
    } else {
      this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
    }
    this.canvas.requestRenderAll()
  }

  setCurrentTool(tool: 'select' | 'draw'): void {
    this.canvas.isDrawingMode = tool === 'draw'
    this.canvas.selection = tool === 'select'
    if (tool === 'draw') this.canvas.discardActiveObject()
    this.canvas.defaultCursor = tool === 'draw' ? 'crosshair' : 'default'
    this.canvas.requestRenderAll()
  }

  getStoreSnapshot(): CanvasSnapshot {
    for (const object of this.canvas.getObjects()) this.syncRecordFromObject(object)
    this.ensureBaseRecords()
    const store: Record<string, CanvasRecord> = {}
    for (const [id, record] of this.records) store[id] = clone(record)
    return { schema: clone(this.schema), store }
  }

  async loadStoreSnapshot(snapshot: CanvasSnapshot): Promise<void> {
    this.loading = true
    try {
      this.canvas.discardActiveObject()
      this.canvas.clear()
      this.schema = clone(snapshot.schema || createEmptyCanvasSnapshot().schema)
      this.records = new Map(Object.entries(snapshot.store || {}).map(([id, record]) => [id, clone(record)]))
      const page = [...this.records.values()].find((record) => record.typeName === 'page')
      this.currentPageId = page?.id || PAGE_ID
      this.ensureBaseRecords()
      const shapes = [...this.records.values()]
        .filter((record): record is AnyCanvasShape => record.typeName === 'shape' && pageForRecord(this.records, record) === this.currentPageId)
        .sort((left, right) => String(left.index || '').localeCompare(String(right.index || '')))
      for (const shape of shapes) await this.addRecord(shape)
      this.canvas.requestRenderAll()
    } finally {
      this.loading = false
    }
  }

  async toImage(ids: string[], options: CanvasImageOptions = {}): Promise<{ blob: Blob }> {
    const selectedIds = new Set(ids)
    const objects = this.canvas.getObjects().filter((object) => {
      const id = objectId(object)
      return Boolean(id && selectedIds.has(id))
    })
    if (!objects.length) throw new Error('No canvas objects selected.')
    for (const object of objects) this.syncRecordFromObject(object)
    const padding = numberValue(options.padding, 0)
    const bounds = objects.reduce((acc, object) => {
      const left = numberValue(object.left, 0)
      const top = numberValue(object.top, 0)
      const size = objectSize(object)
      return {
        left: Math.min(acc.left, left),
        top: Math.min(acc.top, top),
        right: Math.max(acc.right, left + size.w),
        bottom: Math.max(acc.bottom, top + size.h)
      }
    }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY })
    const scale = Math.max(0.1, numberValue(options.scale, 1))
    const dataUrl = this.canvas.toDataURL({
      format: options.format || 'png',
      left: bounds.left - padding,
      top: bounds.top - padding,
      width: bounds.right - bounds.left + padding * 2,
      height: bounds.bottom - bounds.top + padding * 2,
      multiplier: scale,
      enableRetinaScaling: false,
      filter: (object: FabricObject) => {
        const id = objectId(object)
        return Boolean(id && selectedIds.has(id))
      }
    } as never)
    return { blob: dataUrlToBlob(dataUrl) }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  zoomAt(point: { x: number; y: number }, deltaY: number): void {
    const current = this.canvas.getZoom()
    const next = Math.max(0.1, Math.min(4, current * Math.pow(0.999, deltaY)))
    this.canvas.zoomToPoint(new Point(point.x, point.y), next)
    this.canvas.requestRenderAll()
    this.emitChange()
  }

  panBy(deltaX: number, deltaY: number): void {
    const transform = this.canvas.viewportTransform
    if (!transform) return
    transform[4] += deltaX
    transform[5] += deltaY
    this.canvas.setViewportTransform(transform)
    this.canvas.requestRenderAll()
    this.emitChange()
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose()
    this.listeners.clear()
    void this.canvas.dispose()
  }
}
