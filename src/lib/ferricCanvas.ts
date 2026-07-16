import {
  loadScene,
  type BridgeEffect,
  type FerricCanvasEngine
} from '@ferric-canvas/web'
import type {
  AnyCanvasShape,
  CanvasCamera,
  CanvasPoint,
  CanvasRecord,
  CanvasShapeInput,
  CanvasSnapshot,
  CanvasStylePatch,
  CanvasTool,
  CanvasViewportBounds,
  EditorLike,
  CanvasImageOptions
} from '../types'

const PAGE_ID = 'page:page'
const DOCUMENT_ID = 'document:document'
const SCENE_WIDTH = 1280
const SCENE_HEIGHT = 720
const EMPTY_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUBAScY42YAAAAASUVORK5CYII='

type FerricColor = { r: number; g: number; b: number; a: number }
type FerricPaint =
  | { kind: 'none' }
  | { kind: 'solid'; color: FerricColor }

interface FerricCommon {
  id: string
  name: string | null
  transform: {
    x: number
    y: number
    rotation_deg: number
    scale_x: number
    scale_y: number
    skew_x_deg: number
    skew_y_deg: number
    origin_x: number
    origin_y: number
  }
  visible: boolean
  selectable: boolean
  locked: boolean
  opacity: number
  fill: FerricPaint
  stroke: { paint: FerricPaint; width: number; dash: number[] } | null
  metadata: Record<string, unknown>
}

interface FerricObject {
  type: string
  common: FerricCommon
  [key: string]: unknown
}

interface FerricScene {
  schema_version: number
  size: { width: number; height: number }
  background: FerricColor
  viewport: { pan_x: number; pan_y: number; zoom: number }
  objects: FerricObject[]
}

export interface DraftRectangle {
  start: CanvasPoint
  end: CanvasPoint
}

