import type { Editor, TLShape, TLStoreSnapshot, TLCamera } from 'tldraw'

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

export type AnyCanvasShape = TLShape & {
  meta: CoartShapeMeta
  props: BoxProps
}

export type CoartHtmlShapeProps = {
  w: number
  h: number
  html: string
  title: string
  assetUrl: string
}

export type CoartHtmlShape = TLShape<'coart-html'>

export interface AspectPreset {
  id: string
  width: number
  height: number
}

export interface CanvasState {
  snapshot?: TLStoreSnapshot
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
  camera: TLCamera
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
  toolOutput?: CoartToolOutput
}

export type EditorLike = Editor

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
