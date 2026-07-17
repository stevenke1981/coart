export type CoartKind = 'ai-image' | 'ai-html' | 'slides'
export type ImageResolution = '2K' | '4K'

export interface CoartShapeMeta {
  coartKind?: CoartKind
  coartVersion?: number
  coartAspectRatio?: string
  coartResolution?: ImageResolution
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

export type CanvasTool = 'select' | 'pan' | 'draw' | 'rectangle' | 'text' | 'eraser'

export interface CanvasPageInfo {
  id: string
  name: string
  index: string
}

export interface CanvasShapePatch {
  type?: string
  x?: number
  y?: number
  rotation?: number
  parentId?: string
  index?: string
  isLocked?: boolean
  props?: Record<string, unknown>
  meta?: CoartShapeMeta
}

export type EditorEventType = 'document' | 'selection' | 'camera' | 'tool' | 'interaction' | 'render'

export interface DocumentChangeEvent {
  revision: number
  changedIds: string[]
}

export interface SelectionChangeEvent {
  revision: number
  ids: string[]
}

export interface CameraChangeEvent {
  revision: number
  camera: CanvasCamera
}

export interface ToolChangeEvent {
  tool: CanvasTool
}

export interface InteractionChangeEvent {
  phase: 'started' | 'updated' | 'committed' | 'cancelled'
  interaction: 'pointer' | 'resize' | 'rotate' | 'marquee'
}

export interface RenderChangeEvent {
  revision: number
}

export interface EditorChangeMap {
  document: DocumentChangeEvent
  selection: SelectionChangeEvent
  camera: CameraChangeEvent
  tool: ToolChangeEvent
  interaction: InteractionChangeEvent
  render: RenderChangeEvent
}

export interface DirtyState {
  documentRevision: number
  savedDocumentRevision: number
  selectionRevision: number
  savedSelectionRevision: number
  viewRevision: number
  savedViewRevision: number
}

export interface EditorDiagnostics {
  loadSceneCount: number
  pointerMoveCount: number
  documentRevision: number
  renderRevision: number
  recordCount: number
  selectedIds: string[]
}

export interface CanvasBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type ZoomFitMode = 'content' | 'selection' | 'reset'

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
  getPages(): CanvasPageInfo[]
  createPage(name?: string): string
  renamePage(pageId: string, name: string): void
  movePage(pageId: string, direction: 'forward' | 'backward'): void
  deletePage(pageId: string): void
  has(id: string): boolean
  getCamera(): CanvasCamera
  setCamera(camera: CanvasCamera): void
  zoomToFit(mode: ZoomFitMode): void
  getSelectedShapeIds(): string[]
  getShape(id: string): AnyCanvasShape | undefined
  getCurrentPageShapes(): AnyCanvasShape[]
  createShape(input: CanvasShapeInput): void
  updateShape(id: string, patch: CanvasShapePatch): void
  getImageSource(id: string): string
  replaceImage(id: string, dataUrl: string, fileName?: string): void
  select(id: string): void
  setSelection(ids: string[]): void
  selectInBounds(bounds: CanvasBounds, additive?: boolean): void
  getSelectionBounds(): CanvasBounds | null
  getSelectionScreenBounds(): CanvasViewportBounds | null
  duplicateSelection(): void
  deleteSelection(): void
  copySelection(): void
  pasteClipboard(): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  toggleSelectionLock(): void
  groupSelection(): void
  ungroupSelection(): void
  renameSelection(name: string): void
  reparentSelection(parentId: string): void
  layoutSlides(parentId: string, orderedIds?: string[]): void
  moveSelectionLayer(direction: 'forward' | 'backward'): void
  updateSelectedStyles(patch: CanvasStylePatch): void
  setCurrentTool(tool: CanvasTool): void
  getCurrentTool(): CanvasTool
  beginRectangle(point: CanvasPoint): void
  updateRectangle(point: CanvasPoint): void
  finishRectangle(): void
  createText(point: CanvasPoint): void
  beginResize(handle: ResizeHandle, point: CanvasPoint): void
  updateResize(point: CanvasPoint): void
  commitResize(): void
  cancelResize(): void
  beginRotate(point: CanvasPoint): void
  updateRotate(point: CanvasPoint): void
  commitRotate(): void
  cancelRotate(): void
  getDocumentRevision(): number
  getDiagnostics(): EditorDiagnostics
  getStoreSnapshot(): CanvasSnapshot
  loadStoreSnapshot(snapshot: CanvasSnapshot): Promise<void>
  toImage(ids: string[], options?: CanvasImageOptions): Promise<{ blob: Blob }>
  onChange(listener: () => void): () => void
  on<K extends EditorEventType>(type: K, listener: (event: EditorChangeMap[K]) => void): () => void
}

export interface PromptShape {
  id: string
  type?: string
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
  resolution?: ImageResolution
}

export interface HtmlPromptArgs extends ImagePromptArgs {}

export interface SlidesPromptArgs extends ImagePromptArgs {
  slideCount: number
}

export interface AnnotationPromptArgs {
  pageId: string
  screenshot: PromptReference
}
