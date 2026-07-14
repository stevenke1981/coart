import { spawn } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const host = '127.0.0.1'
const port = 18000 + (process.pid % 10000)
const baseUrl = `http://${host}:${port}`
const child = spawn(process.execPath, ['scripts/start-http.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, COART_HTTP_HOST: host, COART_HTTP_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
})

let stderr = ''
child.stderr.on('data', (chunk) => { stderr += String(chunk) })

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`HTTP server exited early (${child.exitCode}).\n${stderr}`)
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${baseUrl}/health.\n${stderr}`)
}

const client = new Client({ name: 'coart-http-probe', version: '0.2.0' }, { capabilities: {} })

try {
  await waitForHealth()
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)))
  const tools = await client.listTools()
  if (!tools.tools.some((tool) => tool.name === 'render_coart_canvas')) {
    throw new Error('HTTP MCP endpoint is missing render_coart_canvas.')
  }
  console.log(JSON.stringify({ ok: true, endpoint: `${baseUrl}/mcp`, tools: tools.tools.length }))
} finally {
  await client.close().catch(() => {})
  child.kill()
}
