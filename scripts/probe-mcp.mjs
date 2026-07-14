import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { decodeWidgetHtml, WIDGET_HTML_GUARD_BYTES } from '../mcp/lib/widget.mjs'

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
  args: ['scripts/start-mcp.mjs'],
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

  const rendered = await client.callTool({
    name: 'render_coart_canvas',
    arguments: { projectDir: process.cwd(), displayMode: 'inline' }
  })
  if (rendered.isError) throw new Error('render_coart_canvas returned isError.')
  if (rendered.structuredContent?.widget !== 'coart-canvas-widget') {
    throw new Error('render_coart_canvas returned an unexpected widget payload.')
  }

  const resources = await client.listResources()
  const widgetUri = 'ui://widget/coart/canvas.html'
  if (!resources.resources.some((resource) => resource.uri === widgetUri)) {
    throw new Error(`Missing MCP resource: ${widgetUri}`)
  }

  const widget = await client.readResource({ uri: widgetUri })
  const html = widget.contents?.[0]?.text || ''
  const decodedHtml = decodeWidgetHtml(html)
  if (!decodedHtml.includes('window.coartMcp')) throw new Error('Widget host bridge was not injected.')
  if (!decodedHtml.includes('<style>') || !decodedHtml.includes('<script>')) throw new Error('Widget build was not inlined.')
  const outerHeadClose = decodedHtml.lastIndexOf('</head>')
  const bridgeBundle = decodedHtml.indexOf('__COART_EXT_APPS__')
  if (outerHeadClose < 0 || bridgeBundle < 0 || bridgeBundle > outerHeadClose) {
    throw new Error('Widget bridge was not injected into the outer HTML head.')
  }
  const widgetBytes = Buffer.byteLength(html)
  if (widgetBytes > WIDGET_HTML_GUARD_BYTES) {
    throw new Error(`Widget HTML unexpectedly exceeds the ${WIDGET_HTML_GUARD_BYTES}-byte compressed-loader guard (${widgetBytes}).`)
  }
  if (!html.startsWith('<!doctype html>') || !html.trimEnd().endsWith('</html>')) {
    throw new Error('Widget HTML has an invalid document envelope.')
  }

  console.log(JSON.stringify({
    ok: true,
    tools: toolNames.length,
    widgetUri,
    widgetBytes,
    decodedWidgetBytes: Buffer.byteLength(decodedHtml)
  }))
} finally {
  await client.close()
}