interface FerricEditorOptions {
  onRender: (svg: string, camera: CanvasCamera) => void
  onChange?: () => void
  onDraftRectangle?: (draft: DraftRectangle | null) => void
  onTextEditRequest?: (shapeId: string) => void
  onError?: (message: string) => void
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function randomUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createCoartShapeId(): string {
  return `shape:${Date.now().toString(36)}-${randomUuid().slice(0, 12)}`
}

export function createEmptyCanvasSnapshot(): CanvasSnapshot {
  return {
    schema: {
      schemaVersion: 2,
      sequences: { 'coart.ferric': 1 }
    },
    store: {
      [DOCUMENT_ID]: { id: DOCUMENT_ID, typeName: 'document', props: {}, meta: {} },
      [PAGE_ID]: { id: PAGE_ID, typeName: 'page', name: 'Page 1', index: 'a1', props: {}, meta: {} }
    }
  }
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

function nextIndex(records: Map<string, CanvasRecord>, parentId: string): string {
  const count = [...records.values()]
    .filter((record) => record.typeName === 'shape' && record.parentId === parentId)
    .length
  return `a${count + 1}`
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

function parseCssColor(value: unknown, fallback: FerricColor): FerricColor {
  if (typeof value !== 'string') return fallback
  const input = value.trim().toLowerCase()
  const hex = input.match(/^#([0-9a-f]{3,8})$/)?.[1]
  if (hex) {
    const expanded = hex.length === 3 || hex.length === 4
      ? hex.split('').map((part) => `${part}${part}`).join('')
      : hex
    if (expanded.length === 6 || expanded.length === 8) {
      return {
        r: Number.parseInt(expanded.slice(0, 2), 16),
        g: Number.parseInt(expanded.slice(2, 4), 16),
        b: Number.parseInt(expanded.slice(4, 6), 16),
        a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255
      }
    }
  }
  const rgba = input.match(/^rgba?\(([^)]+)\)$/)?.[1]
  if (rgba) {
    const parts = rgba.split(',').map((part) => part.trim())
    const alpha = parts[3] === undefined ? 255 : Math.round(clamp(Number(parts[3]), 0, 1) * 255)
    if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(Number(part)))) {
      return {
        r: clamp(Math.round(Number(parts[0])), 0, 255),
        g: clamp(Math.round(Number(parts[1])), 0, 255),
        b: clamp(Math.round(Number(parts[2])), 0, 255),
        a: alpha
      }
    }
  }
  if (input === 'black') return { r: 0, g: 0, b: 0, a: 255 }
  if (input === 'white') return { r: 255, g: 255, b: 255, a: 255 }
  if (input === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  return fallback
}

function paint(value: unknown, fallback: FerricColor): FerricPaint {
  const color = parseCssColor(value, fallback)
  return color.a === 0 ? { kind: 'none' } : { kind: 'solid', color }
}

function stroke(value: unknown, fallback: string, width: unknown, dash: number[] = []): FerricCommon['stroke'] {
  return {
    paint: paint(typeof value === 'string' ? value : fallback, parseCssColor(fallback, { r: 109, g: 94, b: 247, a: 255 })),
    width: Math.max(0.5, numberValue(width, 2)),
    dash
  }
}

function strokeForRecord(record: AnyCanvasShape, fallback: string, defaultStyle: 'solid' | 'dashed' = 'solid'): FerricCommon['stroke'] {
  const width = Math.max(0.5, numberValue(record.props.strokeWidth, 2))
  const style = stringValue(record.props.strokeStyle, defaultStyle)
  if (style === 'none') return null
  const dash = style === 'dashed'
    ? [Math.max(6, width * 3), Math.max(4, width * 2)]
    : style === 'dotted'
      ? [width, width * 2.25]
      : []
  return stroke(record.props.stroke, fallback, width, dash)
}

function metadataForRecord(record: AnyCanvasShape): Record<string, unknown> {
  return {
    coartId: record.id,
    coartType: record.type || 'frame',
    coartParentId: record.parentId || PAGE_ID,
    coartIndex: record.index || '',
    coartProps: clone(record.props),
    coartMeta: clone(record.meta)
  }
}

function commonForRecord(
  record: AnyCanvasShape,
  ferricId: string,
  fill: FerricPaint,
  line: FerricCommon['stroke']
): FerricCommon {
  const title = stringValue(record.props.title) || stringValue(record.props.name)
  return {
    id: ferricId,
    name: title || null,
    transform: {
      x: numberValue(record.x, 0),
      y: numberValue(record.y, 0),
      rotation_deg: numberValue(record.rotation, 0),
      scale_x: 1,
      scale_y: 1,
      skew_x_deg: 0,
      skew_y_deg: 0,
      origin_x: 0,
      origin_y: 0
    },
    visible: true,
    selectable: !record.isLocked,
    locked: Boolean(record.isLocked),
    opacity: clamp(numberValue(record.opacity, 1), 0, 1),
    fill,
    stroke: line,
    metadata: metadataForRecord(record)
  }
}

function pathCommands(value: unknown): Array<Record<string, number | string>> {
  if (!Array.isArray(value)) return []
  const result: Array<Record<string, number | string>> = []
  for (const raw of value) {
    if (Array.isArray(raw)) {
      const [command, ...numbers] = raw
      const kind = String(command || '').toUpperCase()
      const values = numbers.map((item) => Number(item))
      if (kind === 'M' && values.length >= 2) result.push({ command: 'move_to', x: values[0], y: values[1] })
      if (kind === 'L' && values.length >= 2) result.push({ command: 'line_to', x: values[0], y: values[1] })
      if (kind === 'C' && values.length >= 6) result.push({ command: 'cubic_to', x1: values[0], y1: values[1], x2: values[2], y2: values[3], x: values[4], y: values[5] })
      if (kind === 'Q' && values.length >= 4) result.push({ command: 'quad_to', x1: values[0], y1: values[1], x: values[2], y: values[3] })
      if (kind === 'Z') result.push({ command: 'close' })
      continue
    }
    if (isRecord(raw) && typeof raw.command === 'string') result.push(clone(raw) as Record<string, number | string>)
  }
  return result
}

function objectForRecord(record: AnyCanvasShape, records: Map<string, CanvasRecord>, ferricId: string): FerricObject {
  const width = Math.max(1, numberValue(record.props.w, 512))
  const height = Math.max(1, numberValue(record.props.h, 512))
  const type = record.type || 'frame'

  if (type === 'text') {
    return {
      type: 'text',
      common: commonForRecord(record, ferricId, paint('transparent', { r: 0, g: 0, b: 0, a: 0 }), null),
      text: stringValue(record.props.text, stringValue(record.props.content, '文字')),
      font_family: stringValue(record.props.fontFamily, 'Inter, Segoe UI, sans-serif'),
      font_size: Math.max(8, numberValue(record.props.fontSize, 28)),
      font_weight: Math.max(100, Math.min(900, Math.round(numberValue(record.props.fontWeight, 400)))),
      line_height: 1.2,
      align: 'left',
      spans: []
    }
  }

  if (type === 'image') {
    const assetId = stringValue(record.props.assetId)
    const asset = assetId ? records.get(assetId) : undefined
    const source = stringValue(asset?.props?.src) || stringValue(record.props.src) || stringValue(record.props.url)
    if (source.startsWith('data:image/')) {
      return {
        type: 'image',
        common: commonForRecord(record, ferricId, { kind: 'none' }, null),
        source,
        width,
        height
      }
    }
  }

  if (type === 'line' || type === 'arrow') {
    return {
      type: 'line',
      common: commonForRecord(record, ferricId, { kind: 'none' }, strokeForRecord(record, '#6d5ef7')),
      x1: 0,
      y1: 0,
      x2: numberValue(record.props.x2, width),
      y2: numberValue(record.props.y2, height)
    }
  }

  if (type === 'draw' || type === 'path') {
    const commands = pathCommands(record.props.path)
    if (commands.length > 0) {
      return {
        type: 'path',
        common: commonForRecord(record, ferricId, { kind: 'none' }, strokeForRecord(record, '#6d5ef7')),
        commands
      }
    }
  }

  const isFrame = type === 'frame' || type === 'coart-html'
  const isRectangle = type === 'rectangle'
  return {
    type: 'rect',
    common: commonForRecord(
      record,
      ferricId,
      paint(record.props.fill, isFrame ? { r: 109, g: 94, b: 247, a: 18 } : { r: 255, g: 255, b: 255, a: 235 }),
      strokeForRecord(record, isFrame ? '#8b7fff' : '#6d5ef7', isFrame ? 'dashed' : 'solid')
    ),
    width,
    height,
    rx: isRectangle ? 0 : 12,
    ry: isRectangle ? 0 : 12
  }
}

function sceneForRecords(
  records: Map<string, CanvasRecord>,
  currentPageId: string,
  ferricIds: Map<string, string>,
  onlyIds?: Set<string>
): FerricScene {
  const shapes = [...records.values()]
    .filter((record): record is AnyCanvasShape => record.typeName === 'shape')
    .filter((record) => pageForRecord(records, record) === currentPageId)
    .filter((record) => !onlyIds || onlyIds.has(record.id))
    .sort((left, right) => String(left.index || '').localeCompare(String(right.index || '')))
  return {
    schema_version: 1,
    size: { width: SCENE_WIDTH, height: SCENE_HEIGHT },
    background: { r: 247, g: 247, b: 251, a: 255 },
    viewport: { pan_x: 0, pan_y: 0, zoom: 1 },
    objects: shapes.map((record) => {
      const ferricId = ferricIds.get(record.id) || randomUuid()
      ferricIds.set(record.id, ferricId)
      return objectForRecord(record, records, ferricId)
    })
  }
}

function objectDimensions(object: FerricObject, props: Record<string, unknown>): { w: number; h: number } {
  if (object.type === 'rect') return { w: numberValue(object.width, numberValue(props.w, 512)), h: numberValue(object.height, numberValue(props.h, 512)) }
  if (object.type === 'ellipse') return { w: numberValue(object.rx, 256) * 2, h: numberValue(object.ry, 256) * 2 }
  if (object.type === 'line') {
    return {
      w: Math.max(1, Math.abs(numberValue(object.x2, 120) - numberValue(object.x1, 0))),
      h: Math.max(1, Math.abs(numberValue(object.y2, 0) - numberValue(object.y1, 0)))
    }
  }
  if (object.type === 'image') return { w: numberValue(object.width, numberValue(props.w, 512)), h: numberValue(object.height, numberValue(props.h, 512)) }
  if (object.type === 'text') {
    const fontSize = numberValue(object.font_size, numberValue(props.fontSize, 28))
    return { w: numberValue(props.w, Math.max(1, stringValue(object.text).length * fontSize * 0.6)), h: numberValue(props.h, fontSize * 1.2) }
  }
  return { w: numberValue(props.w, 512), h: numberValue(props.h, 512) }
}

function recordFromObject(object: FerricObject): AnyCanvasShape {
  const common = isRecord(object.common) ? object.common as Record<string, unknown> : {}
  const transform = isRecord(common.transform) ? common.transform : {}
  const metadata = isRecord(common.metadata) ? common.metadata : {}
  const savedProps = isRecord(metadata.coartProps) ? clone(metadata.coartProps) as Record<string, unknown> : {}
  const savedMeta = isRecord(metadata.coartMeta) ? clone(metadata.coartMeta) as AnyCanvasShape['meta'] : {}
  const dimensions = objectDimensions(object, savedProps)
  const type = stringValue(metadata.coartType, object.type === 'text' ? 'text' : object.type === 'image' ? 'image' : object.type === 'line' ? 'line' : object.type === 'path' ? 'draw' : 'frame')
  const props: Record<string, unknown> = { ...savedProps, w: dimensions.w, h: dimensions.h }
  if (object.type === 'text') props.text = stringValue(object.text, stringValue(props.text, '文字'))
  return {
    id: stringValue(metadata.coartId, createCoartShapeId()),
    typeName: 'shape',
    type,
    parentId: stringValue(metadata.coartParentId, PAGE_ID),
    index: stringValue(metadata.coartIndex, 'a1'),
    x: numberValue(transform.x, 0),
    y: numberValue(transform.y, 0),
    rotation: numberValue(transform.rotation_deg, 0),
    opacity: numberValue(common.opacity, 1),
    isLocked: Boolean(common.locked),
    props,
    meta: savedMeta
  }
}

function recordBounds(record: AnyCanvasShape): { left: number; top: number; right: number; bottom: number } {
  const left = numberValue(record.x, 0)
  const top = numberValue(record.y, 0)
  const width = Math.max(1, numberValue(record.props.w, 512))
  const height = Math.max(1, numberValue(record.props.h, 512))
  return { left, top, right: left + width, bottom: top + height }
}

async function svgToBlob(
  svg: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  padding: number,
  scale: number
): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('Image export requires a browser document.')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Ferric SVG could not be rasterized.'))
      element.src = url
    })
    const width = Math.max(1, Math.ceil((bounds.right - bounds.left + padding * 2) * scale))
    const height = Math.max(1, Math.ceil((bounds.bottom - bounds.top + padding * 2) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D export context is unavailable.')
    context.drawImage(image, (-bounds.left + padding) * scale, (-bounds.top + padding) * scale, SCENE_WIDTH * scale, SCENE_HEIGHT * scale)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Ferric bitmap export returned no blob.')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export class CoartFerricEditor implements EditorLike {
  private readonly listeners = new Set<() => void>()
  private readonly ferricIds = new Map<string, string>()
  private records = new Map<string, CanvasRecord>()
  private schema: Record<string, unknown> = createEmptyCanvasSnapshot().schema
  private currentPageId = PAGE_ID
  private currentTool: CanvasTool = 'select'
  private selectedIds: string[] = []
  private camera: CanvasCamera = { x: 0, y: 0, z: 1 }
  private viewportWidth = 1280
  private viewportHeight = 640
  private draftStart: CanvasPoint | null = null
  private engine: FerricCanvasEngine | null = null
  private reloadChain: Promise<void> = Promise.resolve()
  private pendingReloads = 0
  private disposed = false

  private constructor(private readonly options: FerricEditorOptions) {
    this.records = new Map(Object.entries(createEmptyCanvasSnapshot().store))
  }

  static async create(options: FerricEditorOptions): Promise<CoartFerricEditor> {
    const editor = new CoartFerricEditor(options)
    await editor.reloadNow()
    return editor
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    console.error(error)
    this.options.onError?.(message)
  }

  private emitChange(): void {
    if (this.disposed) return
    this.options.onChange?.()
    for (const listener of this.listeners) listener()
  }

  private render(): void {
    if (!this.engine || this.disposed) return
    try {
      this.options.onRender(this.engine.renderSvg(), { ...this.camera })
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  private scene(): FerricScene {
    return sceneForRecords(this.records, this.currentPageId, this.ferricIds)
  }

  private async reloadNow(): Promise<void> {
    if (this.disposed) return
    const next = await loadScene(JSON.stringify(this.scene()))
    const previous = this.engine
    this.engine = next
    previous?.free?.()
    this.render()
  }

  private queueReload(): Promise<void> {
    this.pendingReloads += 1
    this.reloadChain = this.reloadChain
      .catch(() => undefined)
      .then(() => this.reloadNow())
      .catch((error: unknown) => this.reportError(error))
      .finally(() => { this.pendingReloads = Math.max(0, this.pendingReloads - 1) })
    return this.reloadChain
  }

  private syncFromEngine(): void {
    if (!this.engine || this.pendingReloads > 0) return
    try {
      const scene = JSON.parse(this.engine.sceneJson()) as FerricScene
      const activeIds = new Set<string>()
      for (const object of scene.objects || []) {
        const record = recordFromObject(object)
        activeIds.add(record.id)
        this.records.set(record.id, record)
        this.ferricIds.set(record.id, object.common.id)
      }
      for (const [id, record] of [...this.records.entries()]) {
        if (record.typeName === 'shape' && pageForRecord(this.records, record) === this.currentPageId && !activeIds.has(id)) {
          this.records.delete(id)
          this.ferricIds.delete(id)
        }
      }
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  private applyEffect(effect: BridgeEffect): void {
    const reverse = new Map([...this.ferricIds.entries()].map(([coartId, ferricId]) => [ferricId, coartId]))
    this.selectedIds = effect.selection.map((id) => reverse.get(id)).filter((id): id is string => Boolean(id))
    if (effect.scene_changed) this.syncFromEngine()
    if (effect.request_render || effect.scene_changed) this.render()
    this.emitChange()
  }

  getViewportPageBounds(): CanvasViewportBounds {
    const zoom = Math.max(0.01, this.camera.z)
    return {
      x: -this.camera.x / zoom,
      y: -this.camera.y / zoom,
      w: this.viewportWidth / zoom,
      h: this.viewportHeight / zoom
    }
  }

  setViewportSize(width: number, height: number): void {
    const nextWidth = Math.max(1, width)
    const nextHeight = Math.max(1, height)
    if (nextWidth === this.viewportWidth && nextHeight === this.viewportHeight) return
    this.viewportWidth = nextWidth
    this.viewportHeight = nextHeight
    this.render()
    this.emitChange()
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
    return { ...this.camera }
  }

  setCamera(camera: CanvasCamera): void {
    this.camera = {
      x: numberValue(camera.x, 0),
      y: numberValue(camera.y, 0),
      z: clamp(numberValue(camera.z, 1), 0.1, 4)
    }
    this.render()
    this.emitChange()
  }

  worldPointFromScreen(point: CanvasPoint): CanvasPoint {
    return {
      x: (point.x - this.camera.x) / Math.max(0.01, this.camera.z),
      y: (point.y - this.camera.y) / Math.max(0.01, this.camera.z)
    }
  }

  screenRect(record: AnyCanvasShape): { left: number; top: number; width: number; height: number } {
    return {
      left: this.camera.x + numberValue(record.x, 0) * this.camera.z,
      top: this.camera.y + numberValue(record.y, 0) * this.camera.z,
      width: Math.max(1, numberValue(record.props.w, 512)) * this.camera.z,
      height: Math.max(1, numberValue(record.props.h, 512)) * this.camera.z
    }
  }

  getSelectedShapeIds(): string[] {
    return [...this.selectedIds]
  }

  getShape(id: string): AnyCanvasShape | undefined {
    this.syncFromEngine()
    const record = this.records.get(id)
    return record?.typeName === 'shape' ? clone(record) as AnyCanvasShape : undefined
  }

  getCurrentPageShapes(): AnyCanvasShape[] {
    this.syncFromEngine()
    return [...this.records.values()]
      .filter((record): record is AnyCanvasShape => record.typeName === 'shape' && pageForRecord(this.records, record) === this.currentPageId)
      .sort((left, right) => String(left.index || '').localeCompare(String(right.index || '')))
      .map((record) => clone(record))
  }

  createShape(input: CanvasShapeInput): void {
    const record = recordFromInput(input, nextIndex(this.records, input.parentId || this.currentPageId), this.currentPageId)
    this.records.set(record.id, record)
    this.selectedIds = [record.id]
    void this.queueReload()
    this.emitChange()
  }

  select(id: string): void {
    if (!this.records.has(id)) return
    this.selectedIds = [id]
    this.emitChange()
  }

  setSelection(ids: string[]): void {
    this.selectedIds = ids.filter((id) => this.records.get(id)?.typeName === 'shape')
    this.emitChange()
  }

  duplicateSelection(): void {
    if (!this.selectedIds.length) return
    this.syncFromEngine()
    const idMap = new Map(this.selectedIds.map((id) => [id, createCoartShapeId()]))
    const duplicatedIds: string[] = []
    for (const id of this.selectedIds) {
      const record = this.records.get(id)
      if (!record || record.typeName !== 'shape') continue
      const copy = clone(record) as AnyCanvasShape
      copy.id = idMap.get(id) as string
      copy.parentId = idMap.get(String(record.parentId)) || record.parentId
      copy.index = nextIndex(this.records, String(copy.parentId || this.currentPageId))
      copy.x = numberValue(record.x, 0) + 24
      copy.y = numberValue(record.y, 0) + 24
      this.records.set(copy.id, copy)
      duplicatedIds.push(copy.id)
    }
    this.selectedIds = duplicatedIds
    void this.queueReload()
    this.emitChange()
  }

  deleteSelection(): void {
    void this.deleteSelected()
  }

  updateSelectedStyles(patch: CanvasStylePatch): void {
    if (!this.selectedIds.length) return
    this.syncFromEngine()
    for (const id of this.selectedIds) {
      const record = this.records.get(id)
      if (!record || record.typeName !== 'shape') continue
      if (patch.fill !== undefined) record.props.fill = patch.fill
      if (patch.stroke !== undefined) record.props.stroke = patch.stroke
      if (patch.strokeWidth !== undefined) record.props.strokeWidth = Math.max(0.5, patch.strokeWidth)
      if (patch.strokeStyle !== undefined) record.props.strokeStyle = patch.strokeStyle
      if (patch.opacity !== undefined) record.opacity = clamp(patch.opacity, 0.1, 1)
    }
    void this.queueReload()
    this.emitChange()
  }

  setCurrentTool(tool: CanvasTool): void {
    this.currentTool = tool
    if (tool !== 'rectangle') {
      this.draftStart = null
      this.options.onDraftRectangle?.(null)
    }
    this.emitChange()
  }

  getCurrentTool(): CanvasTool {
    return this.currentTool
  }

  beginRectangle(point: CanvasPoint): void {
    this.draftStart = { ...point }
    this.lastDraftEnd = { ...point }
    this.options.onDraftRectangle?.({ start: { ...point }, end: { ...point } })
  }

  updateRectangle(point: CanvasPoint): void {
    if (!this.draftStart) return
    this.lastDraftEnd = { ...point }
    this.options.onDraftRectangle?.({ start: { ...this.draftStart }, end: { ...point } })
  }

  finishRectangle(): void {
    const start = this.draftStart
    this.draftStart = null
    const end = this.lastDraftEnd || start
    this.lastDraftEnd = null
    this.options.onDraftRectangle?.(null)
    if (!start) return
    if (!end) return
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    if (width < 8 || height < 8) return
    this.createShape({
      id: createCoartShapeId(),
      type: 'rectangle',
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      props: { w: width, h: height, stroke: '#6d5ef7', strokeWidth: 2, fill: 'rgba(109,94,247,0.02)' },
      meta: { coartVersion: 1 }
    })
    this.currentTool = 'select'
  }

  private lastDraftEnd: CanvasPoint | null = null

  createText(point: CanvasPoint): void {
    const id = createCoartShapeId()
    this.createShape({
      id,
      type: 'text',
      x: point.x,
      y: point.y,
      props: {
        text: '輸入文字',
        w: 120,
        h: 40,
        fontSize: 28,
        fontFamily: 'Inter, Segoe UI, sans-serif',
        fill: '#17161d',
        fontWeight: '400'
      },
      meta: { coartVersion: 1 }
    })
    this.currentTool = 'select'
    void this.reloadChain.then(() => this.options.onTextEditRequest?.(id))
  }

  requestTextEdit(id: string): void {
    if (this.records.get(id)?.type === 'text') this.options.onTextEditRequest?.(id)
  }

  async commitText(id: string, value: string): Promise<void> {
    const record = this.records.get(id)
    if (!record || record.typeName !== 'shape' || record.type !== 'text') return
    record.props = { ...record.props, text: value || '文字' }
    this.selectedIds = [id]
    await this.queueReload()
    this.emitChange()
  }

  zoomAt(point: CanvasPoint, deltaY: number): void {
    const before = this.worldPointFromScreen(point)
    const next = clamp(this.camera.z * Math.pow(0.999, deltaY), 0.1, 4)
    this.camera = { x: point.x - before.x * next, y: point.y - before.y * next, z: next }
    this.render()
    this.emitChange()
  }

  panBy(deltaX: number, deltaY: number): void {
    this.camera = { ...this.camera, x: this.camera.x + deltaX, y: this.camera.y + deltaY }
    this.render()
    this.emitChange()
  }

  pointerDown(screenPoint: CanvasPoint, shift: boolean): void {
    if (!this.engine) return
    const point = this.worldPointFromScreen(screenPoint)
    try {
      this.applyEffect(this.engine.pointerDown(point.x, point.y, shift))
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  pointerMove(screenPoint: CanvasPoint): void {
    if (!this.engine) return
    const point = this.worldPointFromScreen(screenPoint)
    try {
      this.applyEffect(this.engine.pointerMove(point.x, point.y))
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  pointerUp(screenPoint: CanvasPoint): void {
    if (!this.engine) return
    const point = this.worldPointFromScreen(screenPoint)
    try {
      this.applyEffect(this.engine.pointerUp(point.x, point.y))
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  pointerCancel(): void {
    if (!this.engine) return
    try {
      this.applyEffect(this.engine.pointerCancel())
    } catch (error: unknown) {
      this.reportError(error)
    }
  }

  handleKeyDown(event: { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean; isComposing?: boolean }): boolean {
    if (event.isComposing && ['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return true
    if (event.key === 'Escape') {
      this.selectedIds = []
      this.emitChange()
      return true
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      void this.deleteSelected()
      return true
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      void this.nudgeSelected(event.key, event.shiftKey ? 10 : 1)
      return true
    }
    if (!this.engine) return false
    try {
      this.applyEffect(this.engine.keyDown(event.key, event.shiftKey, event.ctrlKey, event.altKey, event.metaKey))
      return false
    } catch (error: unknown) {
      this.reportError(error)
      return false
    }
  }

  private async deleteSelected(): Promise<void> {
    if (!this.selectedIds.length) return
    for (const id of this.selectedIds) this.records.delete(id)
    this.selectedIds = []
    await this.queueReload()
    this.emitChange()
  }

  private async nudgeSelected(key: string, step: number): Promise<void> {
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
    const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0
    for (const id of this.selectedIds) {
      const record = this.records.get(id)
      if (!record || record.typeName !== 'shape') continue
      record.x = numberValue(record.x, 0) + dx
      record.y = numberValue(record.y, 0) + dy
    }
    await this.queueReload()
    this.emitChange()
  }

  getStoreSnapshot(): CanvasSnapshot {
    this.syncFromEngine()
    const store: Record<string, CanvasRecord> = {}
    for (const [id, record] of this.records) store[id] = clone(record)
    return { schema: clone(this.schema), store }
  }

  async loadStoreSnapshot(snapshot: CanvasSnapshot): Promise<void> {
    this.schema = clone(snapshot.schema || createEmptyCanvasSnapshot().schema)
    this.records = new Map(Object.entries(snapshot.store || {}).map(([id, record]) => [id, clone(record)]))
    this.currentPageId = [...this.records.values()].find((record) => record.typeName === 'page')?.id || PAGE_ID
    if (!this.records.has(DOCUMENT_ID)) this.records.set(DOCUMENT_ID, { id: DOCUMENT_ID, typeName: 'document', props: {}, meta: {} })
    if (!this.records.has(this.currentPageId)) this.records.set(this.currentPageId, { id: this.currentPageId, typeName: 'page', name: 'Page 1', index: 'a1', props: {}, meta: {} })
    this.ferricIds.clear()
    this.selectedIds = []
    await this.queueReload()
    this.emitChange()
  }

  async toImage(ids: string[], options: CanvasImageOptions = {}): Promise<{ blob: Blob }> {
    this.syncFromEngine()
    const selected = new Set(ids)
    const records = this.getCurrentPageShapes().filter((record) => selected.has(record.id))
    if (!records.length) throw new Error('No canvas objects selected.')
    const bounds = records.reduce((result, record) => {
      const next = recordBounds(record)
      return {
        left: Math.min(result.left, next.left),
        top: Math.min(result.top, next.top),
        right: Math.max(result.right, next.right),
        bottom: Math.max(result.bottom, next.bottom)
      }
    }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY })
    const temp = await loadScene(JSON.stringify(sceneForRecords(this.records, this.currentPageId, this.ferricIds, selected)))
    try {
      return { blob: await svgToBlob(temp.renderSvg(), bounds, Math.max(0, numberValue(options.padding, 0)), Math.max(0.1, numberValue(options.scale, 1))) }
    } finally {
      temp.free?.()
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
    this.engine?.free?.()
    this.engine = null
  }
}
