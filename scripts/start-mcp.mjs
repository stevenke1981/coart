import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createCoartServer } from '../mcp/server.mjs'

await createCoartServer().connect(new StdioServerTransport())
