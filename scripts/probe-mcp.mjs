import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

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
  if (!html.includes('window.coartMcp')) throw new Error('Widget host bridge was not injected.')
  if (!html.includes('<style>') || !html.includes('<script>')) throw new Error('Widget build was not inlined.')

  console.log(JSON.stringify({
    ok: true,
    tools: toolNames.length,
    widgetUri,
    widgetBytes: Buffer.byteLength(html)
  }))
} finally {
  await client.close()
}
