import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createCoartServer } from '../mcp/server.ts'

const host = process.env.COART_HTTP_HOST || '127.0.0.1'
const port = Number.parseInt(process.env.COART_HTTP_PORT || '8787', 10)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('COART_HTTP_PORT must be an integer from 1 to 65535.')
}

const app = createMcpExpressApp({ host })

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'coart-mcp', transport: 'streamable-http' })
})

app.post('/mcp', async (request, response) => {
  const server = createCoartServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  response.on('close', () => {
    void transport.close()
    void server.close()
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(request, response, request.body)
  } catch (error) {
    console.error('Coart MCP HTTP request failed:', error)
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      })
    }
  }
})

for (const method of ['get', 'delete']) {
  app[method]('/mcp', (_request, response) => {
    response.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null
    })
  })
}

const listener = app.listen(port, host, () => {
  console.log(JSON.stringify({ ok: true, endpoint: `http://${host}:${port}/mcp` }))
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => listener.close(() => process.exit(0)))
}
