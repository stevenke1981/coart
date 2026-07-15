import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  downloadFile,
  insertHtml,
  insertImage,
  readAsset,
  readCanvasState,
  readLatestImageAsset,
  readSelection,
  resolveCoartPaths,
  saveCanvasSnapshot,
  writeAsset,
  writeSelection,
  writeViewState
} from './lib/storage.ts'
import { openCoartEditor } from './lib/editor.ts'
import { registerCoartWidgetResource, WIDGET_BUILD_DIR, WIDGET_URI } from './lib/widget.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, '.codex-plugin', 'plugin.json'), 'utf8'))
export function createCoartServer() {
  const server = new McpServer({ name: manifest.name, version: manifest.version }, {
    instructions: 'For Codex Desktop or ChatGPT workflows, use open_coart_editor to open the standalone project-local editor window. Use get_coart_latest_image or read_coart_asset when the conversation needs to see an edited image, then use insert_coart_image for placement. When an MCP Apps Widget host is available, render_coart_canvas defaults to sidebar; pass displayMode inline for an explicit inline fallback.'
  })

const targetSchema = {
  projectDir: z.string().trim().optional(),
  canvasDir: z.string().trim().optional()
}

function result(text: string, structuredContent: unknown, extraMeta: Record<string, unknown> = {}): any {
  return { content: [{ type: 'text' as const, text }], structuredContent, _meta: extraMeta }
}

function imageResult(text: string, asset: any): any {
  const content: any[] = [{ type: 'text' as const, text }]
  if (asset?.mimeType?.startsWith('image/') && typeof asset.dataBase64 === 'string') {
    content.push({ type: 'image' as const, data: asset.dataBase64, mimeType: asset.mimeType })
  }
  return { content, structuredContent: asset }
}

registerCoartWidgetResource(server)

server.registerTool('open_coart_editor', {
  title: 'Open Coart Editor Window',
  description: 'Use this when the user wants Coart in a separate local editor window that persists directly to the active project and can be followed by the same Codex conversation.',
  inputSchema: { ...targetSchema },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Opened Coart editor window.', await openCoartEditor(input)))

registerAppTool(server, 'render_coart_canvas', {
  title: 'Render Coart Canvas',
  description: 'Use this when the user wants to open or return to the Coart infinite canvas for the active project.',
  inputSchema: { ...targetSchema, title: z.string().trim().optional(), displayMode: z.enum(['inline', 'sidebar', 'fullscreen']).optional() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  _meta: {
    ui: { resourceUri: WIDGET_URI, visibility: ['model', 'app'] },
    'ui/resourceUri': WIDGET_URI,
    'openai/outputTemplate': WIDGET_URI,
    'openai/widgetAccessible': true,
    'openai/toolInvocation/invoking': 'Opening Coart canvas…',
    'openai/toolInvocation/invoked': 'Coart canvas ready'
  }
}, async (input: any = {}) => {
  const paths = resolveCoartPaths(input)
  const widgetData = {
    version: 1,
    widget: 'coart-canvas-widget',
    title: input.title || 'Coart Canvas',
    rendering: 'native-widget',
    // Sidebar is the default Codex host placement. Keep explicit inline and
    // legacy fullscreen requests on the standard inline MCP Apps path.
    preferredDisplayMode: input.displayMode === 'inline' || input.displayMode === 'fullscreen' ? 'inline' : 'sidebar',
    requestedDisplayMode: input.displayMode || 'sidebar',
    projectDir: paths.projectDir,
    canvasDir: paths.canvasDir,
    staticDir: WIDGET_BUILD_DIR
  }
  return result('Rendered Coart canvas widget.', widgetData, { 'openai/outputTemplate': WIDGET_URI, widgetData })
})

server.registerTool('get_coart_canvas_state', {
  title: 'Get Coart Canvas State',
  description: 'Use this when you need the persisted Coart snapshot, view state, selection, manifest, or storage paths.',
  inputSchema: { ...targetSchema, hydrateAssets: z.boolean().optional() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => {
  const state = await readCanvasState(input, { hydrateAssets: input.hydrateAssets === true })
  return result(`Loaded Coart canvas state from ${state.canvasDir}.`, state)
})

server.registerTool('save_coart_canvas_state', {
  title: 'Save Coart Canvas State',
  description: 'Use this when the widget needs to persist a Coart/Fabric canvas snapshot and localize data URL assets.',
  inputSchema: { ...targetSchema, snapshot: z.any() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Saved Coart canvas state.', await saveCanvasSnapshot(input, input.snapshot)))

server.registerTool('save_coart_selection', {
  title: 'Save Coart Selection',
  description: 'Use this when the widget selection changes and Codex must target the same selected shapes.',
  inputSchema: { ...targetSchema, selection: z.any() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => result('Saved Coart selection.', await writeSelection(input, input.selection)))

server.registerTool('save_coart_view_state', {
  title: 'Save Coart View State',
  description: 'Use this when the widget needs to persist the active page and camera.',
  inputSchema: { ...targetSchema, viewState: z.any() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => result('Saved Coart view state.', await writeViewState(input, input.viewState)))

server.registerTool('get_coart_selection', {
  title: 'Get Coart Selection',
  description: 'Use this when a generation or edit workflow needs the current persisted Coart selection.',
  inputSchema: { ...targetSchema },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => result('Loaded Coart selection.', await readSelection(input)))

server.registerTool('save_coart_reference_image', {
  title: 'Save Coart Reference Image',
  description: 'Use this when the widget provides a reference or annotation image that must be saved inside canvas assets.',
  inputSchema: {
    ...targetSchema,
    pageId: z.string().trim().optional(),
    anchorShapeId: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    dataUrl: z.string().optional(),
    dataBase64: z.string().optional(),
    mimeType: z.string().trim().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Saved Coart reference image.', await writeAsset(input, input)))

server.registerTool('read_coart_asset', {
  title: 'Read Coart Asset',
  description: 'Use this when a workflow needs to read one project-local /assets/... image or HTML item. Image assets are returned as visual MCP image content as well as structured Base64 metadata.',
  inputSchema: { ...targetSchema, assetUrl: z.string().trim() },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => imageResult(`Read ${input.assetUrl}.`, await readAsset(input, input.assetUrl)))

server.registerTool('get_coart_latest_image', {
  title: 'Get Latest Coart Image',
  description: 'Use this after the user edits or saves an image in the standalone Coart editor. Returns the newest project-local image as visual MCP image content and structured metadata.',
  inputSchema: { ...targetSchema },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}, async (input: any = {}) => imageResult('Loaded the latest Coart image asset.', await readLatestImageAsset(input)))

server.registerTool('insert_coart_image', {
  title: 'Insert Coart Image',
  description: 'Use this when a generated image must be copied into canvas assets and inserted, optionally replacing an acknowledged AI image holder.',
  inputSchema: {
    ...targetSchema,
    imagePath: z.string().trim(),
    pageId: z.string().trim().optional(),
    anchorShapeId: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    displayWidth: z.number().positive().optional(),
    displayHeight: z.number().positive().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    altText: z.string().trim().optional(),
    replaceHolder: z.boolean().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Inserted Coart image.', await insertImage(input)))

server.registerTool('insert_coart_html', {
  title: 'Insert Coart HTML',
  description: 'Use this when single-file HTML must be inserted, an acknowledged HTML shape updated, or a page added to Slides.',
  inputSchema: {
    ...targetSchema,
    htmlContent: z.string().optional(),
    htmlPath: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    title: z.string().trim().optional(),
    pageId: z.string().trim().optional(),
    anchorShapeId: z.string().trim().optional(),
    shapeId: z.string().trim().optional(),
    slidesShapeId: z.string().trim().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    replaceHolder: z.boolean().optional(),
    updateExisting: z.boolean().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Inserted Coart HTML.', await insertHtml(input)))

server.registerTool('download_coart_file', {
  title: 'Download Coart File',
  description: 'Use this when the user explicitly wants a Coart asset or data payload saved into Downloads.',
  inputSchema: {
    ...targetSchema,
    assetUrl: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    dataUrl: z.string().optional(),
    dataBase64: z.string().optional(),
    mimeType: z.string().trim().optional()
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
}, async (input: any = {}) => result('Downloaded Coart file.', await downloadFile(input)))

  return server
}
