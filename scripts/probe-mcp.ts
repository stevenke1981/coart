import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { decodeWidgetHtml, LEGACY_WIDGET_URIS, WIDGET_HTML_GUARD_BYTES, WIDGET_URI } from '../mcp/lib/widget.ts'

const expectedTools = [
  'render_coart_canvas',
  'get_coart_canvas_state',
  'save_coart_canvas_state',
  'save_coart_selection',
  'save_coart_view_state',
  'get_coart_selection',
  'save_coart_reference_image',
  'read_coart_asset',
  'insert_coart_image',
  'insert_coart_html',
  'download_coart_file'
]

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['scripts/start-mcp.ts'],
  cwd: process.cwd(),
  stderr: 'pipe'
})
transport.stderr?.on('data', (chunk) => process.stderr.write(chunk))

const client = new Client({ name: 'coart-mcp-probe', version: '0.1.0' }, { capabilities: {} })

try {
  await client.connect(transport)

  const tools = await client.listTools()
  const toolNames = tools.tools.map((tool) => tool.name)
  for (const name of expectedTools) {
    if (!toolNames.includes(name)) throw new Error(`Missing MCP tool: ${name}`)
  }

  const rendered: any = await client.callTool({
    name: 'render_coart_canvas',
    arguments: { projectDir: process.cwd() }
  })
  if (rendered.isError) throw new Error('render_coart_canvas returned isError.')
  if (rendered.structuredContent?.widget !== 'coart-canvas-widget') {
    throw new Error('render_coart_canvas returned an unexpected widget payload.')
  }
  if (rendered.structuredContent?.preferredDisplayMode !== 'inline') {
    throw new Error('render_coart_canvas must default to inline mode for Codex Desktop stability.')
  }

  const fullscreenRendered: any = await client.callTool({
    name: 'render_coart_canvas',
    arguments: { projectDir: process.cwd(), displayMode: 'fullscreen' }
  })
  if (fullscreenRendered.structuredContent?.preferredDisplayMode !== 'inline') {
    throw new Error('render_coart_canvas must coerce fullscreen to inline while the Codex Desktop host bug is active.')
  }
  if (fullscreenRendered.structuredContent?.requestedDisplayMode !== 'fullscreen') {
    throw new Error('render_coart_canvas did not retain the requested display mode for diagnostics.')
  }

  const resources = await client.listResources()
  if (!resources.resources.some((resource) => resource.uri === WIDGET_URI)) {
    throw new Error(`Missing MCP resource: ${WIDGET_URI}`)
  }
  for (const legacyUri of LEGACY_WIDGET_URIS) {
    if (!resources.resources.some((resource) => resource.uri === legacyUri)) {
      throw new Error(`Missing legacy MCP resource: ${legacyUri}`)
    }
  }

  const widget = await client.readResource({ uri: WIDGET_URI })
  const firstContent = widget.contents?.[0] as { text?: string } | undefined
  const html = firstContent?.text || ''
  const decodedHtml = decodeWidgetHtml(html)
  if (!decodedHtml.includes('window.coartMcp')) throw new Error('Widget host bridge was not injected.')
  if (!/app\.onteardown\s*=/.test(decodedHtml)) throw new Error('Widget bridge teardown handler was not registered.')
  if (!decodedHtml.includes("availableDisplayModes: ['inline']")) throw new Error('Widget must advertise inline-only display support.')
  if (!decodedHtml.includes('{ autoResize: true }') || decodedHtml.includes('notifyHostSize') || decodedHtml.includes('layoutPulseTimer = setInterval')) {
    throw new Error('Widget bridge must delegate intrinsic sizing to the Apps SDK without a fixed-size override or recurring layout pulse.')
  }
  if (/html,body(?:,#root)?\{[^}]*height:100%/.test(decodedHtml)
    || !/html,body(?:,#root)?\{[^}]*min-height:640px/.test(decodedHtml)
    || !/\.coart-app\{[^}]*min-height:640px/.test(decodedHtml)
    || !/\.coart-app>\.tl-container\{[^}]*min-height:640px/.test(decodedHtml)) {
    throw new Error('Widget must keep a non-zero intrinsic height for MCP host autoResize handshakes.')
  }
  if (html.includes('data-coart-loader') || html.includes('DecompressionStream') || html.includes('document.importNode')) {
    throw new Error('Widget unexpectedly contains the legacy runtime document-rewrite loader.')
  }
  if (!decodedHtml.includes('<style>') || !decodedHtml.includes('<script>')) throw new Error('Widget build was not inlined.')
  if (!decodedHtml.includes('DOMParser') || !decodedHtml.includes('createObjectURL') || !decodedHtml.includes('image/svg+xml')) {
    throw new Error('Widget did not include the self-contained SVG icon path for tldraw icons.')
  }
  const outerHeadClose = decodedHtml.lastIndexOf('</head>')
  const bridgeBundle = decodedHtml.indexOf('__COART_EXT_APPS__')
  if (outerHeadClose < 0 || bridgeBundle < 0 || bridgeBundle > outerHeadClose) {
    throw new Error('Widget bridge was not injected into the outer HTML head.')
  }
  const widgetBytes = Buffer.byteLength(html)
  if (widgetBytes > WIDGET_HTML_GUARD_BYTES) {
    throw new Error(`Widget HTML unexpectedly exceeds the ${WIDGET_HTML_GUARD_BYTES}-byte inline resource guard (${widgetBytes}).`)
  }
  if (!html.startsWith('<!doctype html>') || !html.trimEnd().endsWith('</html>')) {
    throw new Error('Widget HTML has an invalid document envelope.')
  }

  console.log(JSON.stringify({
    ok: true,
    tools: toolNames.length,
    widgetUri: WIDGET_URI,
    widgetBytes,
    decodedWidgetBytes: Buffer.byteLength(decodedHtml)
  }))
} finally {
  await client.close()
}
