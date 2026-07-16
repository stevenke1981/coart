export type CoartKind = 'ai-image' | 'ai-html' | 'slides'

export interface CoartShapeMeta {
  coartKind?: CoartKind
  coartVersion?: number
  [key: string]: unknown
}

export interface BoxProps {
  w?: number
  h?: number
  [key: string]: unknown
}

export interface CanvasRecord {
  id: string
  typeName: 'document' | 'page' | 'shape' | 'asset' | 'binding' | string
  type?: string
  parentId?: string
  index?: string
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  isLocked?: boolean
  props: Record<string, unknown> & BoxProps
  meta: CoartShapeMeta
  [key: string]: unknown
}

export type AnyCanvasShape = CanvasRecord & {
  typeName: 'shape'
  props: BoxProps
}

export type CoartHtmlShapeProps = {
  w: number
  h: number
  html: string
  title: string
  assetUrl: string
}

export type CoartHtmlShape = AnyCanvasShape & {
  type: 'coart-html'
  props: CoartHtmlShapeProps
}

export interface CanvasSnapshot {
  schema: Record<string, unknown>
  store: Record<string, CanvasRecord>
  [key: string]: unknown
}

export interface CanvasCamera {
  x: number
  y: number
  z: number
}

export interface AspectPreset {
  id: string
  width: number
  height: number
}

export interface CanvasState {
  snapshot?: CanvasSnapshot | null
  selection?: SelectionState | null
  viewState?: ViewState | null
  storage?: string
  [key: string]: unknown
}

export interface SelectionState {
  version: number
  pageId: string
  selectedShapeIds: string[]
  selectedShapes: AnyCanvasShape[]
  updatedAt: string
}

export interface ViewState {
  version: number
  currentPageId: string
  camera: CanvasCamera
  updatedAt: string
}

export interface ReferenceImageInput {
  pageId: string
  anchorShapeId: string
  fileName: string
  dataUrl: string
  mimeType: string
}

export interface ReferenceImageResult {
  assetPath?: string
  assetPathRelativeToProject?: string
  dataUrl?: string
  [key: string]: unknown
}

export interface DownloadPayload {
  dataUrl: string
  fileName?: string
  [key: string]: unknown
}

export interface McpTextContent {
  type: 'text'
  text: string
}

export interface McpToolResult {
  isError?: boolean
  content?: Array<McpTextContent | { type: string; [key: string]: unknown }>
  structuredContent?: unknown
  [key: string]: unknown
}

export interface CoartToolOutput {
  projectDir?: string
  canvasDir?: string
  [key: string]: unknown
}

export interface CoartMcpCallRequest {
  name: string
  arguments?: Record<string, unknown>
}

export interface CoartMcpBridge {
  callServerTool(request: CoartMcpCallRequest): Promise<McpToolResult>
  sendFollowUpMessage(request: { prompt: string }): Promise<unknown>
}

export interface OpenAiBridge {
  toolOutput?: unknown
  toolInput?: unknown
  widgetData?: unknown
  projectDir?: string
  canvasDir?: string
}

export interface CanvasViewportBounds {
  x: number
  y: number
  w: number
  h: number
}

export type CanvasTool = 'select' | 'pan' | 'draw' | 'rectangle' | 'text'

export type CanvasStrokeStyle = 'solid' | 'dashed' | 'dotted' | 'none'

export interface CanvasStylePatch {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeStyle?: CanvasStrokeStyle
  opacity?: number
}

export interface CanvasPoint {
  x: number
  y: number
}

export interface CanvasImageOptions {
  format?: 'png' | 'jpeg' | 'webp'
  background?: boolean
  padding?: number
  scale?: number
}

export interface CanvasShapeInput {
  id: string
  type?: string
  parentId?: string
  index?: string
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  isLocked?: boolean
  props?: BoxProps
  meta?: CoartShapeMeta
}

export interface EditorLike {
  getViewportPageBounds(): CanvasViewportBounds
  getCurrentPageId(): string
  setCurrentPage(pageId: string): void
  has(id: string): boolean
  getCamera(): CanvasCamera
  setCamera(camera: CanvasCamera): void
  getSelectedShapeIds(): string[]
  getShape(id: string): AnyCanvasShape | undefined
  getCurrentPageShapes(): AnyCanvasShape[]
  createShape(input: CanvasShapeInput): void
  select(id: string): void
  setSelection(ids: string[]): void
  duplicateSelection(): void
  deleteSelection(): void
  updateSelectedStyles(patch: CanvasStylePatch): void
  setCurrentTool(tool: CanvasTool): void
  getCurrentTool(): CanvasTool
  beginRectangle(point: CanvasPoint): void
  updateRectangle(point: CanvasPoint): void
  finishRectangle(): void
  createText(point: CanvasPoint): void
  getStoreSnapshot(): CanvasSnapshot
  loadStoreSnapshot(snapshot: CanvasSnapshot): Promise<void>
  toImage(ids: string[], options?: CanvasImageOptions): Promise<{ blob: Blob }>
  onChange(listener: () => void): () => void
}

export interface PromptShape {
  id: string
  props?: BoxProps
  meta?: CoartShapeMeta
}

export interface PromptReference {
  assetPath?: string
  assetPathRelativeToProject?: string
}

export interface ImagePromptArgs {
  userPrompt: string
  shape: PromptShape
  pageId: string
  references?: PromptReference[]
}

export interface HtmlPromptArgs extends ImagePromptArgs {}

export interface SlidesPromptArgs extends ImagePromptArgs {
  slideCount: number
}

export interface AnnotationPromptArgs {
  pageId: string
  screenshot: PromptReference
}
